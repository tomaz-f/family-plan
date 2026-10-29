import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker with silent auto-update and periodic background check
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Silently and smoothly update the service worker
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[PWA] Family Plan pronto para uso offline.');
  },
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      // Check for application updates every 60 minutes
      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.warn('[PWA] Erro ao registrar Service Worker:', error);
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fallbackTitle="Falha crítica ao iniciar o Family Plan">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
