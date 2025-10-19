const express = require('express');
const { getLogs, getLogById, clearLogs } = require('../utils/log');

/**
 * @returns {express.Router}
 */
const createRouter = () => {
  const router = express.Router();

  // 获取日志列表
  router.get('/', (req, res) => {
    const { limit = 50, method, status, collection, timeRange } = req.query;
    
    let filtered = getLogs();
    
    // 时间范围筛选
    if (timeRange && timeRange !== 'all') {
      const hours = parseInt(timeRange, 10);
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      filtered = filtered.filter(log => new Date(log.timestamp) >= cutoffTime);
    }
    
    // 方法筛选
    if (method && method !== 'all') {
      filtered = filtered.filter(log => log.method === method.toUpperCase());
    }
    
    // 状态筛选
    const statusFilters = {
      success: log => log.success,
      error: log => !log.success
    };
    if (status && statusFilters[status]) {
      filtered = filtered.filter(statusFilters[status]);
    }
    
    // 图床筛选
    if (collection && collection !== 'all') {
      filtered = filtered.filter(log => log.path.includes(`/${collection}`));
    }
    
    // 限制数量
    filtered = filtered.slice(0, parseInt(limit, 10) || 50);
    
    // 统计
    const allLogs = getLogs();
    const stats = {
      total: allLogs.length,
      success: allLogs.filter(log => log.success).length,
      error: allLogs.filter(log => !log.success).length,
      methods: {
        GET: allLogs.filter(log => log.method === 'GET').length,
        POST: allLogs.filter(log => log.method === 'POST').length
      }
    };
    
    res.json({ logs: filtered, stats, filtered: filtered.length });
  });

  // 获取单条日志
  router.get('/:id', (req, res) => {
    const log = getLogById(req.params.id);
    if (!log) {
      return res.status(404).json({ error: '日志不存在' });
    }
    res.json(log);
  });

  // 清空日志
  router.delete('/', (req, res) => {
    const count = getLogs().length;
    clearLogs();
    res.json({ message: '日志已清空', count });
  });

  return router;
};

module.exports = { createRouter };

