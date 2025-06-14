## Основные Возможности (Features)

**Попробуйте нашего бота в Telegram:** **[@MySuperLLMChat_bot](https://t.me/MySuperLLMChat_bot)**
*(Примечание: для корректной работы бота убедитесь, что наши сервера на Render.com активны.)*

LLM Chat TMA предоставляет богатый набор функций для эффективного и удобного взаимодействия с большими языковыми моделями:

**1. 🎨 Интуитивный Интерфейс в Стиле Мессенджера:**
    *   Привычный двухпанельный интерфейс (список чатов слева, активный чат справа).
    *   Плавная навигация и отзывчивый дизайн.
    *   Адаптация под мобильные устройства и десктопные клиенты Telegram.

**2. 🧠 Продвинутая Работа с LLM:**
    *   **Поддержка Нескольких Моделей:** Легкое переключение между различными LLM (например, Llama3, Gemma, Mixtral от Groq) для каждого диалога.
    *   **Стриминг Ответов:** Ответы от моделей отображаются в реальном времени, токен за токеном, создавая ощущение живого диалога.
    *   **Системные Промпты:** Возможность задать кастомные инструкции, роль или контекст для LLM на уровне всего чата через удобное модальное окно. Это позволяет тонко настраивать поведение модели.

**3. 📝 Управление Диалогами:**
    *   **Создание и Удаление Чатов:** Простое управление списком диалогов.
    *   **Активный Чат:** Четкое выделение текущего активного диалога.
    *   **Автоматическое Именование Чатов:** Новый чат автоматически получает название на основе первого сообщения пользователя для быстрой идентификации.
    *   **Хранение Истории:** Все диалоги, включая сообщения и системные промпты, сохраняются локально в браузере (`localStorage`) для персистентности между сессиями.

**4. ✏️ Редактирование и Взаимодействие:**
    *   **Редактирование Сообщений Пользователя:** Возможность изменить свой предыдущий запрос. После сохранения отредактированного сообщения, диалог продолжается с этой новой точки, фактически создавая "ветвление" и позволяя уточнить или исправить запрос без начала нового чата.
    *   **Markdown Рендеринг:** Полноценное отображение форматированного текста от LLM:
        *   Списки (маркированные, нумерованные)
        *   Выделение (жирный, курсив, зачеркнутый)
        *   Цитаты
        *   Ссылки
        *   Таблицы (если поддерживается `remark-gfm`)
    *   **Подсветка Синтаксиса Кода:** Автоматическое определение языка (если указан) и красочная подсветка для блоков кода, что критически важно для разработчиков.
    *   **Копирование Блоков Кода:** Кнопка для быстрого копирования содержимого любого блока кода в буфер обмена.

**5. 🔗 Экспорт и Совместное Использование:**
    *   **Экспорт Диалога по Ссылке:** Генерация уникальной публичной ссылки, по которой можно просмотреть всю историю выбранного диалога в веб-браузере. Страница просмотра также адаптирована для чтения.

**6. 🧑‍💻 Пользовательский Опыт и Кастомизация:**
    *   **Адаптация к Теме Telegram:** Интерфейс Mini App автоматически подстраивается под текущую светлую или темную тему пользователя в Telegram, обеспечивая нативный вид.
    *   **Индикаторы Загрузки и Ошибок:** Понятная обратная связь о состоянии приложения (загрузка моделей, генерация ответа, ошибки сети или API).
    *   **Отзывчивый Ввод:** Поле ввода сообщения автоматически расширяется по мере набора текста.

**7. ⚙️ Техническая Реализация:**
    *   **Telegram Mini App:** Полная интеграция с платформой Telegram для запуска внутри мессенджера.
    *   **Асинхронный Бэкенд:** Использование FastAPI с асинхронными операциями для эффективной обработки запросов и стриминга.
    *   **Контейнеризация с Docker:** Обеспечивает консистентное окружение для разработки и развертывания.
    *   **Развертывание на PaaS (Render.com):** Настроено для легкого деплоя и масштабирования.
