// src/hooks/useTelegramTheme.ts
import { useEffect } from 'react';

// Интерфейс для themeParams (можно расширить при необходимости)
interface TelegramThemeParams {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
    header_bg_color?: string; // Добавим, если есть
    section_bg_color?: string; // Добавим, если есть
    destructive_text_color?: string; // Добавим, если есть
    // ... добавь другие параметры, которые используешь, если они есть в themeParams
}

// Функция для преобразования ключа из themeParams в имя CSS-переменной
// Например, 'bg_color' -> '--tg-theme-bg-color'
const toCssVarName = (key: string): string => `--tg-theme-${key.replace(/_/g, '-')}`;

export const useTelegramTheme = () => {
    useEffect(() => {
        const tg = window.Telegram?.WebApp;

        if (!tg) {
            console.warn('Telegram WebApp API not found. Theme adaptation disabled.');
            // Можно установить дефолтные значения для CSS переменных, если API недоступно
            // Например, для разработки в браузере без Telegram
            const defaultTheme: TelegramThemeParams = {
                bg_color: '#ffffff',
                text_color: '#000000',
                hint_color: '#999999',
                link_color: '#2481cc',
                button_color: '#50a8eb',
                button_text_color: '#ffffff',
                secondary_bg_color: '#f0f0f0',
                destructive_text_color: '#ff3b30',
            };
            Object.entries(defaultTheme).forEach(([key, value]) => {
                if (value) {
                    document.documentElement.style.setProperty(toCssVarName(key), value);
                }
            });
            return;
        }

        const applyThemeParams = (params: TelegramThemeParams) => {
            console.log('Applying Telegram Theme Params:', params);
            Object.entries(params).forEach(([key, value]) => {
                if (value) {
                    document.documentElement.style.setProperty(toCssVarName(key), value);
                }
            });

            // Дополнительно: цвет шапки Mini App
            // Telegram может не предоставлять все цвета, проверяем наличие
            if (params.header_bg_color) {
                tg.setHeaderColor(params.header_bg_color as any); // 'as any' для обхода строгости типов если это кастомный параметр
            } else if (params.secondary_bg_color) {
                 // Как запасной вариант, можно использовать secondary_bg_color или bg_color
                 // tg.setHeaderColor(params.secondary_bg_color);
            }

            // Цвет фона всего Mini App (за пределами видимой области)
            if (params.bg_color) {
                tg.setBackgroundColor(params.bg_color);
            }
        };

        // Применить текущую тему при монтировании
        applyThemeParams(tg.themeParams as TelegramThemeParams);

        // Подписаться на событие изменения темы
        const themeChangedHandler = () => {
            console.log('Telegram theme changed.');
            applyThemeParams(tg.themeParams as TelegramThemeParams);
        };

        tg.onEvent('themeChanged', themeChangedHandler);

        // Отписаться при размонтировании компонента
        return () => {
            tg.offEvent('themeChanged', themeChangedHandler);
        };
    }, []); // Пустой массив зависимостей, чтобы хук выполнился один раз при монтировании
};