const multer = require('multer');
const path = require('path');
const { ensureDir, fixEncoding, generateUniqueName } = require('../utils/file');

/**
 * @param {Object} options
 * @param {string} options.uploadDir
 * @param {number} options.maxFileSize
 * @param {string[]} options.allowedTypes
 * @returns {multer.Multer}
 */
const createUploader = ({ uploadDir, maxFileSize, allowedTypes }) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const collectionName = req.params.collection || req.body.collection;
      if (!collectionName) return cb(new Error('缺少图床名'));
      
      const collectionDir = path.join(uploadDir, collectionName);
      ensureDir(collectionDir);
      cb(null, collectionDir);
    },
    filename: (req, file, cb) => {
      const collectionName = req.params.collection || req.body.collection;
      const collectionDir = path.join(uploadDir, collectionName);
      const replaceMode = req.query.replace === 'true';
      
      const filename = replaceMode 
        ? fixEncoding(file.originalname)
        : generateUniqueName(collectionDir, file.originalname);
      
      cb(null, filename);
    }
  });

  return multer({
    storage,
    limits: { fileSize: maxFileSize },
    fileFilter: (req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        console.warn(`跳过无效文件: ${fixEncoding(file.originalname)} (${file.mimetype})`);
        cb(null, false);
      }
    }
  });
};

module.exports = { createUploader };

