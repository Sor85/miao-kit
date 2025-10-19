const fs = require('fs');
const path = require('path');

/** @param {string} targetPath */
const ensureDir = (targetPath) => 
  !fs.existsSync(targetPath) && fs.mkdirSync(targetPath, { recursive: true });

/** @param {string} filename */
const fixEncoding = (filename) => {
  try {
    return Buffer.from(filename, 'latin1').toString('utf8');
  } catch {
    return filename;
  }
};

/**
 * @param {string} dir
 * @param {string} originalFilename
 * @returns {string}
 */
const generateUniqueName = (dir, originalFilename) => {
  const fixedName = fixEncoding(originalFilename);
  const ext = path.extname(fixedName);
  const baseName = path.basename(fixedName, ext);
  
  let counter = 1;
  let filename = fixedName;
  
  while (fs.existsSync(path.join(dir, filename))) {
    filename = `${baseName}(${counter++})${ext}`;
  }
  
  return filename;
};

/**
 * @param {string} dir
 * @param {RegExp} pattern
 * @returns {string[]}
 */
const getFiles = (dir, pattern) =>
  fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isFile() && pattern.test(d.name))
    .map(d => d.name);

/**
 * @param {string} dir
 * @returns {string[]}
 */
const getDirs = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

module.exports = { ensureDir, fixEncoding, generateUniqueName, getFiles, getDirs };

