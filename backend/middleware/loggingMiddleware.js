// import logger from '../config/logger.js';

const loggingMiddleware = (req, res, next) => {
  // const startTime = Date.now();

  // Log request
  // logger.info('Incoming request', {
  //   method: req.method,
  //   url: req.url,
  //   ip: req.ip,
  //   userAgent: req.get('user-agent'),
  // });

  // Capture response
  // res.on('finish', () => {
  //   const duration = Date.now() - startTime;
  //   const logLevel = res.statusCode >= 400 ? 'error' : 'info';

  //   logger[logLevel]('Request completed', {
  //     method: req.method,
  //     url: req.url,
  //     statusCode: res.statusCode,
  //     duration: `${duration}ms`,
  //     ip: req.ip,
  //   });
  // });

  next();
};

export default loggingMiddleware;
