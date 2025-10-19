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
const ORDER_FILE = path.join(UPLOAD_DIR, '.collections-order.json');

// 常量配置
const MAX_LOGS = 1000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg)$/i;

// 请求日志存储（内存）
const requestLogs = [];

// 图床顺序管理
function loadCollectionsOrder() {
  try {
    if (fs.existsSync(ORDER_FILE)) {
      const data = fs.readFileSync(ORDER_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch(err) {
    console.error('读取顺序文件失败:', err);
  }
  return [];
}

function saveCollectionsOrder(order) {
  try {
    fs.writeFileSync(ORDER_FILE, JSON.stringify(order, null, 2), 'utf8');
  } catch(err) {
    console.error('保存顺序文件失败:', err);
  }
}

function getOrderedCollections() {
  ensureDirectoryExists(UPLOAD_DIR);
  const allCollections = fs.readdirSync(UPLOAD_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  
  const savedOrder = loadCollectionsOrder();
  const allSet = new Set(allCollections);
  
  // 合并保存的顺序和实际存在的图床
  const ordered = savedOrder.filter(name => allSet.has(name));
  const orderedSet = new Set(ordered);
  
  // 添加新的图床（不在保存顺序中的）
  const newCollections = allCollections.filter(name => !orderedSet.has(name));
  
  return [...ordered, ...newCollections];
}

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

function createLogEntry(req, status, duration, responseSize = 0, isRandom = false) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
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
    success: status >= 200 && status < 400,
    isRandom
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

// 修复文件名编码问题（multer可能将UTF-8误解析为Latin-1）
function fixFilenameEncoding(filename) {
  try {
    // 尝试修复编码：将Latin-1转回UTF-8
    const buffer = Buffer.from(filename, 'latin1');
    return buffer.toString('utf8');
  } catch(err) {
    // 如果转换失败，返回原始文件名
    console.warn('文件名编码修复失败:', err);
    return filename;
  }
}

// 生成不冲突的文件名
function generateUniqueFilename(dir, originalFilename) {
  // 先修复编码
  const fixedFilename = fixFilenameEncoding(originalFilename);
  
  const ext = path.extname(fixedFilename);
  const nameWithoutExt = path.basename(fixedFilename, ext);
  
  let filename = fixedFilename;
  let counter = 1;
  
  // 如果文件已存在，添加序号
  while (fs.existsSync(path.join(dir, filename))) {
    filename = `${nameWithoutExt}(${counter})${ext}`;
    counter++;
  }
  
  return filename;
}

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
    const collectionName = req.params.collection || req.body.collection;
    const collectionDir = path.join(UPLOAD_DIR, collectionName);
    const replaceMode = req.query.replace === 'true';
    
    // 替换模式：直接使用原始文件名（修复编码）
    // 非替换模式：自动生成不冲突的文件名
    const filename = replaceMode 
      ? fixFilenameEncoding(file.originalname)
      : generateUniqueFilename(collectionDir, file.originalname);
    
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    // 接受所有文件，但标记无效的文件
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // 跳过无效文件，而不是抛出错误
      const fixedName = fixFilenameEncoding(file.originalname);
      console.warn(`跳过无效文件类型: ${fixedName} (${file.mimetype})`);
      cb(null, false);
    }
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
    
    // 添加到顺序列表末尾
    const order = loadCollectionsOrder();
    if (!order.includes(collectionName)) {
      order.push(collectionName);
      saveCollectionsOrder(order);
    }
    
    res.json({ message: '集合创建成功', collection: collectionName });
  } catch(err) {
    console.error('创建集合失败:', err);
    res.status(500).json({ error: '创建集合失败' });
  }
});

