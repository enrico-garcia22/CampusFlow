FROM node:22-bookworm-slim
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY backend ./backend
COPY frontend ./frontend
COPY banco ./banco
WORKDIR /app/backend
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "src/server.js"]
