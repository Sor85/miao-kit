# 简易图床（支持多图床随机展示）

一个轻量级、无数据库依赖的图床服务，支持拖拽上传和随机图片展示。

## ✨ 特性

- 📁 **图床管理**：创建多个图床，分类存储
- 🖱️ **拖拽上传**：直接拖拽图片到图床卡片即可上传（支持折叠状态上传）
- 🎲 **随机展示**：访问 `/:collection` 随机返回该图床中的任意图片
- 📊 **请求日志**：实时记录上传和访问操作，支持多维度筛选
- 🖼️ **批量管理**：支持批量删除图片，复选框悬停显示
- 🔄 **重复检测**：上传重复文件时提示替换或重命名
- 📝 **中文支持**：完整支持中文文件名，保留原始文件名
- 🎯 **拖拽排序**：支持拖拽手柄自定义图床顺序
- 🎨 **现代UI**：淡雅渐变设计，响应式布局
- 🐳 **Docker部署**：一键容器化部署

## 📷 演示截图

<div align="center">

### 主界面 - 图床管理
![主界面](docs/screenshot-1.png)
![主界面](docs/screenshot-2.png)

</div>

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

### 1. 创建图床
- 点击"创建图床"按钮
- 输入图床名称（如：风景、人物、美食等）
- 支持拖拽移动图床位置（点击顶部小横条拖拽）

### 2. 上传图片
**拖拽上传**：
- 直接将图片拖到图床卡片（支持折叠状态）
- 支持多文件同时上传
- 自动检测重复文件，提示替换或重命名

**手动选择**：点击"上传图片"按钮选择文件

### 3. 图片管理
**浏览图片**：点击"浏览图床"查看所有图片

**批量删除**：
- 悬停图片显示复选框
- 勾选后出现"全选"和"删除选中"按钮
- 支持批量删除操作

**单张删除**：悬停图片点击删除按钮

### 4. 访问图片
**随机访问**：`http://服务器IP:端口/图床名`
- 例如：`http://localhost:3000/风景` 会随机返回"风景"图床中的一张图片
- 日志中会标记"随机"标识

**直接访问**：`http://服务器IP:端口/图床名/文件名`
- 例如：`http://localhost:3000/风景/美景.jpg`
- 完整支持中文文件名

### 5. 查看日志
- 自动记录上传和图片访问操作（不包括画廊预览）
- 支持按类型、状态、图床、时间范围筛选
- 每10秒自动刷新
- URL自动解码显示中文

## 📡 API 接口

### 图床管理
- `POST /api/collections/:collection` - 创建图床
- `PUT /api/collections/:collection` - 重命名图床
- `DELETE /api/collections/:collection` - 删除图床
- `GET /collections` - 列出所有图床（按自定义顺序）
- `GET /collections/:collection` - 获取图床详情
- `POST /api/collections-order` - 保存图床排序

### 图片上传
- `POST /upload/:collection` - 上传图片到指定图床
  - FormData: `files` (多文件)
  - Query: `replace=true` (替换模式，覆盖同名文件)
  - 返回：上传文件信息
- `POST /api/check-conflicts/:collection` - 检查文件名冲突
  - Body: `{ filenames: [] }`
  - 返回：冲突的文件名列表

### 图片管理
- `DELETE /api/images/:collection/:filename` - 删除单张图片

### 图片访问
- `GET /:collection` - 随机重定向到该图床的一张图片
- `GET /:collection/:filename` - 直接访问指定图片

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
        ├── 图床1/
        ├── 图床2/
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

### 智能上传
- 支持多文件同时拖拽（折叠状态也可上传）
- 重复文件自动检测，提示替换或重命名
- 拖拽时有视觉反馈
- 自动过滤非图片文件
- 完整支持中文文件名

### 图片管理
- 批量删除：复选框悬停显示，避免误触
- 全选支持半选状态
- 拖拽排序：通过顶部小横条拖动
- 自动折叠：超过3个图床自动折叠
- 折叠状态持久化

### 请求日志
- 只记录有效操作（上传、随机访问、直接访问）
- 画廊预览不计入日志，避免日志混乱
- 实时筛选，无需点击按钮
- 淡雅渐变统计卡片
- 随机访问标记徽章
- URL自动解码中文

### 图片画廊
- 网格布局展示缩略图
- 懒加载优化性能
- 批量管理：悬停显示复选框
- 一键查看原图

## 🔧 技术栈

- **后端**：Node.js + Express + Multer
- **前端**：原生 JavaScript + CSS3
- **存储**：文件系统（无数据库）
- **部署**：Docker

## 🙏 致谢

前端 UI 设计与交互借鉴了 [newapi-special-test](https://github.com/CookSleep/newapi-special-test) 项目，感谢原作者的优秀设计！

## 📝 注意事项

- 日志存储在内存中，重启服务器会丢失
- 图床顺序和折叠状态保存在本地存储（浏览器）
- 建议生产环境将 `public/uploads` 挂载为持久化卷
- 自动刷新间隔为10秒，可在 `app.js` 中调整
- 时间范围默认为24小时
- 完整支持中文文件名和路径
- 替换模式会直接覆盖同名文件，请谨慎使用

## 📄 开源协议

MIT License
