'use strict';

// Declare app level module which depends on views, and components
angular.module('buszit', [
    'ngRoute',
    'd3',
    'buszit.directives',
    'buszit.services',
    'buszit.view1',
    'buszit.version'
]).
    config(['$routeProvider', function($routeProvider) {
        $routeProvider.otherwise({redirectTo: '/sf-muni'});
    }]);
