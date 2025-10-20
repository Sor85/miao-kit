const express = require('express');
const path = require('path');
const fs = require('fs').promises;

/**
 * 创建API转发管理路由
 */
const createRouter = ({ rulesFile }) => {
  const router = express.Router();
  
  // 确保规则文件存在
  const ensureRulesFile = async () => {
    try {
      await fs.access(rulesFile);
    } catch {
      await fs.writeFile(rulesFile, JSON.stringify({ rules: [] }, null, 2));
    }
  };
  
  // 读取规则
  const readRules = async () => {
    await ensureRulesFile();
    const data = await fs.readFile(rulesFile, 'utf-8');
    return JSON.parse(data).rules || [];
  };
  
  // 写入规则
  const writeRules = async (rules) => {
    await fs.writeFile(rulesFile, JSON.stringify({ rules }, null, 2));
  };
  
  // 获取所有规则
  router.get('/rules', async (req, res, next) => {
    try {
      const rules = await readRules();
      res.json({ ok: true, rules });
    } catch (err) {
      next(err);
    }
  });
  
  // 添加规则
  router.post('/rules', async (req, res, next) => {
    try {
      const { name, mode, source, target, keepQuery } = req.body;
      
      if (!source || !target) {
        return res.status(400).json({ ok: false, error: '缺少必要参数' });
      }
      
      const rules = await readRules();
      
      // 检查源路径是否已存在
      if (rules.some(r => r.source === source)) {
        return res.status(400).json({ ok: false, error: '源路径已存在' });
      }
      
      const newRule = {
        id: Date.now().toString(),
        name: name || '',
        mode: mode || 'redirect',
        source,
        target,
        keepQuery: keepQuery !== false,
        createdAt: new Date().toISOString()
      };
      
      rules.push(newRule);
      await writeRules(rules);
      
      res.json({ ok: true, rule: newRule });
    } catch (err) {
      next(err);
    }
  });
  
  // 更新规则
  router.put('/rules/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, mode, source, target, endpoint } = req.body;
      
      // 验证必要参数
      if (!source || !target) {
        return res.status(400).json({ ok: false, error: '缺少必要参数' });
      }
      
      const rules = await readRules();
      const index = rules.findIndex(r => r.id === id);
      
      if (index === -1) {
        return res.status(404).json({ ok: false, error: '规则不存在' });
      }
      
      // 防止源路径冲突 - 最佳实践：在修改前验证唯一性约束
      const hasConflict = rules.some((r, i) => i !== index && r.source === source);
      if (hasConflict) {
        return res.status(400).json({ ok: false, error: '源路径已存在' });
      }
      
      rules[index] = {
        ...rules[index],
        name: name || '',
        mode: mode || 'redirect',
        source,
        target,
        endpoint,
        updatedAt: new Date().toISOString()
      };
      
      await writeRules(rules);
      res.json({ ok: true, rule: rules[index] });
    } catch (err) {
      next(err);
    }
  });
  
  // 删除规则
  router.delete('/rules/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const rules = await readRules();
      const filtered = rules.filter(r => r.id !== id);
      
      if (filtered.length === rules.length) {
        return res.status(404).json({ ok: false, error: '规则不存在' });
      }
      
      await writeRules(filtered);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });
  
  return router;
};

module.exports = { createRouter };

