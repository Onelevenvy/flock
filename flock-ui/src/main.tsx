import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './lib/queryClient'
import App from './App'
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import './index.css';
import './i18n';
import { XiaofOverlayApp } from './components/Pet/XiaofOverlayApp'

// 捕获顶层未捕获的错误
window.onerror = (msg, url, line, col, error) => {
  console.error('[Global Error]', msg, url, line, col, error);
  return false;
};

window.onunhandledrejection = (event) => {
  console.error('[Unhandled Rejection]', event.reason);
};

// 判断当前 窗口标签（通过 URL query 参数最早期且最安全地辨识，如 ?window=pet-overlay）
const urlParams = new URLSearchParams(window.location.search);
const windowLabel = urlParams.get('window') || 'main';

if (windowLabel === 'pet-overlay') {
  // Pet overlay window: 只渲染宠物组件，透明背景，无其他 UI
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <XiaofOverlayApp />
      </ErrorBoundary>
    </React.StrictMode>
  );
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
