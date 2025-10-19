const express = require('express');
const fs = require('fs');
const path = require('path');
const { getFiles } = require('../utils/file');
const { createEntry, addLog } = require('../utils/log');

/**
 * @param {Object} deps
 * @param {string} deps.uploadDir
 * @param {RegExp} deps.imageExtensions
 * @param {number} deps.maxLogs
 * @returns {express.Router}
 */
const createRouter = ({ uploadDir, imageExtensions, maxLogs }) => {
  const router = express.Router();

  // 直接访问图片
  router.get('/:collection/:filename', (req, res, next) => {
    const { collection, filename } = req.params;
    const filePath = path.join(uploadDir, collection, filename);
    
    if (fs.existsSync(filePath) && imageExtensions.test(filename)) {
      const startTime = Date.now();
      const isRandom = req.query.random === '1';
      const isGallery = req.query.gallery === '1';
      
      res.sendFile(filePath, (err) => {
        if (isGallery) return;
        
        const duration = Date.now() - startTime;
        if (err) {
          addLog(createEntry(req, 500, duration, 0, isRandom), maxLogs);
        } else {
          const stats = fs.statSync(filePath);
          addLog(createEntry(req, 200, duration, stats.size, isRandom), maxLogs);
        }
      });
      return;
    }
    
    next();
  });

  // 随机图片
  router.get('/:collection', (req, res, next) => {
    const { collection } = req.params;
    const collectionDir = path.join(uploadDir, collection);
    
    if (!fs.existsSync(collectionDir)) return next();
    
    const images = getFiles(collectionDir, imageExtensions);
    
    if (images.length === 0) {
      return res.status(404).send('该图床下没有图片');
    }
    
    const randomImage = images[Math.floor(Math.random() * images.length)];
    res.redirect(`/${collection}/${randomImage}?random=1`);
  });

  return router;
};

module.exports = { createRouter };

