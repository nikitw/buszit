/**
 * Created by nikit on 8/26/15.
 *
 * BusZit service layer.
 */
var services = angular.module('buszit.services', ['d3']);

/**
 * GeoService for location and map plotting.
 * Serves GeoJson data for D3.
 */
services.factory('geoService',
    function($http) {
        /**
         * Service Object.
         *
         * @type {{}}
         */
        var gjs = {
            /**
             * Json cache.
             *
             * @type {{}}
             */
            jsonCache: {}
        };


        /**
         * Load a json async from sfmaps dir.
         *
         * @param jsonName Name of the Json File
         * @param callback Closure to receive the response
         * @returns {*} JsonData
         */
        gjs.json = function(jsonName, callback) {
            if(gjs.jsonCache[jsonName]) {
                if(callback) {
                    return callback(gjs.jsonCache[jsonName]);
                }

                return gjs.jsonCache[jsonName];
            }

            $http.get('sfmaps/'+jsonName+'.json').success(function(json) {
                gjs.jsonCache[jsonName] = json;
                return callback(json);
            });
        };

        /**
         * Renders the Json on the given svg with a specified projection.
         *
         * @param jsonName Name of the Json File
         * @param svg SVG object to append the json features
         * @param projection Projection to render the Json eg. albers|mercator
         * @param bindCallback Closure to add more attrs and bindings for the rendered layer
         * @param attrs Fill, Stroke and, StrokeWidth attributes for the given path projection
         */
        gjs.render = function(jsonName, svg, projection, bindCallback, attrs) {

            var path = d3.geo.path().projection(projection);
            var map = svg.append('g').attr("id", jsonName);

            gjs.json(jsonName, function (json) {
                if(!json) {
                    return;
                }

                if(!attrs) {
                    attrs = {"fill": "#ccc", "stroke": "#bbb", "stroke-width": "1px"}
                }

                map.selectAll("path")
                    .data(json.features)
                    .enter()
                    .append("path")
                    .attr("d", path)
                    .attr(attrs);

                if(bindCallback) {
                    bindCallback(map, svg, projection);
                }
            });

        };

        /**
         * MapPoints Cache
         * @type {{}}
         */
        gjs.mapPoints = {};

        /**
         * Set the current position of the user on Map.
         *
         * @param point
         * @param svg
         * @param projection
         */
        gjs.setMeMapPoint = function (point, svg, projection) {
            gjs.meMapPoint = new Point(point[1], point[0], '_ico_cloc');
            plotMapPoint(point, svg, projection, '_ico_cloc');
        };

        /**
         * Get all the available MapPoints in cache
         *
         * @returns {{}}
         */
        gjs.getMapPoints = function () {
            return gjs.mapPoints;
        };

        /**
         * Remove all the mapPoints (only from SVG, not from the cache)
         * and re-render them on the last layer of svg.
         *
         * @param svg
         * @param projection
         */
        gjs.restoreMapPoints = function (svg, projection) {
            svg.selectAll(['.mapPoint']).remove();

            angular.forEach(gjs.mapPoints, function(val, key) {
                gjs.putMapPoint([val.lng, val.lat], svg, projection, key);
            });

            if(angular.isDefined(gjs.meMapPoint)) {
                var point = [gjs.meMapPoint.lng, gjs.meMapPoint.lat];
                plotMapPoint(point, svg, projection, gjs.meMapPoint.type);
            }
        };

        /**
         * Put a new MapPoint on the last layer of SVG
         *
         * @param point New position of the point.
         * @param svg
         * @param projection
         * @param idx Identifier for the cache. (choose unique)
         */
        gjs.putMapPoint = function(point, svg, projection, idx) {
            if(!idx) {
                idx = function (d) {
                    return d.id;
                }
            }

            var oldMapPoint = null;
            if(gjs.mapPoints.hasOwnProperty(idx)) {
                var mapPoint = gjs.mapPoints[idx];
                oldMapPoint = mapPoint ? [mapPoint.lng, mapPoint.lat] : null;
            }

            gjs.mapPoints[idx] = (new Point(point[1], point[0], idx));

            plotMapPoint(point, svg, projection, idx, oldMapPoint);
        };

        /**
         * Put the Point on the SVG. If the old position is specified,
         * Transition from old location to the new location of the point.
         *
         * @param point New position of the point
         * @param svg
         * @param projection
         * @param idx Identifier for the cache. (choose unique)
         * @param oldMapPoint Old position of the point.
         */
        function plotMapPoint(point, svg, projection, idx, oldMapPoint) {

            if(isNaN(point[0]) || isNaN(point[1])) {
                return;
            }

            var numGs = svg.selectAll('g')[0].length;

            if(numGs == 0) {
                return;
            }

            var map = d3.select(svg.selectAll('g')[0][numGs - 1]);

            var fill = "assets/icons/_ico_bus.png";

            if (idx == '_ico_cloc') {
                fill = "assets/icons/_ico_cloc.png";
            }

            var coordinates = projection(point);

            var image = map.append('svg:image')
                .attr('width', '30px')
                .attr('height', '32px')
                .attr("xlink:href", fill)
                .attr("id", idx)
                .attr("class", 'mapPoint');

            if(oldMapPoint) {
                var oldCoordinates = projection(oldMapPoint);
                var tpose = [coordinates[0] - oldCoordinates[0], coordinates[1] - oldCoordinates[1]];

                image
                    .attr('x', oldCoordinates[0] - 15) // reposition to center - x
                    .attr('y', oldCoordinates[1] - 32) // reposition to center - y
                    .transition().duration(15000)
                    .attr('transform', function(d) {
                        return "translate("+tpose[0] + "," + tpose[1] + ")";
                    });
            } else {
                image
                    .attr('x', coordinates[0] - 15) // reposition to center - x
                    .attr('y', coordinates[1] - 32); // reposition to center - y
            }
        }

        /**
         * Attempt to retrieve the path points for smooth transition between two
         * points on the map path.
         *
         * @using attrTween
         *
         * @incomplete WIP
         *
         * @param path
         * @returns {Function}
         */
        function translateAlong(path) {
            var l = path.getTotalLength();
            return function(d, i, a) {
                return function(t) {
                    var p = path.getPointAtLength(t * l);
                    return "translate(" + p.x + "," + p.y + ")";
                };
            };
        }

        /**
         * Return the browser's HTML5 geoLocation.
         *
         * @param callback Closure to get the location response.
         */
        gjs.location = function(callback) {
            var e = new Error('Failed to serve location', 3394);

            if (navigator.geolocation && callback) {
                navigator.geolocation.getCurrentPosition(function(loc) {
                    var lat = loc.coords.latitude;
                    var lng = loc.coords.longitude;

                    if(lat < 36.5 || lat > 38.5 || lng < 121.5 && lng > 123.5) {
                        console.log('your location is not in SF');
                        return callback(null, e);
                    }
                    gjs.curLoc = loc;
                    return callback(loc);
                });
            } else {
                if(callback) {
                    callback(null, e);
                } else {
                    console.log(e);
                }
            }
        };

        return gjs;
    });

