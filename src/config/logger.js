var appRoot = require('app-root-path');
var winston = require('winston');
require('winston-mongodb').MongoDB;

// define the custom settings for each transport (file, console)
var options = {
  file: {
    level: 'info',
    filename: `${appRoot}/logs/app.log`,
    handleExceptions: true,
    json: true,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    colorize: false,
  },
  console: {
    level: 'debug',
    handleExceptions: true,
    json: false,
    colorize: true,
  },
};
// new winston.transports.File(options.file)
// instantiate a new Winston Logger with the settings defined above
var logger = winston.createLogger({
  transports: [
    new(winston.transports.MongoDB)({
      db : process.env.MONGODB_URL,
      collection: 'logs'
  })
  ],
  exitOnError: false, // do not exit on handled exceptions
});

module.exports = logger;
// create a stream object with a 'write' function that will be used by `morgan`
module.exports.stream = {
  write: function(message, encoding) {
    // use the 'info' log level so the output will be picked up by both transports (file and console)
    logger.error(message);
  },
};

