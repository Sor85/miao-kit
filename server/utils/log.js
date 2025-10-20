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

/**
 * @typedef {Object} ForwardLogEntry
 * @property {string} id
 * @property {string} timestamp
 * @property {string} method
 * @property {string} sourcePath - 原始请求路径
 * @property {Object} query
 * @property {string} targetUrl - 转发目标URL
 * @property {string} forwardMode - 转发模式：redirect/proxy
 * @property {string} ruleName - 匹配的规则名称
 * @property {string} ruleId - 匹配的规则ID
 * @property {number} status
 * @property {string} duration
 * @property {string} ip
 * @property {string} userAgent
 * @property {Object|null} requestBody
 * @property {string} responseSize
 * @property {boolean} success
 * @property {string|null} errorMessage
 */

const logs = [];
const forwardLogs = [];

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
 * 创建转发日志条目
 * @param {Object} params
 * @returns {ForwardLogEntry}
 */
const createForwardEntry = ({ req, status, duration, responseSize = 0, targetUrl, forwardMode, rule, errorMessage = null }) => ({
  id: `fwd-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
  timestamp: new Date().toISOString(),
  method: req.method,
  sourcePath: req.path,
  query: req.query,
  targetUrl,
  forwardMode,
  ruleName: rule.name || '未命名规则',
  ruleId: rule.id,
  status,
  duration: `${duration}ms`,
  ip: req.ip || req.connection?.remoteAddress || '',
  userAgent: req.get('user-agent') || '',
  requestBody: req.body && Object.keys(req.body).length > 0 ? req.body : null,
  responseSize: String(responseSize),
  success: status >= 200 && status < 400,
  errorMessage
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

/**
 * 添加转发日志
 * @param {ForwardLogEntry} entry
 * @param {number} maxLogs
 */
const addForwardLog = (entry, maxLogs) => {
  forwardLogs.unshift(entry);
  if (forwardLogs.length > maxLogs) forwardLogs.pop();
  console.log(`[FORWARD] ${entry.method} ${entry.sourcePath} -> ${entry.targetUrl} - ${entry.status} (${entry.duration})`);
};

/** @returns {LogEntry[]} */
const getLogs = () => [...logs];

/** @returns {ForwardLogEntry[]} */
const getForwardLogs = () => [...forwardLogs];

/** @param {string} id */
const getLogById = (id) => logs.find(l => l.id === id);

/** @param {string} id */
const getForwardLogById = (id) => forwardLogs.find(l => l.id === id);

const clearLogs = () => logs.length = 0;

const clearForwardLogs = () => forwardLogs.length = 0;

module.exports = { 
  createEntry, 
  addLog, 
  getLogs, 
  getLogById, 
  clearLogs,
  createForwardEntry,
  addForwardLog,
  getForwardLogs,
  getForwardLogById,
  clearForwardLogs
};

