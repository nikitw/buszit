'use strict';

describe('buszit.version module', function() {
  beforeEach(module('buszit.version'));

  describe('version service', function() {
    it('should return current version', inject(function(version) {
      expect(version).toEqual('0.1');
    }));
  });
});
