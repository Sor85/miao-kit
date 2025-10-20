const express = require('express');
const fs = require('fs').promises;
const axios = require('axios');
const { createForwardEntry, addForwardLog } = require('../utils/log');

/**
 * 创建转发路由（处理实际的转发请求）
 */
const createRouter = ({ rulesFile, maxLogs = 500 }) => {
  const router = express.Router();
  
  // 读取规则
  const readRules = async () => {
    try {
      const data = await fs.readFile(rulesFile, 'utf-8');
      return JSON.parse(data).rules || [];
    } catch {
      return [];
    }
  };
  
  // 处理重定向模式
  const handleRedirect = (res, targetUrl) => {
    res.redirect(302, targetUrl);
  };
  
  // 过滤响应头
  const filterResponseHeaders = (headers) => {
    const skipHeaders = ['transfer-encoding', 'connection', 'keep-alive'];
    return Object.fromEntries(
      Object.entries(headers).filter(([key]) => !skipHeaders.includes(key.toLowerCase()))
    );
  };
  
  // 处理代理模式
  const handleProxy = async (req, res, targetUrl, rule) => {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: { ...req.headers, host: new URL(rule.target).host },
      data: req.body,
      responseType: 'arraybuffer',
      validateStatus: () => true,
      maxRedirects: 0
    });
    
    const filteredHeaders = filterResponseHeaders(response.headers);
    Object.entries(filteredHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    res.status(response.status).send(response.data);
    return response;
  };
  
  // 处理所有请求
  router.all('*', async (req, res, next) => {
    const startTime = Date.now();
    let logEntry = null;
    
    try {
      const rules = await readRules();
      const rule = rules.find(r => req.path === r.source || req.path.startsWith(r.source + '/'));
      
      if (!rule) return next();
      
      const queryStr = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
      const pathSuffix = req.path.substring(rule.source.length);
      const targetUrl = rule.target + pathSuffix + queryStr;
      
      if (rule.mode === 'redirect') {
        const duration = Date.now() - startTime;
        logEntry = createForwardEntry({
          req,
          status: 302,
          duration,
          responseSize: 0,
          targetUrl,
          forwardMode: 'redirect',
          rule
        });
        addForwardLog(logEntry, maxLogs);
        return handleRedirect(res, targetUrl);
      }
      
      if (rule.mode === 'proxy') {
        const response = await handleProxy(req, res, targetUrl, rule);
        const duration = Date.now() - startTime;
        const responseSize = response.data?.length || 0;
        logEntry = createForwardEntry({
          req,
          status: response.status,
          duration,
          responseSize,
          targetUrl,
          forwardMode: 'proxy',
          rule
        });
        addForwardLog(logEntry, maxLogs);
        return;
      }
      
      next();
    } catch (err) {
      const duration = Date.now() - startTime;
      const errorMessage = err.message;
      
      // 尝试从规则中获取信息用于日志记录
      const rules = await readRules().catch(() => []);
      const rule = rules.find(r => req.path === r.source || req.path.startsWith(r.source + '/'));
      
      if (rule) {
        const queryStr = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
        const pathSuffix = req.path.substring(rule.source.length);
        const targetUrl = rule.target + pathSuffix + queryStr;
        
        logEntry = createForwardEntry({
          req,
          status: err.response?.status || 500,
          duration,
          responseSize: 0,
          targetUrl,
          forwardMode: rule.mode,
          rule,
          errorMessage
        });
        addForwardLog(logEntry, maxLogs);
      }
      
      console.error('转发错误:', errorMessage);
      res.status(500).json({ error: '转发失败' });
    }
  });
  
  return router;
};

module.exports = { createRouter };

