#!/usr/bin/env python
# encoding: utf-8
import yaml
import os.path as p
from subprocess import call

import sqlalchemy
import flask
from flask.ext.script import Manager, Server
from flask.ext.migrate import Migrate, MigrateCommand

from tmlib.models import Model
from tmaps.appfactory import create_app
from tmaps.extensions import db

cfg = flask.Config(p.realpath(p.dirname(__file__)))
cfg.from_envvar('TMAPS_SETTINGS')

manager = Manager(lambda: create_app(cfg))  # main manager

# Create sub manager for database commands
db_manager = Manager(lambda: create_app(cfg))

migrate = Migrate(lambda: create_app(cfg), db)
# Add a new command to expose options provided by Alembic
db_manager.add_command('migrate', MigrateCommand)
manager.add_command('runserver', Server(port=5002))


@manager.command
def shell():
    """Start a REPL that can be used to interact with the models
    of the application.

    Available in the namespace:

    - Application: app
    - Request context: ctx
    - SQLAlchemy database: db

    """
    app = create_app(cfg)
    from werkzeug import script
    def make_shell():
        ctx = app.test_request_context()
        ctx.push()
        return dict(app=app, ctx=ctx, db=db)
    script.make_shell(make_shell, use_ipython=True)()


@db_manager.command
def create_tables():
    """A command to initialize the tables in the database specified by the
    config key 'SQLALCHEMY_DATABASE_URI'.

    Usage:

        $ python manage.py create_db

    """
    db_uri = cfg['SQLALCHEMY_DATABASE_URI']
    engine = sqlalchemy.create_engine(db_uri)
    Model.metadata.create_all(engine)


@db_manager.command
def insert_data(yaml_file):
    """Insert some records values into the database.

    This command has to be run after after `create_tables`.

    Arguments
    ---------
    yaml_file : str
        The path to a yaml file with the following structure:

        records:
            - path.to.ClassName:
                arg1: value1
                arg2: value2
                ...
            ...

    """
    app = create_app(cfg)

    def import_from_str(name):
        components = name.split('.')
        mod = __import__(components[0])
        for comp in components[1:]:
            mod = getattr(mod, comp)
        return mod

    if yaml_file is None or yaml_file == '':
        print 'No yaml_file supplied, will not insert any data. '
        return

    with open(yaml_file, 'r') as f:
        sample_data = yaml.load(f)

        with app.app_context():
            for rec in sample_data['records']:
                class_name = rec['class']
                constr_args = rec['args']
                model_constr = import_from_str(class_name)

                # Check if there are objects that have to be looked up in the 
                # database before creating new database records.
                for k, v in constr_args.items():
                    if type(v) is dict:
                        obj_class = v['class']
                        obj_model = import_from_str(obj_class)
                        lookup_properties = v['lookup_props']
                        arg_obj = db.session.query(obj_model).filter_by(**lookup_properties).first()
                        constr_args[k] = arg_obj

                obj = model_constr(**constr_args)

                print '* Inserting new object of class "%s" with properties:' % class_name
                for k, v in constr_args.items():
                    print '\t%s: %s' % (k , str(v))

                db.session.add(obj)
                db.session.commit()


# Add submanager to manage database commands under the prefix db
manager.add_command('db', db_manager)


if __name__ == '__main__':
    manager.run()
