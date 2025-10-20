const express = require('express');
const fs = require('fs');
const path = require('path');
const { ensureDir } = require('../utils/file');
const { loadOrder, saveOrder } = require('../utils/order');

/**
 * @param {Object} deps
 * @param {string} deps.uploadDir
 * @param {string} deps.orderFile
 * @returns {express.Router}
 */
const createRouter = ({ uploadDir, orderFile }) => {
  const router = express.Router();

  // 创建图床
  router.post('/:collection', (req, res) => {
    const { collection } = req.params;
    
    if (!collection?.trim()) {
      return res.status(400).json({ error: '图床名不能为空' });
    }
    
    const collectionDir = path.join(uploadDir, collection);
    
    if (fs.existsSync(collectionDir)) {
      return res.status(400).json({ error: '图床已存在' });
    }
    
    try {
      ensureDir(collectionDir);
      
      const order = loadOrder(orderFile);
      const isNewCollection = !order.includes(collection);
      if (isNewCollection) {
        order.push(collection);
        saveOrder(orderFile, order);
      }
      
      res.json({ message: '图床创建成功', collection });
    } catch(err) {
      console.error('创建图床失败:', err);
      res.status(500).json({ error: '创建图床失败' });
    }
  });

  // 重命名图床
  router.put('/:collection', (req, res) => {
    const oldName = req.params.collection;
    const { newName } = req.body;
    
    if (!newName?.trim()) {
      return res.status(400).json({ error: '新图床名不能为空' });
    }
    
    const oldDir = path.join(uploadDir, oldName);
    const newDir = path.join(uploadDir, newName);
    
    if (!fs.existsSync(oldDir)) {
      return res.status(404).json({ error: '图床不存在' });
    }
    
    if (fs.existsSync(newDir)) {
      return res.status(400).json({ error: '新图床名已存在' });
    }
    
    try {
      fs.renameSync(oldDir, newDir);
      
      const order = loadOrder(orderFile);
      const index = order.indexOf(oldName);
      if (index !== -1) {
        order[index] = newName;
        saveOrder(orderFile, order);
      }
      
      res.json({ message: '图床重命名成功', oldName, newName });
    } catch(err) {
      console.error('重命名图床失败:', err);
      res.status(500).json({ error: '重命名图床失败' });
    }
  });

  // 删除图床
  router.delete('/:collection', (req, res) => {
    const { collection } = req.params;
    const collectionDir = path.join(uploadDir, collection);
    
    if (!fs.existsSync(collectionDir)) {
      return res.status(404).json({ error: '图床不存在' });
    }
    
    try {
      fs.rmSync(collectionDir, { recursive: true, force: true });
      
      const order = loadOrder(orderFile);
      const index = order.indexOf(collection);
      if (index !== -1) {
        order.splice(index, 1);
        saveOrder(orderFile, order);
      }
      
      res.json({ message: '图床删除成功', collection });
    } catch(err) {
      console.error('删除图床失败:', err);
      res.status(500).json({ error: '删除图床失败' });
    }
  });

  // 保存图床顺序
  router.post('/-order', (req, res) => {
    const { order } = req.body;
    
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: '顺序必须是数组' });
    }
    
    try {
      saveOrder(orderFile, order);
      res.json({ message: '顺序保存成功', order });
    } catch(err) {
      console.error('保存顺序失败:', err);
      res.status(500).json({ error: '保存顺序失败' });
    }
  });

  return router;
};

module.exports = { createRouter };

