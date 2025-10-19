# 简易图床（支持按集合随机展示）

一个轻量级、无数据库依赖的图床服务，支持拖拽上传和随机图片展示。

## ✨ 特性

- 📁 **集合管理**：创建多个图片集合，分类存储
- 🖱️ **拖拽上传**：直接拖拽图片到集合卡片即可上传
- 🎲 **随机展示**：访问 `/:collection` 随机返回该集合中的任意图片
- 📊 **请求日志**：实时记录上传和访问操作，支持多维度筛选
- 🎨 **现代UI**：淡雅渐变设计，响应式布局
- 🐳 **Docker部署**：一键容器化部署

## 🚀 快速开始

### 方式一：本地 Node.js
```bash
npm install
npm start
# 访问 http://localhost:3000
```

### 方式二：Docker
```bash
# 构建镜像
docker build -t random-image-bed:latest .

# 运行容器（挂载数据目录以持久化）
docker run -d --name image-bed -p 3000:3000 \
  -v ${PWD}/public/uploads:/app/public/uploads \
  random-image-bed:latest

# 访问 http://localhost:3000
```

## 📖 使用说明

### 1. 创建集合
- 点击"创建集合"按钮
- 输入集合名称（如：风景、人物、美食等）

### 2. 上传图片
**拖拽上传**：直接将图片拖到集合卡片的拖拽区

**手动选择**：点击"上传图片"按钮选择文件

### 3. 访问图片
**随机访问**：`http://服务器IP:端口/集合名`
- 例如：`http://localhost:3000/风景` 会随机返回"风景"集合中的一张图片

**直接访问**：`http://服务器IP:端口/uploads/集合名/文件名`

### 4. 查看日志
- 自动记录所有上传和随机访问操作
- 支持按类型、状态、集合、时间范围筛选
- 每10秒自动刷新

## 📡 API 接口

### 集合管理
- `POST /api/collections/:collection` - 创建集合
- `GET /collections` - 列出所有集合
- `GET /collections/:collection` - 获取集合详情

### 图片上传
- `POST /upload/:collection` - 上传图片到指定集合
  - FormData: `files` (多文件)
  - 返回：上传文件信息

### 随机图片
- `GET /:collection` - 随机重定向到该集合的一张图片

### 日志查询
- `GET /api/logs` - 获取日志列表
  - 参数：`method`, `status`, `collection`, `timeRange`, `limit`
- `GET /api/logs/:id` - 获取单条日志详情
- `DELETE /api/logs` - 清空所有日志

## 📁 目录结构
```
.
├── server.js              # 后端服务（Express + Multer）
├── package.json           # 依赖配置
├── Dockerfile             # Docker 镜像
├── .dockerignore          # Docker 忽略文件
├── README.md              # 说明文档
└── public/
    ├── index.html         # 前端页面
    ├── assets/
    │   ├── css/
    │   │   └── styles.css # 样式表
    │   └── js/
    │       └── app.js     # 前端逻辑
    └── uploads/           # 图片存储目录
        ├── 集合1/
        ├── 集合2/
        └── ...
```

## ⚙️ 配置说明

### 环境变量
- `PORT`：服务端口，默认 3000

### 上传限制
- 单文件大小：10MB
- 支持格式：`jpg`, `jpeg`, `png`, `gif`, `webp`, `svg`
- 最多同时上传：20个文件

## 🎨 功能亮点

### 拖拽上传
- 支持多文件同时拖拽
- 拖拽时有视觉反馈
- 自动过滤非图片文件

### 请求日志
- 只记录核心操作（上传、随机访问）
- 实时筛选，无需点击按钮
- 淡雅渐变统计卡片
- 立体感筛选器设计

### 图片画廊
- 网格布局展示缩略图
- 懒加载优化性能
- 悬停显示操作按钮
- 一键查看原图

## 🔧 技术栈

- **后端**：Node.js + Express + Multer
- **前端**：原生 JavaScript + CSS3
- **存储**：文件系统（无数据库）
- **部署**：Docker

## 📝 注意事项

- 日志存储在内存中，重启服务器会丢失
- 建议生产环境将 `public/uploads` 挂载为持久化卷
- 自动刷新间隔为10秒，可在 `app.js` 中调整
- 时间范围默认为24小时

## 📄 开源协议

MIT License
