var p = require('../package.json');
var version = p.version.split('.').shift();
var Raven = require('raven');
// Raven.config('https://52d20e1dd5dc43059d80425fe1f2ecc8:063e7a4aaa544ad98f78e54bc8e9c159@sentry.aqumon.com/3').install();

module.exports = {
  restApiRoot: '' + (version > 0 ? '/v' + version : ''),
  host: process.env.HOST || '0.0.0.0',
  port: process.env.PORT || 5010,
  test: 'test',
  // remoting: {
  //   errorHandler: {
  //     handler: Raven.errorHandler()
  //   }
  // }
};
