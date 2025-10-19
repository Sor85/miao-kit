const path = require('path');
const fs = require('fs');
const express = require('express');
const morgan = require('morgan');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// 路径配置
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');

// 常量配置
const MAX_LOGS = 1000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg)$/i;

// 请求日志存储（内存）
const requestLogs = [];

// 工具函数
function ensureDirectoryExists(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
}

function addLog(logData) {
  requestLogs.unshift(logData);
  if (requestLogs.length > MAX_LOGS) {
    requestLogs.pop();
  }
  console.log(`[LOG] ${logData.method} ${logData.path} - ${logData.status} (${logData.duration})`);
}

function createLogEntry(req, status, duration, responseSize = 0) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    query: req.query,
    status,
    duration: `${duration}ms`,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent') || '',
    requestBody: req.body && Object.keys(req.body).length > 0 ? req.body : null,
    responseSize: String(responseSize),
    success: status >= 200 && status < 400
  };
}

function getImageFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isFile())
    .map(d => d.name)
    .filter(name => IMAGE_EXTENSIONS.test(name));
}

// 初始化
ensureDirectoryExists(PUBLIC_DIR);
ensureDirectoryExists(UPLOAD_DIR);

// 中间件
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 上传日志中间件
app.use((req, res, next) => {
  if (!req.path.startsWith('/upload')) {
    return next();
  }

  const startTime = Date.now();
  const originalJson = res.json;
  let responseSize = 0;

  res.json = function(data) {
    responseSize = JSON.stringify(data).length;
    return originalJson.call(this, data);
  };

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    addLog(createLogEntry(req, res.statusCode, duration, responseSize));
  });

  next();
});

// Multer 配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const collectionName = req.params.collection || req.body.collection;
    if (!collectionName) {
      return cb(new Error('缺少集合名'));
    }
    const collectionDir = path.join(UPLOAD_DIR, collectionName);
    ensureDirectoryExists(collectionDir);
    cb(null, collectionDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${base}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('不支持的文件类型'));
  }
});

// ========== API 路由 ==========

// 创建集合
app.post('/api/collections/:collection', (req, res) => {
  const collectionName = req.params.collection;
  
  if (!collectionName || !collectionName.trim()) {
    return res.status(400).json({ error: '集合名不能为空' });
  }
  
  const collectionDir = path.join(UPLOAD_DIR, collectionName);
  
  if (fs.existsSync(collectionDir)) {
    return res.status(400).json({ error: '集合已存在' });
  }
  
  try {
    ensureDirectoryExists(collectionDir);
    res.json({ message: '集合创建成功', collection: collectionName });
  } catch(err) {
    console.error('创建集合失败:', err);
    res.status(500).json({ error: '创建集合失败' });
  }
});

// 删除集合
app.delete('/api/collections/:collection', (req, res) => {
  const collectionName = req.params.collection;
  const collectionDir = path.join(UPLOAD_DIR, collectionName);
  
  if (!fs.existsSync(collectionDir)) {
    return res.status(404).json({ error: '集合不存在' });
  }
  
  try {
    fs.rmSync(collectionDir, { recursive: true, force: true });
    res.json({ message: '集合删除成功', collection: collectionName });
  } catch(err) {
    console.error('删除集合失败:', err);
    res.status(500).json({ error: '删除集合失败' });
  }
});

