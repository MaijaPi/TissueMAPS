import os
import os.path as p
from xml.dom import minidom
from werkzeug import secure_filename
from ..extensions.database import db
from utils import (
    auto_generate_hash, auto_create_directory, exec_func_after_insert
)
from . import CRUDMixin, Model, HashIdModel

# EXPERIMENT_ACCESS_LEVELS = (
#     'read',
#     'delete'
# )


class ExperimentShare(Model, CRUDMixin):
    recipient_user_id = db.Column(db.Integer, db.ForeignKey('user.id'),
                                  primary_key=True)
    donor_user_id = db.Column(db.Integer, db.ForeignKey('user.id'),
                              primary_key=True)
    experiment_id = db.Column(db.Integer, db.ForeignKey('experiment.id'),
                              primary_key=True)
    experiment = db.relationship('Experiment', uselist=False)
    # access_level = db.Column(db.Enum(*EXPERIMENT_ACCESS_LEVELS,
    #                                  name='access_level'))


def _default_experiment_location(exp):
    from _user import User
    user = User.query.get(exp.owner_id)
    dirname = secure_filename('%d__%s' % (exp.id, exp.name))
    dirpath = p.join(user.experiments_location, dirname)
    return dirpath

def _layers_location(exp):
    return p.join(exp.location, 'layers')

def _plates_location(exp):
    return p.join(exp.location, 'plates')

def _plate_sources_location(exp):
    return p.join(exp.location, 'plate_sources')

def _create_locations_if_necessary(mapper, connection, exp):
    if exp.location is None:
        exp_location = _default_experiment_location(exp)

        # Temp. set the location so that all the other location functions
        # work correctly. This still has to be persisted using SQL (see below).
        exp.location = exp_location
        locfuncs = [_default_experiment_location, _plate_sources_location,
                    _plates_location, _layers_location]
        for f in locfuncs:
            loc = f(exp)
            if not p.exists(loc):
                os.mkdir(loc)
            else:
                print 'Warning: dir %s already exists.' % loc

        # exp.location = loc line won't
        # persists the location on the object.
        # If done directly via SQL it works.
        table = Experiment.__table__
        connection.execute(
            table.update()
                 .where(table.c.id == exp.id)
                 .values(location=exp_location))


@exec_func_after_insert(_create_locations_if_necessary)
@auto_generate_hash
class Experiment(HashIdModel, CRUDMixin):
    id = db.Column(db.Integer, primary_key=True)
    hash = db.Column(db.String(20))
    name = db.Column(db.String(120), index=True)
    location = db.Column(db.String(600))
    description = db.Column(db.Text)

    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_on = db.Column(db.DateTime, default=db.func.now())
    owner = db.relationship('User', backref='experiments')

    def __init__(self, name, description, owner, location=None):
        self.name = name
        self.description = description
        self.owner_id = owner.id
        if location is not None:
            if not p.isabs(location):
                raise ValueError(
                    'The experiments location on the filesystem must be '
                    'an absolute path'
                )
            else:
                self.location = location
        else:
            self.location = None

    @property
    def dataset_path(self):
        return p.join(self.location, 'data.h5')

    @property
    def plates_location(self):
        return _plates_location(self)

    @property
    def plate_sources_location(self):
        return _plate_sources_location(self)

    def belongs_to(self, user):
        return self.owner == user

    @property
    def dataset(self):
        import h5py
        fpath = self.dataset_path
        if os.path.exists(fpath):
            print 'LOADING DATA SET'
            print fpath
            return h5py.File(fpath, 'r')
        else:
            return None

    def __repr__(self):
        return '<Experiment %r>' % self.name

    @property
    def layers_location(self):
        return _layers_location(self)

    @property
    def layers(self):
        layers_dir = self.layers_location
        layer_names = [name for name in os.listdir(layers_dir)
                       if p.isdir(p.join(layers_dir, name))]

        layers = []

        for layer_name in layer_names:
            layer_dir = p.join(layers_dir, layer_name)
            metainfo_file = p.join(layer_dir, 'ImageProperties.xml')

            if p.exists(metainfo_file):
                with open(metainfo_file, 'r') as f:
                    dom = minidom.parse(f)
                    width = int(dom.firstChild.getAttribute('WIDTH'))
                    height = int(dom.firstChild.getAttribute('HEIGHT'))

                    pyramid_path = '/experiments/{id}/layers/{name}/'.format(
                            id=self.hash, name=layer_name)

                    layers.append({
                        'name': layer_name,
                        'imageSize': [width, height],
                        'pyramidPath': pyramid_path
                    })

        return layers

    def as_dict(self):
        return {
            'id': self.hash,
            'name': self.name,
            'description': self.description,
            'owner': self.owner.name,
            'layers': self.layers,
            'plate_sources': [pl.as_dict() for pl in self.plate_sources],
            'plates': [pl.as_dict() for pl in self.plates]
        }
