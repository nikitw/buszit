'use strict';

angular.module('buszit.version', [
  'buszit.version.interpolate-filter',
  'buszit.version.version-directive'
])

.value('version', '0.1');
