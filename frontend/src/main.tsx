import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Или другие стили

// Получаем объект Telegram WebApp
const tg = window.Telegram.WebApp;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App telegram={tg} /> {/* Передаем объект tg в App */}
  </React.StrictMode>,
);

// Сообщаем Telegram, что приложение готово
tg.ready();