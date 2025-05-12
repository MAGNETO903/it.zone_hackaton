import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Or other global styles

// The useTelegramTheme hook now handles tg.ready() and accesses window.Telegram.WebApp directly.
// So, we don't need to get `tg` here or pass it as a prop.

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App /> {/* Render App without telegram prop */}
  </React.StrictMode>,
);

// tg.ready() is now called within the useTelegramTheme hook after initial theme application.