// 删除图片
app.delete('/api/images/:collection/:filename', (req, res) => {
  const { collection, filename } = req.params;
  const filePath = path.join(UPLOAD_DIR, collection, filename);
  
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

// 获取请求日志列表
app.get('/api/logs', (req, res) => {
  const { limit = 50, method, status, collection, timeRange } = req.query;
  
  let filtered = [...requestLogs];
  
  // 按时间范围筛选
  if (timeRange && timeRange !== 'all') {
    const hours = parseInt(timeRange, 10);
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    filtered = filtered.filter(log => new Date(log.timestamp) >= cutoffTime);
  }
  
  // 按方法筛选
  if (method && method !== 'all') {
    filtered = filtered.filter(log => log.method === method.toUpperCase());
  }
  
  // 按状态筛选
  if (status === 'success') {
    filtered = filtered.filter(log => log.success);
  } else if (status === 'error') {
    filtered = filtered.filter(log => !log.success);
  }
  
  // 按集合筛选
  if (collection && collection !== 'all') {
    filtered = filtered.filter(log => log.path.includes(`/${collection}`));
  }
  
  // 限制数量
  filtered = filtered.slice(0, parseInt(limit, 10) || 50);
  
  // 统计
  const stats = {
    total: requestLogs.length,
    success: requestLogs.filter(log => log.success).length,
    error: requestLogs.filter(log => !log.success).length,
    methods: {
      GET: requestLogs.filter(log => log.method === 'GET').length,
      POST: requestLogs.filter(log => log.method === 'POST').length
    }
  };
  
  res.json({ logs: filtered, stats, filtered: filtered.length });
});

// 获取单条日志详情
app.get('/api/logs/:id', (req, res) => {
  const log = requestLogs.find(l => l.id === req.params.id);
  if (!log) {
    return res.status(404).json({ error: '日志不存在' });
  }
  res.json(log);
});

// 清空日志
app.delete('/api/logs', (req, res) => {
  const count = requestLogs.length;
  requestLogs.length = 0;
  res.json({ message: '日志已清空', count });
});

// 上传接口
app.post('/upload/:collection?', upload.array('files', 20), (req, res) => {
  const collectionName = req.params.collection || req.body.collection;
  if (!collectionName) {
    return res.status(400).json({ error: '缺少集合名' });
  }
  
  const files = (req.files || []).map(f => ({
    filename: path.basename(f.filename),
    url: `/uploads/${collectionName}/${path.basename(f.filename)}`
  }));
  
  res.json({ collection: collectionName, count: files.length, files });
});

// 列出所有集合
app.get('/collections', (req, res) => {
  ensureDirectoryExists(UPLOAD_DIR);
  const items = fs.readdirSync(UPLOAD_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  res.json({ collections: items });
});

// 列出某集合的图片
app.get('/collections/:collection', (req, res) => {
  const collectionDir = path.join(UPLOAD_DIR, req.params.collection);
  
  if (!fs.existsSync(collectionDir)) {
    return res.status(404).json({ error: '集合不存在' });
  }
  
  const images = getImageFiles(collectionDir);
  res.json({
    collection: req.params.collection,
    images,
    urls: images.map(n => `/uploads/${req.params.collection}/${n}`)
  });
});

// ========== 静态资源 ==========
app.use(express.static(PUBLIC_DIR, { maxAge: '1h', extensions: ['html'] }));

// ========== 其他路由 ==========

// 随机图片
app.get('/:collection', (req, res, next) => {
  const collection = req.params.collection;
  const collectionDir = path.join(UPLOAD_DIR, collection);
  
  if (!fs.existsSync(collectionDir)) {
    return next();
  }
  
  const startTime = Date.now();
  const images = getImageFiles(collectionDir);
  
  if (images.length === 0) {
    return res.status(404).send('该集合下没有图片');
  }
  
  const randomImage = images[Math.floor(Math.random() * images.length)];
  const duration = Date.now() - startTime;
  
  // 记录日志
  addLog(createLogEntry(req, 302, duration, 0));
  
  res.redirect(`/uploads/${collection}/${randomImage}`);
});

// 首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 400).json({ error: err.message || '请求错误' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Server started at http://0.0.0.0:${PORT}`);
  console.log(`📁 Upload directory: ${UPLOAD_DIR}`);
  console.log('📋 API Routes:');
  console.log('  POST /api/collections/:collection - 创建集合');
  console.log('  GET  /api/logs - 获取日志');
  console.log('  POST /upload/:collection - 上传图片');
  console.log('  GET  /collections - 列出集合');
  console.log('  GET  /:collection - 随机图片');
});