/**
 * Next bus service, using NextBus API.
 */
services.factory('nextBusService',
    function($http, $interval, geoService) {
        /**
         * Service Object.
         *
         * @type {{}}
         */
        var nbs = {
            /**
             * @unused
             */
            svg: null,
            /**
             * @unused
             */
            projection: null,
            /**
             * Service for sf-muni only
             */
            agency: 'sf-muni',
            /**
             * Array of selected routeTag names
             * []
             */
            tagList: [],
            /**
             * Array of routeTags
             * []
             */
            routeList: undefined,
            /**
             * NBS ping interval for 15 seconds
             */
            interval: 15000
        };

        /**
         * Service EndPoint for NBS API
         *
         * @type {string}
         */
        var endpoint = "http://webservices.nextbus.com/service/publicXMLFeed?command=";

        /**
         * $timeout state variable
         */
        var stop;

        /**
         * NBS Statics
         */
        var AGENCY = '&a=';
        var ROUTE = '&r=';
        var TIME = '&t=';

        /**
         * NBS commands
         *
         * @type {string}
         */
        var AGENCYCMD = 'agencyList';
        var ROUTELISTCMD = 'routeList' + AGENCY + nbs.agency;
        var ROUTECONFIGCMD = 'routeConfig' + AGENCY + nbs.agency;
        var VEHICLELOCATIONSCMD = 'vehicleLocations' + AGENCY + nbs.agency;

        /**
         * Observer callback closures
         * Register Observer for data response after every interval.
         *
         * @type {Array}
         */
        var observerCallbacks = [];

        /**
         * Refresher callback closures
         * Register Refresher for UI/SVG/Controller state after modifications to
         * selections or requests.
         *
         * @type {Array}
         */
        var refresherCallbacks = [];

        /**
         * Fetch routes from NBS
         *
         * @param callback Closure to receive data
         * @returns {*}
         */
        nbs.getRoutes = function(callback) {
            if(nbs.routeList) {
                return nbs.routeList;
            }
            nbs.command(ROUTELISTCMD, function (data) {

                nbs.routeList = [];

                angular.forEach(data.body.route, function (routeTag) {
                    /**
                     * Set all the routes to un-selected state.
                     *
                     * @type {boolean}
                     */
                    routeTag['_selected'] = false;
                    nbs.routeList.push(routeTag);
                });

                if (callback) {
                    callback(nbs.routeList);
                }
            });
        };

        /**
         * If the location is set, return the current epoch from the PST timezone,
         * else return 0 (this will fetch last 15 minutes update)
         *
         * @returns {number}
         */
        function getEpoch() {
            if(angular.isDefined(geoService.curLoc)) {
                return (new Date).getTime();
            } else {
                return 0;
            }
        }

        /**
         * Ping a VehicleLocation command for the given route.
         *
         * @param tag RouteTag
         * @param callback Return all the vehicle locations on this route.
         */
        nbs.pingVehicleLocation = function(tag, callback) {
            nbs.command(VEHICLELOCATIONSCMD + ROUTE + tag + TIME + getEpoch(),
                function (data) {
                    if(callback) {
                        callback(data);
                    }

                    /**
                     * tell all the observer Listeners about the available updates.
                     */
                    nbs.notifyObservers(data);
                }
            );

        };

        /**
         * NBS util to execute a command and transform the XML response to Json object.
         *
         * @param command
         * @param callback
         */
        nbs.command = function(command, callback) {
            $http.get(endpoint + command, {
                transformResponse:function(data) {
                    // convert the data to JSON and provide
                    // it to the success function below
                    var x2js = new X2JS();
                    var json = x2js.xml_str2json( data );
                    return json;
                }
            }).success(function(data) {
                if(callback) {
                    callback(data);
                }
            });
        };

        /**
         * Initialize the NBS, or re-start the service from scratch.
         */
        nbs.init = function() {
            nbs.getRoutes(function () {
                nbs.isLoaded = true;
            });

            nbs.startService();
        };

        /**
         * Change the state of tag selected as per its current state.
         *
         * if selected, un-select it and vice versa.
         *
         * @param tag
         */
        nbs.toggleTag = function(tag) {
            var index = nbs.tagList.indexOf(tag._tag);

            if(index == -1) {
                tag._selected = true;
                nbs.tagList.push(tag._tag);
            } else {
                tag._selected = false;
                nbs.tagList.splice(index, 1);
            }

            nbs.startService();
        };

        /**
         * Start the daemon running for pinging NBS API for location updates
         * for selected routes after every 15 seconds.
         */
        nbs.startService = function () {
            if ( angular.isDefined(stop) ) {
                nbs.stopService();
            }

            geoService.mapPoints = {};

            /**
             * tell all the refresh listeners to execute their operation for this event.
             */
            nbs.notifyRefreshers();

            nbs.pingAllVehicleLocations();
            stop = $interval(function() {
                nbs.pingAllVehicleLocations();
            }, nbs.interval);

        };

        /**
         * Ping all the currently selected routes for location updates
         */
        nbs.pingAllVehicleLocations = function () {
            angular.forEach(nbs.tagList, function(tag){
                nbs.pingVehicleLocation(tag);
            });
        };

        /**
         * Stop the service daemon
         */
        nbs.stopService = function () {
            if ( angular.isDefined(stop) ) {
                $interval.cancel(stop);
                stop = undefined;
            }
        };

        /**
         * register an observer callback
         */
        nbs.registerObserver = function(callback){
            observerCallbacks.push(callback);
        };

        /**
         * register a refresher callback
         */
        nbs.registerRefresher = function(callback){
            refresherCallbacks.push(callback);
        };

        /**
         * call this when locations 'updated'
         */
        nbs.notifyObservers = function(data){
            angular.forEach(observerCallbacks, function(callback){
                callback(data);
            });
        };

        /**
         * call this when you know tags has been changed
         */
        nbs.notifyRefreshers = function(data){
            angular.forEach(refresherCallbacks, function(callback){
                callback(data);
            });
        };

        /**
         * Initialize the service and set the daemon running
         */
        nbs.init();

        return nbs;
    });

/**
 * MapPoint object
 *
 * @param lat Latitude
 * @param lng Longitude
 * @param type bus/cloc
 * @constructor
 */
var Point = function (lat, lng, type) {
    this.lat = lat;
    this.lng = lng;
    this.type = type;
};