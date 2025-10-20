/**
 * @typedef {Object} AppConfig
 * @property {number} PORT - 服务器端口
 * @property {string} PUBLIC_DIR - 公共目录路径
 * @property {string} UPLOAD_DIR - 上传目录路径
 * @property {string} ORDER_FILE - 顺序文件路径
 * @property {number} MAX_LOGS - 最大日志数量
 * @property {number} MAX_FILE_SIZE - 最大文件大小
 * @property {string[]} ALLOWED_TYPES - 允许的文件类型
 * @property {RegExp} IMAGE_EXTENSIONS - 图片扩展名正则
 */

const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');

/** @type {AppConfig} */
const config = {
  PORT: process.env.PORT || 3000,
  PUBLIC_DIR,
  UPLOAD_DIR,
  ORDER_FILE: path.join(UPLOAD_DIR, '.collections-order.json'),
  RULES_FILE: path.join(ROOT_DIR, 'forward-rules.json'),
  MAX_LOGS: 1000,
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  IMAGE_EXTENSIONS: /\.(jpg|jpeg|png|gif|webp|svg)$/i
};

module.exports = config;

