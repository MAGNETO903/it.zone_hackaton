// frontend/src/global.d.ts
// Это объявление сообщает TypeScript, что в глобальной области видимости
// существует объект Telegram с полем WebApp.
// Импортированный ранее WebApp из @twa-dev/types предоставляет детальные типы для WebApp.

// Forward declaration for WebApp type from @twa-dev/types
// This avoids needing to install @twa-dev/types if it's not already a direct dependency
// for this specific global declaration.
// However, it's better if @twa-dev/types IS a dependency and used directly.
// Assuming @twa-dev/types is available as per previous discussions for useTelegramTheme.ts
type WebAppType = import('@twa-dev/types').WebApp;

declare global {
  interface Window {
    Telegram?: { // Made Telegram optional for safety during non-TMA environments
      WebApp: WebAppType;
    };
    // For Backend URL injection
    __BACKEND_URL__?: string;
  }
}

// Этот export {} нужен, чтобы файл считался модулем и объявление declare global
// работало правильно в некоторых конфигурациях TypeScript.
export {};