const express = require('express');
const fs = require('fs');
const path = require('path');
const { ensureDir, getDirs, getFiles } = require('../utils/file');
const { loadOrder, saveOrder, mergeOrder } = require('../utils/order');

/**
 * @param {Object} deps
 * @param {string} deps.uploadDir
 * @param {string} deps.orderFile
 * @param {RegExp} deps.imageExtensions
 * @returns {express.Router}
 */
const createRouter = ({ uploadDir, orderFile, imageExtensions }) => {
  const router = express.Router();

  // 获取所有图床（按顺序）
  router.get('/', (req, res) => {
    ensureDir(uploadDir);
    const allCollections = getDirs(uploadDir);
    const savedOrder = loadOrder(orderFile);
    const collections = mergeOrder(allCollections, savedOrder);
    res.json({ collections });
  });

  // 获取图床详情
  router.get('/:collection', (req, res) => {
    const collectionDir = path.join(uploadDir, req.params.collection);
    
    if (!fs.existsSync(collectionDir)) {
      return res.status(404).json({ error: '图床不存在' });
    }
    
    const images = getFiles(collectionDir, imageExtensions);
    res.json({
      collection: req.params.collection,
      images,
      urls: images.map(n => `/${req.params.collection}/${n}`)
    });
  });

  return router;
};

module.exports = { createRouter };

