const express = require('express');
const { getForwardLogs, getForwardLogById, clearForwardLogs } = require('../utils/log');

/**
 * 应用转发日志筛选器
 */
const applyForwardLogFilters = (logs, { method, status, mode, ruleId, timeRange }) => {
  let filtered = logs;
  
  if (timeRange && timeRange !== 'all') {
    const hours = parseInt(timeRange, 10);
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    filtered = filtered.filter(log => new Date(log.timestamp) >= cutoffTime);
  }
  
  if (method && method !== 'all') {
    filtered = filtered.filter(log => log.method === method.toUpperCase());
  }
  
  const statusFilters = {
    success: log => log.success,
    error: log => !log.success
  };
  if (status && statusFilters[status]) {
    filtered = filtered.filter(statusFilters[status]);
  }
  
  if (mode && mode !== 'all') {
    filtered = filtered.filter(log => log.forwardMode === mode);
  }
  
  if (ruleId && ruleId !== 'all') {
    filtered = filtered.filter(log => log.ruleId === ruleId);
  }
  
  return filtered;
};

/**
 * 计算转发日志统计信息
 */
const calculateForwardLogStats = (allLogs) => ({
  total: allLogs.length,
  success: allLogs.filter(log => log.success).length,
  error: allLogs.filter(log => !log.success).length,
  methods: {
    GET: allLogs.filter(log => log.method === 'GET').length,
    POST: allLogs.filter(log => log.method === 'POST').length,
    PUT: allLogs.filter(log => log.method === 'PUT').length,
    DELETE: allLogs.filter(log => log.method === 'DELETE').length
  },
  modes: {
    redirect: allLogs.filter(log => log.forwardMode === 'redirect').length,
    proxy: allLogs.filter(log => log.forwardMode === 'proxy').length
  }
});

/**
 * @returns {express.Router}
 */
const createRouter = () => {
  const router = express.Router();

  // 获取转发日志列表
  router.get('/', (req, res) => {
    const { limit = 50, method, status, mode, ruleId, timeRange } = req.query;
    
    const allLogs = getForwardLogs();
    const filtered = applyForwardLogFilters(allLogs, { method, status, mode, ruleId, timeRange });
    const limitedLogs = filtered.slice(0, parseInt(limit, 10) || 50);
    const stats = calculateForwardLogStats(allLogs);
    
    res.json({ logs: limitedLogs, stats, filtered: filtered.length });
  });

  // 获取单条转发日志
  router.get('/:id', (req, res) => {
    const log = getForwardLogById(req.params.id);
    if (!log) {
      return res.status(404).json({ error: '日志不存在' });
    }
    res.json(log);
  });

  // 清空转发日志
  router.delete('/', (req, res) => {
    const count = getForwardLogs().length;
    clearForwardLogs();
    res.json({ message: '转发日志已清空', count });
  });

  return router;
};

module.exports = { createRouter };

