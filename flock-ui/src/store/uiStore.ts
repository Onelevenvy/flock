import { create } from 'zustand';
import i18n from '@/i18n';
import { invoke } from '@tauri-apps/api/core';

export type ThemeMode = 'light' | 'dark';

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
  extension?: string;
  children?: FileEntry[];
}

function getInitialTheme(): ThemeMode {
  const stored = localStorage.getItem('flock-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'light';
}

export type EnvironmentMode = 'closed' | 'artifact' | 'terminal' | 'computer';

interface UiStore {
  // 主题
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;

  // 语言
  language: 'zh' | 'en';
  setLanguage: (lang: 'zh' | 'en') => void;

  // 面板显示
  isSidebarCollapsed: boolean;
  isFileTreeOpen: boolean;
  isPreviewOpen: boolean;

  // 当前预览的文件
  previewFile: { path: string; content: string; extension?: string } | null;

  // Artifact & Environment
  environmentMode: EnvironmentMode;

  // 文件树状态
  expandedDirs: Set<string>;

  // 面板视图: 'workspace' | 'conversations' | 'files' | 'settings'
  activeSideView: 'workspace' | 'conversations' | 'files' | 'settings';

  isSettingsOpen: boolean;

  // 刷新触发器 (用于通知文件树等组件刷新)
  fileTreeRefreshKey: number;

  // 主视图: 'home' | 'assistant' | 'skills' | 'workflow' | 'collaboration' | 'extension' | 'schedule'
  currentView: 'home' | 'assistant' | 'skills' | 'workflow' | 'collaboration' | 'extension' | 'schedule';

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleFileTree: () => void;
  setFileTreeOpen: (open: boolean) => void;
  togglePreview: () => void;
  setPreviewOpen: (open: boolean) => void;
  setPreviewFile: (file: { path: string; content: string; extension?: string } | null) => void;
  setEnvironmentMode: (mode: EnvironmentMode) => void;
  openEnvironment: (mode: EnvironmentMode, file?: { path: string; content: string; extension?: string }) => void;
  closeEnvironment: () => void;
  toggleExpandDir: (path: string) => void;
  setActiveSideView: (view: 'workspace' | 'conversations' | 'files' | 'settings') => void;
  triggerFileTreeRefresh: () => void;
  setSettingsOpen: (open: boolean) => void;
  setCurrentView: (view: 'home' | 'assistant' | 'skills' | 'workflow' | 'collaboration' | 'extension' | 'schedule') => void;
}

export const useUiStore = create<UiStore>((set) => ({
  theme: getInitialTheme(),

  setTheme: (theme) => {
    localStorage.setItem('flock-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },

  language: (localStorage.getItem('flock-lang') as 'zh' | 'en') || 'zh',

  setLanguage: (lang) => {
    localStorage.setItem('flock-lang', lang);
    i18n.changeLanguage(lang);
    invoke('set_locale', { locale: lang }).catch(err => console.error("set_locale failed:", err));
    set({ language: lang });
  },

  toggleTheme: () =>
    set((s) => {
      const next: ThemeMode = s.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('flock-theme', next);
      document.documentElement.setAttribute('data-theme', next);
      return { theme: next };
    }),

  isSidebarCollapsed: false,
  isFileTreeOpen: false,
  isPreviewOpen: false,
  previewFile: null,
  environmentMode: 'closed',
  expandedDirs: new Set(),
  activeSideView: 'workspace',
  fileTreeRefreshKey: 0,
  isSettingsOpen: false,
  currentView: 'home',

  toggleSidebar: () => set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ isSidebarCollapsed: v }),
  toggleFileTree: () => set((s) => ({ isFileTreeOpen: !s.isFileTreeOpen })),
  setFileTreeOpen: (open) => set({ isFileTreeOpen: open }),
  togglePreview: () => set((s) => ({ isPreviewOpen: !s.isPreviewOpen })),
  setPreviewOpen: (open) => set({ isPreviewOpen: open }),
  setPreviewFile: (file) => set({ previewFile: file, isPreviewOpen: !!file }),
  setEnvironmentMode: (mode) => set({ environmentMode: mode, isPreviewOpen: mode !== 'closed' }),
  openEnvironment: (mode, file) => set(() => {
    if (file) {
      return { environmentMode: mode, isPreviewOpen: true, previewFile: file };
    }
    return { environmentMode: mode, isPreviewOpen: true };
  }),
  closeEnvironment: () => set({ environmentMode: 'closed', isPreviewOpen: false }),

  toggleExpandDir: (path) =>
    set((s) => {
      const next = new Set(s.expandedDirs);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return { expandedDirs: next };
    }),

  setActiveSideView: (view) => set({ activeSideView: view }),
  triggerFileTreeRefresh: () => set((s) => ({ fileTreeRefreshKey: s.fileTreeRefreshKey + 1 })),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setCurrentView: (view) => set({ currentView: view }),
}));
