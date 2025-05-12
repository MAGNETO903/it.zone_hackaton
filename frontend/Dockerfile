# frontend/Dockerfile

# --- Стадия сборки (Build Stage) ---
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# VITE_BACKEND_URL больше не используется здесь так явно при сборке
RUN npm run build

# --- Стадия раздачи (Serve Stage) ---
FROM nginx:1.25-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# (Опционально) COPY nginx.conf /etc/nginx/conf.d/default.conf

# Новый ENTRYPOINT для замены плейсхолдера
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
# CMD ["nginx", "-g", "daemon off;"] # Заменяем на entrypoint
ENTRYPOINT ["/entrypoint.sh"]