import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './pushNotificationClient.ts';
import { PWAInstallOverlay } from './PWAInstallOverlay.tsx';

// Automatically register Service Worker for PWA installation & Web Push
if (typeof window !== 'undefined') {
  registerServiceWorker();
}

const mountApp = () => {
  let rootElement = document.getElementById('root');
  if (!rootElement) {
    rootElement = document.createElement('div');
    rootElement.id = 'root';
    document.body.appendChild(rootElement);
  }
  
  createRoot(rootElement).render(
    <StrictMode>
      <PWAInstallOverlay />
      <App />
    </StrictMode>,
  );
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}

