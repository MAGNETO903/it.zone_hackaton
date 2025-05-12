// src/hooks/useTelegramTheme.ts
import { useEffect } from 'react';
import type { ThemeParams, HeaderColorKey } from '@twa-dev/types';

const toCssVarName = (key: string): string => `--tg-theme-${key.replace(/_/g, '-')}`;

// Helper to check if a string is a valid hex color
const isValidHexColor = (color: string): color is `#${string}` => /^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/.test(color);

// Helper to check if a string is a valid HeaderColorKey
const isValidHeaderColorKey = (key: string): key is HeaderColorKey => {
    return ['bg_color', 'secondary_bg_color'].includes(key);
};


export const useTelegramTheme = () => {
    useEffect(() => {
        const tg = window.Telegram?.WebApp;

        if (!tg) {
            console.warn('Telegram WebApp API not found. Theme adaptation disabled.');
            const defaultTheme: Partial<ThemeParams> = { // Use Partial<ThemeParams> for default
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
            document.body.className = 'light'; // Default body class
            return;
        }

        const applyThemeParams = (params: ThemeParams) => {
            console.log('Applying Telegram Theme Params:', params);
            Object.entries(params).forEach(([key, value]) => {
                if (value) {
                    document.documentElement.style.setProperty(toCssVarName(key), value);
                }
            });
            document.body.className = tg.colorScheme || 'light';

            if (params.header_bg_color) {
                if (isValidHexColor(params.header_bg_color)) {
                    tg.setHeaderColor(params.header_bg_color);
                } else if (isValidHeaderColorKey(params.header_bg_color)) {
                    // If it's a key like "bg_color", TWA will resolve it to the actual color
                    tg.setHeaderColor(params.header_bg_color);
                } else {
                    console.warn(`Invalid header_bg_color format: ${params.header_bg_color}.`);
                     // Fallback logic if needed, e.g., using params.bg_color if it's a valid hex
                    if (params.bg_color && isValidHexColor(params.bg_color)) {
                       tg.setHeaderColor(params.bg_color);
                    }
                }
            } else if (params.secondary_bg_color && isValidHexColor(params.secondary_bg_color)) {
                // Fallback to secondary_bg_color if header_bg_color is not set or invalid
                // tg.setHeaderColor(params.secondary_bg_color);
            }


            if (params.bg_color && isValidHexColor(params.bg_color)) {
                tg.setBackgroundColor(params.bg_color);
            } else {
                console.warn(`Invalid bg_color for setBackgroundColor: ${params.bg_color}`);
            }
        };

        applyThemeParams(tg.themeParams);
        tg.ready(); // Inform Telegram the app is ready

        const themeChangedHandler = () => {
            console.log('Telegram theme changed.');
            applyThemeParams(tg.themeParams);
        };

        tg.onEvent('themeChanged', themeChangedHandler);

        return () => {
            tg.offEvent('themeChanged', themeChangedHandler);
        };
    }, []);
};