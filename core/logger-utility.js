const logger = {
  error: (message, error) => console.error(message, error),
  warn: (message, error) => console.warn(message, error),
  info: (message) => console.info(message),
  debug: (message) => console.debug(message)
};

module.exports = logger;
