import { QueryClient } from '@tanstack/react-query';

// 初始化并导出全局共享的 TanStack Query Client 实例
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5分钟内数据标记为新鲜，避免重复请求
      refetchOnWindowFocus: false, // 窗口获得焦点时默认不重新拉取，这在桌面端开发更友好
      retry: 1, // 失败后自动重试 1 次
    },
  },
});
