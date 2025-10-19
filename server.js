const path = require('path');
const express = require('express');
const morgan = require('morgan');

const config = require('./server/config');
const { ensureDir } = require('./server/utils/file');
const { uploadLogger } = require('./server/middleware/logger');
const { createUploader } = require('./server/middleware/upload');

const app = express();

// 初始化目录
ensureDir(config.PUBLIC_DIR);
ensureDir(config.UPLOAD_DIR);

// 中间件
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(uploadLogger(config.MAX_LOGS));

// 上传器
const uploader = createUploader({
  uploadDir: config.UPLOAD_DIR,
  maxFileSize: config.MAX_FILE_SIZE,
  allowedTypes: config.ALLOWED_TYPES
});

// API 路由
app.use('/api/collections', require('./server/routes/api-collections').createRouter({
  uploadDir: config.UPLOAD_DIR,
  orderFile: config.ORDER_FILE
}));

app.use('/api/images', require('./server/routes/api-images').createRouter({
  uploadDir: config.UPLOAD_DIR,
  imageExtensions: config.IMAGE_EXTENSIONS
}));

app.use('/api/logs', require('./server/routes/api-logs').createRouter());

app.use('/upload', require('./server/routes/upload').createRouter({ uploader }));

// 静态资源
app.use(express.static(config.PUBLIC_DIR, { maxAge: '1h', extensions: ['html'] }));

// 图床路由
app.use('/collections', require('./server/routes/collections').createRouter({
  uploadDir: config.UPLOAD_DIR,
  orderFile: config.ORDER_FILE,
  imageExtensions: config.IMAGE_EXTENSIONS
}));

// 图片路由（需要放在最后）
app.use('/', require('./server/routes/images').createRouter({
  uploadDir: config.UPLOAD_DIR,
  imageExtensions: config.IMAGE_EXTENSIONS,
  maxLogs: config.MAX_LOGS
}));

// 错误处理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 400).json({ error: err.message || '请求错误' });
});

// 启动服务器
app.listen(config.PORT, () => {
  console.log(`🚀 Server started at http://0.0.0.0:${config.PORT}`);
  console.log(`📁 Upload directory: ${config.UPLOAD_DIR}`);
});
