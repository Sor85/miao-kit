const express = require('express');
const fs = require('fs');
const path = require('path');
const { getFiles } = require('../utils/file');

/**
 * @param {Object} deps
 * @param {string} deps.uploadDir
 * @param {RegExp} deps.imageExtensions
 * @returns {express.Router}
 */
const createRouter = ({ uploadDir, imageExtensions }) => {
  const router = express.Router();

  // 删除图片
  router.delete('/:collection/:filename', (req, res) => {
    const { collection, filename } = req.params;
    const filePath = path.join(uploadDir, collection, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '图片不存在' });
    }
    
    try {
      fs.unlinkSync(filePath);
      res.json({ message: '图片删除成功', filename });
    } catch(err) {
      console.error('删除图片失败:', err);
      res.status(500).json({ error: '删除图片失败' });
    }
  });

  // 检查文件冲突
  router.post('/check-conflicts/:collection', (req, res) => {
    const { collection } = req.params;
    const { filenames } = req.body;
    
    if (!collection || !Array.isArray(filenames)) {
      return res.status(400).json({ error: '参数错误' });
    }
    
    const collectionDir = path.join(uploadDir, collection);
    if (!fs.existsSync(collectionDir)) {
      return res.json({ conflicts: [] });
    }
    
    const existingFiles = getFiles(collectionDir, imageExtensions);
    const conflicts = filenames.filter(name => existingFiles.includes(name));
    
    res.json({ conflicts });
  });

  return router;
};

module.exports = { createRouter };

