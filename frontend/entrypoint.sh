#!/bin/sh
# frontend/entrypoint.sh

# Устанавливаем значение по умолчанию, если переменная не задана
# Используем VITE_BACKEND_URL_RUNTIME, которую мы задаем в Render.com
BACKEND_URL_FROM_ENV=${VITE_BACKEND_URL_RUNTIME:-http://localhost:8000/entrypoint_fallback}
PLACEHOLDER="__VITE_BACKEND_URL_PLACEHOLDER__"

echo "Entrypoint: Setting backend URL placeholder '$PLACEHOLDER' to '$BACKEND_URL_FROM_ENV' in index.html"

# Путь к index.html внутри контейнера Nginx
INDEX_HTML_PATH="/usr/share/nginx/html/index.html"

# Проверяем, существует ли файл перед заменой
if [ -f "$INDEX_HTML_PATH" ]; then
  # Используем другой разделитель (например, #) для sed, т.к. URL содержит /
  sed -i "s#${PLACEHOLDER}#${BACKEND_URL_FROM_ENV}#g" "$INDEX_HTML_PATH"
  echo "Entrypoint: Placeholder replacement in $INDEX_HTML_PATH complete."
else
  echo "Entrypoint Error: $INDEX_HTML_PATH not found!"
  # Выход с ошибкой, если index.html не найден, т.к. приложение не будет работать
  exit 1
fi

echo "Entrypoint: Starting Nginx..."
# Запускаем nginx после замены
exec nginx -g 'daemon off;'