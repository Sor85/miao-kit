FROM node:20-alpine

WORKDIR /app

# 仅复制必要文件以优化缓存
COPY package.json package-lock.json* ./
RUN npm install --production --no-audit --no-fund

COPY . .

# 创建上传目录（持久化建议挂载 Volume）
RUN mkdir -p public/uploads

EXPOSE 3000

ENV PORT=3000

CMD ["npm", "start"]