// 重命名集合
app.put('/api/collections/:collection', (req, res) => {
  const oldName = req.params.collection;
  const { newName } = req.body;
  
  if (!newName || !newName.trim()) {
    return res.status(400).json({ error: '新集合名不能为空' });
  }
  
  const oldDir = path.join(UPLOAD_DIR, oldName);
  const newDir = path.join(UPLOAD_DIR, newName);
  
  if (!fs.existsSync(oldDir)) {
    return res.status(404).json({ error: '集合不存在' });
  }
  
  if (fs.existsSync(newDir)) {
    return res.status(400).json({ error: '新集合名已存在' });
  }
  
  try {
    fs.renameSync(oldDir, newDir);
    
    // 更新顺序列表中的名称
    const order = loadCollectionsOrder();
    const index = order.indexOf(oldName);
    if (index !== -1) {
      order[index] = newName;
      saveCollectionsOrder(order);
    }
    
    res.json({ message: '集合重命名成功', oldName, newName });
  } catch(err) {
    console.error('重命名集合失败:', err);
    res.status(500).json({ error: '重命名集合失败' });
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
    
    // 从顺序列表中移除
    const order = loadCollectionsOrder();
    const index = order.indexOf(collectionName);
    if (index !== -1) {
      order.splice(index, 1);
      saveCollectionsOrder(order);
    }
    
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

// 检查文件冲突
app.post('/api/check-conflicts/:collection', (req, res) => {
  const collectionName = req.params.collection;
  const { filenames } = req.body;
  
  if (!collectionName || !Array.isArray(filenames)) {
    return res.status(400).json({ error: '参数错误' });
  }
  
  const collectionDir = path.join(UPLOAD_DIR, collectionName);
  if (!fs.existsSync(collectionDir)) {
    return res.json({ conflicts: [] });
  }
  
  // 获取目录中所有现有文件
  const existingFiles = getImageFiles(collectionDir);
  console.log('现有文件:', existingFiles);
  console.log('上传文件名:', filenames);
  
  // 检查哪些文件名已经存在
  const conflicts = filenames.filter(filename => {
    // 检查是否存在完全匹配的文件名
    return existingFiles.includes(filename);
  });
  
  console.log('检测到冲突文件:', conflicts);
  res.json({ conflicts });
});

// 上传接口（支持替换模式）
app.post('/upload/:collection?', upload.array('files', 20), (req, res) => {
  const collectionName = req.params.collection || req.body.collection;
  const replaceMode = req.query.replace === 'true';
  
  if (!collectionName) {
    return res.status(400).json({ error: '缺少集合名' });
  }
  
  const files = (req.files || []).map(f => ({
    filename: path.basename(f.filename),
    url: `/${collectionName}/${path.basename(f.filename)}`
  }));
  
  res.json({ collection: collectionName, count: files.length, files, replaced: replaceMode });
});

// 保存集合顺序
app.post('/api/collections-order', (req, res) => {
  const { order } = req.body;
  
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: '顺序必须是数组' });
  }
  
  try {
    saveCollectionsOrder(order);
    res.json({ message: '顺序保存成功', order });
  } catch(err) {
    console.error('保存顺序失败:', err);
    res.status(500).json({ error: '保存顺序失败' });
  }
});

// 列出所有集合（按顺序）
app.get('/collections', (req, res) => {
  const collections = getOrderedCollections();
  res.json({ collections });
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
    urls: images.map(n => `/${req.params.collection}/${n}`)
  });
});

// ========== 静态资源 ==========
app.use(express.static(PUBLIC_DIR, { maxAge: '1h', extensions: ['html'] }));

// ========== 其他路由 ==========

// 图片文件访问（需要在随机图片路由之前）
app.get('/:collection/:filename', (req, res, next) => {
  const { collection, filename } = req.params;
  const filePath = path.join(UPLOAD_DIR, collection, filename);
  
  // 检查文件是否存在且是图片
  if (fs.existsSync(filePath) && IMAGE_EXTENSIONS.test(filename)) {
    const startTime = Date.now();
    const isRandom = req.query.random === '1';
    const isGallery = req.query.gallery === '1';
    
    // 在文件发送完成后记录日志（画廊预览不记录）
    res.sendFile(filePath, (err) => {
      // 画廊预览请求不记录日志
      if (isGallery) return;
      
      const duration = Date.now() - startTime;
      if (err) {
        addLog(createLogEntry(req, 500, duration, 0, isRandom));
      } else {
        const stats = fs.statSync(filePath);
        addLog(createLogEntry(req, 200, duration, stats.size, isRandom));
      }
    });
    return;
  }
  
  next();
});

// 随机图片
app.get('/:collection', (req, res, next) => {
  const collection = req.params.collection;
  const collectionDir = path.join(UPLOAD_DIR, collection);
  
  if (!fs.existsSync(collectionDir)) {
    return next();
  }
  
  const images = getImageFiles(collectionDir);
  
  if (images.length === 0) {
    return res.status(404).send('该集合下没有图片');
  }
  
  const randomImage = images[Math.floor(Math.random() * images.length)];
  
  // 不记录重定向日志，只记录最终访问的图片日志（在图片访问路由中）
  res.redirect(`/${collection}/${randomImage}?random=1`);
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
