var fs = require('fs');
var path = require('path');

var async = require('async');
var glob = require('glob');
var lodash = require('lodash');

var defaultConfig = {
  capabilities: [],
  tests: [],
  driver: 'selenium-server',
  driverArgs: {},
  client: 'selenium-webdriver',
  runner: 'jasmine-node',
  runnerArgs: {},
  runnerModules: [
    'jasmine-selenium-webdriver'
  ],
  runnerKommandoGlobals: {},
  sauceUser: undefined,
  sauceKey: undefined,
  sauceName: undefined,
  sauceBuild: undefined,
  sauceTags: undefined,
  seleniumUrl: undefined
};

var detectModulePath = function(moduleName, type) {
  var modulePath = path.join(__dirname, type, moduleName + '.js');
  if (fs.existsSync(modulePath)) {
    return modulePath;
  } else if (fs.existsSync(moduleName)) {
    return moduleName;
  } else {
    throw new Error('The passed "' + type + '" module "' + moduleName + '" was not found.')
  }
};

var run = function(config, callback) {
  config = lodash.extend({}, defaultConfig, config);

  var client = detectModulePath(config.client, 'client');
  var driver = require(detectModulePath(config.driver, 'driver'))(config.driverArgs);
  var runner = detectModulePath(config.runner, 'runner');

  var runnerModules = [];
  config.runnerModules.forEach(function(runnerModuleName) {
    runnerModules.push(detectModulePath(runnerModuleName, 'runner-module'));
  });

  var tests = [];
  config.tests.forEach(function(test) {
    tests = tests.concat(glob.sync(test));
  });

  if (tests.length === 0) {
    throw new Error('No test files found.')
  }

  var runTestsFunctions = [];

  driver.create(function(error, seleniumUrl, capabiltiesAddon) {
    if (error) {
      console.log(error);
      process.exit(error ? 0 : 1);
    }
    config.capabilities.forEach(function(capabilities) {
      lodash.merge(capabilities, capabiltiesAddon);
      runTestsFunctions.push(runTests.bind(
        null, tests, seleniumUrl,
        capabilities, client, runner,
        config.runnerArgs, runnerModules, config.runnerKommandoGlobals
      ));
    });

    // Execute tests per capability / browser one after another
    async.series(runTestsFunctions, function(error, results) {
      if (error) {
        console.log(error);
      }
      driver.end(results, function(endError) {
        if (typeof callback === 'function') {
          callback(error && endError, results);
        }
      });
    });

  });
};

var runTests = function(tests, seleniumUrl, capabilities, client, runner, runnerArgs, runnerModules, runnerKommandoGlobals, callback) {
  console.log('Run tests using "' + capabilities.browserName + '"');
  var child = require('child_process').fork(path.join(__dirname, 'run-tests.js'));
  child.send({
    seleniumUrl: seleniumUrl,
    capabilities: capabilities,
    client: client,
    runner: runner,
    runnerArgs: runnerArgs,
    runnerModules: runnerModules,
    runnerKommandoGlobals: runnerKommandoGlobals,
    tests: tests
  });
  child.on('message', function(msg) {
    child.disconnect();
    callback(msg.error, {
      passed: msg.passed,
      clientIds: msg.clientIds
    });
  });
};

module.exports = run;
