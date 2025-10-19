const { createEntry, addLog } = require('../utils/log');

/**
 * @param {number} maxLogs
 * @returns {Function}
 */
const uploadLogger = (maxLogs) => (req, res, next) => {
  if (!req.path.startsWith('/upload')) return next();

  const startTime = Date.now();
  const originalJson = res.json;
  let responseSize = 0;

  res.json = function(data) {
    responseSize = JSON.stringify(data).length;
    return originalJson.call(this, data);
  };

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    addLog(createEntry(req, res.statusCode, duration, responseSize), maxLogs);
  });

  next();
};

module.exports = { uploadLogger };

