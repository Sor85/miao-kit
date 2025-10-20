FROM node:20-alpine

WORKDIR /app

# 仅复制必要文件以优化缓存
COPY package.json package-lock.json* ./
RUN npm install --production --no-audit --no-fund

COPY . .

# 创建上传目录和转发规则文件（如果不存在）
RUN mkdir -p public/uploads && \
    test -f forward-rules.json || echo '{"rules":[]}' > forward-rules.json

# 设置文件权限，确保宿主机可以访问容器创建的文件
# 99:100 是 nobody:nogroup，775 允许任何人读写执行
RUN chown -R 99:100 /app && \
    chmod -R 775 /app

# 使用非 root 用户运行
USER 99:100

EXPOSE 3000

ENV PORT=3000

CMD ["npm", "start"]


