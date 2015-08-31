'use strict';

angular.module('buszit.view1', ['ngRoute'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/sf-muni', {
    templateUrl: 'views/mapView.html',
    controller: 'MapViewCtrl'
  });
}])

/**
 * Controller for MapView.
 */
.controller('MapViewCtrl', function($scope, $timeout, nextBusService) {
        $scope.zoom = 2210;
        $scope.scale = 1000;

        /**
         * Wait for NBS to load for fetching the routeTags list.
         */
        $scope.$watch(function() {
            return nextBusService.isLoaded;
        }, function (loaded) {
            if(loaded) {
                $scope.routes = nextBusService.routeList;
            }
        });

        /**
         * Switch a tag for update.
         *
         * @param tag
         */
        $scope.toggleTag = function(tag) {
            nextBusService.toggleTag(tag);
        };

        /**
         * List all the added tags.
         *
         * @returns {nbs.tagList|*}
         */
        $scope.getAddedTags = function() {
            return nextBusService.tagList;
        };

    });