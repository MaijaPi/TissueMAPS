describe('In Viewport', function() {
    // Load the module of ObjectLayer and its dependencies
    beforeEach(module('tmaps.core'));

    var appInstance;

    // Injected services and factories
    var viewportFactory, $httpBackend, $rootScope, $document, application;
    var objectLayerFactory, channelLayerFactory, colorFactory;

    beforeEach(inject(function(_viewportFactory_, _$httpBackend_, _$rootScope_, _$document_, _application_, _objectLayerFactory_, _channelLayerFactory_, _colorFactory_) {
        // Assign to variables
        viewportFactory = _viewportFactory_;
        $httpBackend = _$httpBackend_;
        $rootScope = _$rootScope_;
        $document = _$document_;
        application = _application_;
        objectLayerFactory = _objectLayerFactory_;
        channelLayerFactory = _channelLayerFactory_;
        colorFactory = _colorFactory_;
    }));

    beforeEach(function() {
        appInstance = {};

        // Since our index isn't loaded and PhantomJS has its own document, we
        // need to append the necessary elements to it.
        $document.find('body').append('<div id="viewports"></div>');

        // Minimal viewport template
        var viewportTemplate =
            '<div class="instance-viewport">' +
                '<div class="map-container"></div>' +
            '</div>';

        $httpBackend.expectGET('/templates/main/viewport.html')
        .respond(200, viewportTemplate);
    });

    afterEach(function() {
        // Remove the added element again, otherwise each text will add a new
        // div.
        $('#viewports').remove();
    });


    var vp;

    beforeEach(function() {
        vp = viewportFactory.create();
        vp.injectIntoDocumentAndAttach(appInstance);
        // Perform requests for templates
        $httpBackend.flush();
    });

    describe('when creating the viewport', function() {

        it('a viewport container div should be added to the document', function() {
            var vpElements = $('#viewports > .instance-viewport');
            expect(vpElements.length).toEqual(1);
        });

        it('the openlayers map should be added into the document', function(done) {
            vp.map.then(function() {
                var olViewport = $('#viewports .instance-viewport .map-container .ol-viewport');
                expect(olViewport.length).toEqual(1);
                done();
            });
            // So the then callback on the $q deferred will fire.
            $rootScope.$apply();
        });

        it('the map property promise should get fulfilled', function(done) {
            vp.map.then(function(map) {
                expect(map).toBeDefined();
                done();
            });
            // So the then callback on the $q deferred will fire.
            $rootScope.$apply();
        });

        it('the element property promise should get fulfilled', function(done) {
            vp.element.then(function(scope) {
                expect(scope).toBeDefined();
                done();
            });
            // So the then callback on the $q deferred will fire.
            $rootScope.$apply();
        });

        it('the elementScope property promise should get fulfilled', function(done) {
            vp.elementScope.then(function(elementScope) {
                expect(elementScope).toBeDefined();
                done();
            });
            // So the then callback on the $q deferred will fire.
            $rootScope.$apply();
        });

        it('the viewport scope should receive the appInstance as a property', function(done) {
            vp.elementScope.then(function(elementScope) {
                expect(elementScope.appInstance).toEqual(appInstance);
                done();
            });
            // So the then callback on the $q deferred will fire.
            $rootScope.$apply();
        });
    });

    describe('the function setSelectionHandler', function() {
        it('should set the CellSelectionHandler', function() {
            var selHandler = {};
            var vp = viewportFactory.create(appInstance);

            vp.setSelectionHandler(selHandler);
            expect(vp.selectionHandler).toEqual(selHandler);
        });
    });

    describe('the function addObjectLayer', function() {
        var l;

        beforeEach(function() {
            var options = {};
            l = objectLayerFactory.create('name', options);
        });

        it('should add an object layer to the viewport', function() {
            vp.addObjectLayer(l);

            expect(vp.objectLayers[0]).toEqual(l);
        });

        it('should add a vector layer to the openlayers map', function(done) {
            vp.addObjectLayer(l);

            vp.map.then(function(map) {
                expect(map.getLayers().getLength()).toEqual(1);
                done();
            });
            $rootScope.$apply();
        });
    });

    describe('the function removeObjectLayer', function() {
        var l;

        beforeEach(function() {
            var options = {};
            l = objectLayerFactory.create('name', options);
            vp.addObjectLayer(l);
        });

        it('should remove an object layer from the viewport', function() {
            vp.removeObjectLayer(l);
            $rootScope.$apply();

            expect(vp.objectLayers.length).toEqual(0);
        });

        it('should remove a vector layer from the openlayers map', function() {
            vp.removeObjectLayer(l);

            vp.map.then(function(map) {
                expect(map.getLayers().getLength()).toEqual(0);
            });
            $rootScope.$apply();
        });
    });

    describe('the function addChannelLayer', function() {
        var l;
        var tileOpt;

        beforeEach(function() {
            tileOpt = {
                name: 'Test',
                imageSize: [123, 123],
                pyramidPath: '/some/path'
            };
            l = channelLayerFactory.create(tileOpt);
        });

        it('should add a channel layer to the viewport', function() {
            vp.addChannelLayer(l);

            expect(vp.channelLayers[0].name).toEqual(l.name);
        });

        it('should add a tile layer to the openlayers map', function(done) {
            vp.addChannelLayer(l);

            vp.map.then(function(map) {
                expect(map.getLayers().getLength()).toEqual(1);
                done();
            });
            $rootScope.$apply();
        });

        it('should create a view if this is the first layer added', function(done) {
            vp.map.then(function(map) {
                expect(map.getView().getProjection().getCode()).not.toEqual('ZOOMIFY');
            });

            vp.addChannelLayer(l);

            vp.map.then(function(map) {
                expect(map.getView().getProjection().getCode()).toEqual('ZOOMIFY');
                done();
            });

            $rootScope.$apply();
        });
    });

    describe('the function removeChannelLayer', function() {
        var l;
        var tileOpt;

        beforeEach(function() {
            tileOpt = {
                name: 'Test',
                imageSize: [123, 123],
                pyramidPath: '/some/path'
            };
            l = channelLayerFactory.create(tileOpt);
            vp.addChannelLayer(l);
        });

        it('removes a channel layer from the viewport', function() {
            vp.removeChannelLayer(l);

            expect(vp.channelLayers.length).toEqual(0);
        });

        it('removes the tile layer from the openlayers map', function(done) {
            vp.removeChannelLayer(l);

            vp.map.then(function(map) {
                expect(map.getLayers().getLength()).toEqual(0);
                done();
            });
            $rootScope.$apply();
        });
    });

    describe('the function destroy', function() {
        it('should remove the created scope', function() {
            vp.destroy();

            vp.elementScope.then(function(scope) {
                expect(scope.$$destroyed).toEqual(true);
            });
            $rootScope.$apply();
        });

        it('should remove the viewport from the document', function() {
            vp.destroy();
            $rootScope.$apply();

            var vpElements = $('#viewports > .instance-viewport');
            expect(vpElements.length).toEqual(0);
        });
    });

    describe('the function hide', function() {
        it('should hide the viewport', function() {
            vp.hide();
            $rootScope.$apply();

            var vpElements = $('#viewports > .instance-viewport');
            expect(vpElements.css('display')).toEqual('none');
        });
    });

    describe('the function show', function() {
        it('should show the viewport', function() {
            vp.hide();
            vp.show();
            $rootScope.$apply();

            var vpElements = $('#viewports > .instance-viewport');
            expect(vpElements.css('display')).toEqual('block');
        });

        // it('should recalculate the map\'s size', function(done) {
        //     vp.show();

        //     vp.map.then(function(map) {
        //         expect(map.updateSize).toHaveBeenCalled();
        //         done();
        //     });
        //     $rootScope.$apply();
        // });
    });

    describe('the function serialize', function() {
        it('should save all the layers\' state');
        it('should serialize the selection handler\'s state');
        it('should save the map state');
    });
});


