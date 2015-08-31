/**
 * Created by nikit on 8/26/15.
 *
 * Directive to add a Map using D3 and geoService.
 * Appends features like zoom control and drag on the map svg.
 */
angular.module('buszit.directives', ['d3'])
    .directive('d3Map', ['$window', '$timeout', 'd3Service', 'geoService', 'nextBusService',
        function($window, $timeout, d3Service, geoService, nextBusService) {
            return {
                restrict: 'A',
                scope: {
                    data: '=',
                    label: '@',
                    onClick: '&'
                },
                link: function(scope, ele, attrs) {
                    d3Service.d3().then(function(d3) {

                        // init loc for SF
                        // This parameter can be loaded from the view.
                        scope.loc = {
                            lat: 37.7603,
                            lng: 122.4367
                        };

                        // if no zoom attribute provided.
                        if(!attrs.zoom) {
                            attrs.zoom = 2210;
                        }

                        // load the initial scale.
                        if(!attrs.scale) {
                            attrs.scale = 1000;
                        }

                        // append a range control for zoom.
                        if(attrs.zoomCtrl == "true") {
                            d3.select(ele[0]).append('div').attr('class', 'map-zoom emphasize')
                                .append('input')
                                .attr('type', 'range')
                                .attr('min', 100)
                                .attr('value', 1000)
                                .attr('max', 5000)
                                .attr('id', '_ctrl_zoom')
                                .on('change', function () {
                                    attrs.scale = this.value;
                                    zoom.scale(this.value / 1000);
                                    scope.$apply()
                                });
                        }

                        // init vars
                        var height = ele[0].offsetHeight,
                            width =  ele[0].offsetWidth;

                        // init Projection
                        var albersProjection = d3.geo.albers()
                            .scale(attrs.zoom * attrs.scale)
                            .rotate([scope.loc.lng])
                            .center([0, scope.loc.lat])
                            .translate( [width/2,height/2] );

                        // init SVG
                        var svg = d3.select(ele[0])
                            .append('svg')
                            .style('width', '100%')
                            .style('height', '100%');


                        // drag transition coordinates.
                        var m0, o0;

                        // Drag object that be called to set the view port location.
                        var drag = d3.behavior.drag()
                            .on("dragstart", function() {
                                var proj = albersProjection.rotate();
                                m0 = [d3.event.sourceEvent.pageX, d3.event.sourceEvent.pageY];
                                o0 = [-proj[0],-proj[1] || 0];
                            })
                            .on("drag", function() {
                                if (m0) {
                                    var m1 = [d3.event.sourceEvent.pageX, d3.event.sourceEvent.pageY],
                                        o1 = [
                                            o0[0] + (m0[0] - m1[0]) / (attrs.zoom * attrs.scale / 100),
                                            o0[1] + (m1[1] - m0[1]) / (attrs.zoom * attrs.scale / 100)
                                        ];
                                    albersProjection.rotate([-o1[0], -o1[1]]);
                                }

                                path = d3.geo.path().projection(albersProjection);
                                svg.selectAll("*").attr("d", path);

                                geoService.restoreMapPoints(svg, albersProjection);
                            });

                        // Apply zoom behavior to svg.
                        var zoom = d3.behavior.zoom()
                            .scaleExtent([0.1, 5])
                            .on('zoom', function() {
                                attrs.scale = d3.event.scale * 1000;
                                d3.select('#_ctrl_zoom')[0][0].value = attrs.scale;
                                scope.$apply();
                            });
                        zoom(svg);

                        // Get the HTML5 location and change the loc, wait for watcher to update the map.
                        geoService.location(function(loc, e) {
                            if(!e) {
                                var lat = loc.coords.latitude;
                                var lng = loc.coords.longitude;

                                scope.loc = {
                                    lat: lat,
                                    lng: -lng
                                };

                                scope.$apply();
                            }
                        });

                        // Apply a watch on scale attribute on element ele.
                        scope.$watch(function() {
                            return attrs.scale;
                        }, function(newZoom) {
                            scope.reRender(attrs.zoom * attrs.scale);
                        });

                        // Apply a watch on loc object for it to change.
                        scope.$watch('loc', function (newLoc) {
                            albersProjection.rotate([newLoc.lng])
                                .center([0, newLoc.lat]);
                            scope.reRender(attrs.zoom * attrs.scale);
                            geoService.setMeMapPoint(
                                [-1 * scope.loc.lng, scope.loc.lat],
                                svg,
                                albersProjection
                            );
                            scope.refreshSvg();
                        });

                        // Apply watch on window resize
                        scope.$watch(function(){
                            return $window.innerWidth;
                        }, function(value) {
                            albersProjection.translate( [value/2,height/2] );
                            scope.reRender(attrs.zoom * attrs.scale);
                        });

                        // Render the map with zoom attribute.
                        scope.reRender = function(newZoom) {
                            albersProjection.scale( newZoom );

                            path = d3.geo.path().projection(albersProjection);

                            if(newZoom <= 400000) {
                                svg.selectAll(['#streets', '#arteries', '#freeways']).remove();
                            }

                            if(newZoom > 400000 && newZoom <= 800000) {
                                svg.selectAll(['#streets', '#arteries']).remove();

                                if(svg.selectAll(['#freeways'])[0].length  == 0) {
                                    renderFreeways();
                                }
                            }
                            if(newZoom > 800000 && newZoom <= 2200000) {
                                svg.selectAll(['#streets']).remove();

                                if(svg.selectAll(['#arteries'])[0].length  == 0) {
                                    renderArteries();
                                }
                            }
                            if(newZoom > 2200000) {
                                if(svg.selectAll(['#streets'])[0].length  == 0) {
                                    svg.selectAll(['#arteries', '#freeways']).remove();
                                    renderStreets(function() {
                                        renderFreeways(function() {
                                            renderArteries();
                                        });
                                    });
                                }
                            }

                            svg.selectAll(["*"]).attr("d", path);

                            geoService.restoreMapPoints(svg, albersProjection);
                        };

                        // Plot a location on Map.
                        scope.plotLocation = function (data) {

                            if(Object.prototype.toString.call( data.body.vehicle ) === '[object Object]') {
                                data.body.vehicle = [data.body.vehicle];
                            }

                            angular.forEach(data.body.vehicle, function(vehicle) {
                                var dir;
                                if(vehicle._dirTag && vehicle._dirTag.indexOf('I') > 2) {
                                    dir = 'I';
                                }

                                var id = '_vehicle_' + vehicle._id + '_' + vehicle._routeTag;
                                svg.select('#' + id).remove();
                                svg.select('#_label_' + id).remove();
                                geoService.putMapPoint(
                                    [vehicle._lon, vehicle._lat],
                                    svg,
                                    albersProjection,
                                    id,
                                    dir,
                                    vehicle._routeTag
                                );
                            });

                        };

                        scope.refreshSvg = function (data) {
                           geoService.restoreMapPoints(svg, albersProjection);
                        };

                        /**
                         * Render Neighborhoods path.
                         * @param next closure
                         */
                        function renderNeighborhoods(next) {
                            geoService.render('neighborhoods', svg, albersProjection, function(map) {
                                if(next) {
                                    next(map);
                                }
                            });
                        }

                        /**
                         * Render Arteries path.
                         * @param next closure
                         */
                        function renderArteries(next) {
                            geoService.render('arteries', svg, albersProjection, function(map) {
                                if(next)
                                    next(map);
                            }, {"fill": "transparent", "stroke": "#ffa700", "stroke-width": "3px"});
                        }

                        /**
                         * Render Freeways path.
                         * @param next closure
                         */
                        function renderFreeways(next) {
                            geoService.render('freeways', svg, albersProjection, function(map) {
                                if(next)
                                    next(map);
                            }, {"fill": "transparent", "stroke": "#5bc0de", "stroke-width": "4px"});
                        }

                        /**
                         * Render Streets path.
                         * @param next closure
                         */
                        function renderStreets(next) {
                            geoService.render('streets', svg, albersProjection, function(map) {
                                if(next)
                                    next(map);
                            }, {"fill": "transparent", "stroke": "#fff", "stroke-width": "2px"});
                        }

                        // init map
                        renderNeighborhoods(function (map) {
                            map.call(drag);
                            renderStreets(function (map) {
                                renderFreeways(function (map) {
                                    renderArteries(function (map) {
                                        geoService.setMeMapPoint(
                                            [-1 * scope.loc.lng, scope.loc.lat],
                                            svg,
                                            albersProjection
                                        );
                                        nextBusService.registerObserver(function (data) {
                                            scope.plotLocation(data);
                                        });

                                        nextBusService.registerRefresher(function (data) {
                                            scope.refreshSvg(data);
                                        });
                                    });
                                });
                            });
                        });
                    });
                }
            }
        }
    ]);
