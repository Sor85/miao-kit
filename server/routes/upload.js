const express = require('express');
const path = require('path');

/**
 * @param {Object} deps
 * @param {Function} deps.uploader
 * @returns {express.Router}
 */
const createRouter = ({ uploader }) => {
  const router = express.Router();

  router.post('/:collection?', uploader.array('files', 20), (req, res) => {
    const collectionName = req.params.collection || req.body.collection;
    const replaceMode = req.query.replace === 'true';
    
    if (!collectionName) {
      return res.status(400).json({ error: '缺少图床名' });
    }
    
    const files = (req.files || []).map(f => ({
      filename: path.basename(f.filename),
      url: `/${collectionName}/${path.basename(f.filename)}`
    }));
    
    res.json({ 
      collection: collectionName, 
      count: files.length, 
      files, 
      replaced: replaceMode 
    });
  });

  return router;
};

module.exports = { createRouter };

