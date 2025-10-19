/**
 * @typedef {Object} LogEntry
 * @property {string} id
 * @property {string} timestamp
 * @property {string} method
 * @property {string} path
 * @property {Object} query
 * @property {number} status
 * @property {string} duration
 * @property {string} ip
 * @property {string} userAgent
 * @property {Object|null} requestBody
 * @property {string} responseSize
 * @property {boolean} success
 * @property {boolean} isRandom
 */

const logs = [];

/**
 * @param {Object} req
 * @param {number} status
 * @param {number} duration
 * @param {number} responseSize
 * @param {boolean} isRandom
 * @returns {LogEntry}
 */
const createEntry = (req, status, duration, responseSize = 0, isRandom = false) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
  timestamp: new Date().toISOString(),
  method: req.method,
  path: req.path,
  query: req.query,
  status,
  duration: `${duration}ms`,
  ip: req.ip || req.connection?.remoteAddress || '',
  userAgent: req.get('user-agent') || '',
  requestBody: req.body && Object.keys(req.body).length > 0 ? req.body : null,
  responseSize: String(responseSize),
  success: status >= 200 && status < 400,
  isRandom
});

/**
 * @param {LogEntry} entry
 * @param {number} maxLogs
 */
const addLog = (entry, maxLogs) => {
  logs.unshift(entry);
  if (logs.length > maxLogs) logs.pop();
  console.log(`[LOG] ${entry.method} ${entry.path} - ${entry.status} (${entry.duration})`);
};

/** @returns {LogEntry[]} */
const getLogs = () => [...logs];

/** @param {string} id */
const getLogById = (id) => logs.find(l => l.id === id);

const clearLogs = () => logs.length = 0;

module.exports = { createEntry, addLog, getLogs, getLogById, clearLogs };

