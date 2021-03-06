'use strict';

var lodash = require('lodash');
var optimist = require('optimist');
var path = require('path');

var kommandoRunner = require('./index.js');

var packageJson = require(path.join(__dirname, '..', 'package.json'));

var argv = optimist
  .usage('Usage: \n  $0 [options] TESTFILE(S) # allows globbing')
  .wrap(80)
  .option('version', {
    alias: 'v',
    desc: 'Prints out kommando version'
  })
  .option('help', {
    alias: 'h',
    desc: 'Show this message and quits'
  })
  .option('browser', {
    alias: 'b',
    type: 'string',
    desc: 'Browser(s) in which the tests should be executed',
    'default': 'phantomjs'
  })
  .option('driver', {
    alias: 'd',
    type: 'string',
    desc: 'Driver providing Selenium URL'
  })
  .option('driver-option-*', {
    desc: [
      'Option(s) for a specific driver. Overriding default options of driver ',
      '(e.g. --driver-option-port 12332). Check docs for possible driver options.'
    ].join('')
  })
  .option('client', {
    alias: 'w',
    type: 'string',
    desc: 'Injected JS Webdriver client library'
  })
  .option('runner', {
    alias: 'r',
    type: 'string',
    desc: 'Used test runner'
  })
  .option('runner-module', {
    alias: 'm',
    type: 'string',
    desc: 'Runner module(s) that are loaded in runner context before tests get added'
  })
  .option('runner-option-*', {
    desc: [
      'Option(s) for a specific test runner. Overriding default options of runner ',
      '(e.g. --runner-option-isVerbose or --runner-option-ui tdd). Check docs for possible driver options.'
    ].join('')
  })
  .option('runner-global-*', {
    type: 'string',
    desc: [
      'Global(s) which will be available within the `kommando` runner global ',
      '(e.g. --runner-global-baseUrl http://localhost or --runner-global-env dev)'
    ].join('')
  })
  .option('config', {
    alias: 'c',
    type: 'string',
    desc: 'Specifies JSON-formatted configuration file (CLI arguments overwrite config settings)'
  })
  .argv;

if (argv.version) {
  console.log(packageJson.version);
  process.exit(1);
}

if (argv.help) {
  optimist.showHelp();
  process.exit(1);
}

function convertArgToArray(argv, argName) {
  var arg = argv[argName];
  if (!arg) {
    return null;
  } else if (lodash.isArray(arg)) {
    return arg;
  } else {
    return [arg];
  }
}

function prepareObject(key, value) {
  var rootObject = {};
  var obj = rootObject;
  var splitKeys = key.split('.');
  lodash.forEach(splitKeys, function(splitKey) {
    obj[splitKey] = obj = value;
  });
  return rootObject;
}

function collectArgsWithPrefix(argv, argPrefix) {
  var obj = {};
  var slicedKey;
  Object.keys(argv).forEach(function(key) {
    if (key.indexOf(argPrefix) === 0) {
      slicedKey = key.slice(argPrefix.length);
      lodash.merge(obj, prepareObject(slicedKey, argv[key]));
    }
  });
  return obj;
}

var browsers = convertArgToArray(argv, 'browser');
var driverOptions = collectArgsWithPrefix(argv, 'driver-option-');
var runnerOptions = collectArgsWithPrefix(argv, 'runner-option-');
var runnerKommandoGlobals = collectArgsWithPrefix(argv, 'runner-global-');
var runnerModules = convertArgToArray(argv, 'runner-module');

// read config when it was passed
var kommandoConfig = argv.config ? require(path.resolve(argv.config)) : {};

// autodetect "driver"
if (!argv.driver && !kommandoConfig.driver) {
  if (argv['sauce-user'] && argv['sauce-key']) {
    argv.driver = 'saucelabs';
  } else if (argv['selenium-url']) {
    argv.driver = 'selenium-gird';
  } else {
    argv.driver = 'selenium-server';
  }
}

lodash.merge(kommandoConfig, {
  browsers: browsers,
  client: argv.client,
  driver: argv.driver,
  driverOptions: driverOptions,
  runner: argv.runner,
  runnerOptions: runnerOptions,
  runnerKommandoGlobals: runnerKommandoGlobals,
  runnerModules: runnerModules,
  tests: argv._
});

if (kommandoConfig.runner !== 'repl' && kommandoConfig.tests.length < 1) {
  optimist.showHelp();
  console.log('Pass at least one test file.');
  process.exit(1);
}

// resolve test-files of config-file relative to it
var pathFrom = argv.config ? path.dirname(path.resolve(argv.config)) : process.cwd();

kommandoConfig.tests = kommandoConfig.tests.map(function(test) {
  return path.resolve(pathFrom, test);
});

kommandoRunner(kommandoConfig, function(error, results) {
  var passed = lodash.every(results, 'passed');
  process.exit(!error && passed ? 0 : 1);
});
