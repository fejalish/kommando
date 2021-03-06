'use strict';

var async = require('async');
var url = require('url');
var wd = require('wd');

module.exports = function(seleniumUrl) {
  return {
    clients: {},
    create: function(capabilities, callback) {
      var client = wd.remote(url.parse(seleniumUrl));

      client.init(capabilities, function(error, sessionId) {
        this.clients[sessionId] = client;
        if (typeof callback === 'function') {
          callback(error, client, {
            wd: wd
          });
        }
      }.bind(this));
    },
    end: function(callback) {
      var client;
      var quitFunctions = [];

      for (var id in this.clients) {
        client = this.clients[id];
        delete this.clients[id];
        quitFunctions.push(client.quit.bind(client));
      }
      async.series(quitFunctions, callback);
    }
  };
};
