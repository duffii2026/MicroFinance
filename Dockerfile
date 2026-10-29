FROM node:22-alpine AS frontend
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY index.html module-entry.html vite.config.js ./
COPY src ./src
COPY public ./public
RUN pnpm build

FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY --from=frontend /app/dist ./dist
EXPOSE 8080
CMD ["python", "server.py"]
