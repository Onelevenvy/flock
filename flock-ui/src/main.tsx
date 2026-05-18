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
