#!/bin/sh
# frontend/entrypoint.sh

# Устанавливаем значение по умолчанию, если переменная не задана
BACKEND_URL_FROM_ENV=${VITE_BACKEND_URL_RUNTIME:-http://localhost:8000/api_placeholder}

echo "Setting backend URL in JS files to: $BACKEND_URL_FROM_ENV"

# Находим все .js файлы в /usr/share/nginx/html (или в /usr/share/nginx/html/assets, если Vite кладет туда)
# и заменяем плейсхолдер __BACKEND_URL__ на значение из переменной окружения
# Важно: плейсхолдер должен быть уникальным и не встречаться где-то еще.
# Лучше искать в конкретных файлах, если известно их имя.
find /usr/share/nginx/html -type f -name '*.js' -exec sed -i "s|__BACKEND_URL__|${BACKEND_URL_FROM_ENV}|g" {} +
find /usr/share/nginx/html -type f -name '*.html' -exec sed -i "s|__BACKEND_URL__|${BACKEND_URL_FROM_ENV}|g" {} + # Если есть в index.html

echo "Placeholder replacement complete. Starting Nginx..."
# Запускаем nginx после замены
exec nginx -g 'daemon off;'