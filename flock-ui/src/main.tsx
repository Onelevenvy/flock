import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './lib/queryClient'
import App from './App'
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import './index.css';
import './i18n';

// 捕获顶层未捕获的错误
window.onerror = (msg, url, line, col, error) => {
  console.error('[Global Error]', msg, url, line, col, error);
  return false;
};

window.onunhandledrejection = (event) => {
  console.error('[Unhandled Rejection]', event.reason);
};

// 判断当前 Tauri 窗口标签（pet-overlay 只渲染宠物组件）
// Tauri 在 window.__TAURI_INTERNALS__ 里暴露 metadata
const windowLabel = (window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label ?? '';

if (windowLabel === 'pet-overlay') {
  // Pet overlay window: 只渲染宠物组件，透明背景，无其他 UI
  import('./components/Pet/XiaofOverlayApp').then(({ XiaofOverlayApp }) => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ErrorBoundary>
          <XiaofOverlayApp />
        </ErrorBoundary>
      </React.StrictMode>
    );
  });
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  )
}
