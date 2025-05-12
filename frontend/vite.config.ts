import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Важно: слушать на всех сетевых интерфейсах, а не только localhost
    port: 5173, // Убедись, что порт тот же, что и в ngrok (или измени в ngrok)
    strictPort: true, // Опционально: чтобы Vite не менял порт, если он занят
    hmr: { // Настройка Hot Module Replacement для работы через прокси/туннель
       protocol: 'wss', // Используем безопасный WebSocket
       host: process.env.VITE_HMR_HOST || 'localhost', // По умолчанию localhost, но можно переопределить
       clientPort: process.env.VITE_HMR_PORT ? Number(process.env.VITE_HMR_PORT) : 443 // Порт для клиента HMR (443 для https ngrok)
    },
    // --- ВОТ ЭТО НУЖНО ДОБАВИТЬ/ИЗМЕНИТЬ ---
    allowedHosts: [
      '.ngrok-free.app' // Разрешает ЛЮБОЙ поддомен ngrok-free.app
      // Можешь добавить и другие хосты при необходимости, например, для Gitpod или Codespaces
      // '.gitpod.io',
    ],
    // --- КОНЕЦ ДОБАВЛЕНИЯ/ИЗМЕНЕНИЯ ---
  }
})