import { log } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  log('ERROR', err.message, { stack: err.stack });
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error'
      : err.message
  });
};
