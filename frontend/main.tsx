import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
import './i18n/i18n';

// Auto-update SW every hour
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);