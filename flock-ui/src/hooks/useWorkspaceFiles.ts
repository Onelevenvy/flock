import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../store/uiStore';
import { formatError } from '../utils/error';

export interface FileEntry {
  path: string;
  name: string;
  is_dir: boolean;
  size?: number;
  children?: FileEntry[];
}

export function useWorkspaceFiles(workspaceId: string | null) {
  const { t } = useTranslation();
  const { fileTreeRefreshKey, setFileTreeOpen, triggerFileTreeRefresh } = useUiStore();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFiles = useCallback(async () => {
    if (!workspaceId) {
      setFileTreeOpen(false);
      return;
    }
    setLoading(true);
    try {
      const items = await invoke<FileEntry[]>('list_workspace_files', {
        workspaceId,
        relativePath: '',
        recursive: true,
      });
      setFiles(items);
      if (items.length > 0) {
        setFileTreeOpen(true);
      } else {
        setFileTreeOpen(false);
      }
    } catch {
      setFiles([]);
      setFileTreeOpen(false);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, setFileTreeOpen]);

  useEffect(() => {
    if (workspaceId) {
      loadFiles();
    }
  }, [workspaceId, fileTreeRefreshKey, loadFiles]);

  const createFile = useCallback(async (relativePath: string) => {
    if (!workspaceId) return;
    try {
      await invoke('create_workspace_file', {
        workspaceId,
        relativePath,
        content: '',
      });
      notifications.show({
        title: t('chat.workspace.createSuccess'),
        message: t('chat.workspace.createSuccessDesc', { type: t('chat.workspace.file'), name: relativePath }),
        color: 'teal',
      });
      loadFiles();
      triggerFileTreeRefresh();
    } catch (err: unknown) {
      notifications.show({
        title: t('chat.workspace.createFailed'),
        message: formatError(err),
        color: 'red',
      });
    }
  }, [workspaceId, loadFiles, triggerFileTreeRefresh, t]);

  const createDirectory = useCallback(async (relativePath: string) => {
    if (!workspaceId) return;
    try {
      await invoke('create_workspace_directory', {
        workspaceId,
        relativePath,
      });
      notifications.show({
        title: t('chat.workspace.createSuccess'),
        message: t('chat.workspace.createSuccessDesc', { type: t('sidebar.workspace'), name: relativePath }),
        color: 'teal',
      });
      loadFiles();
      triggerFileTreeRefresh();
    } catch (err: unknown) {
      notifications.show({
        title: t('chat.workspace.createFailed'),
        message: formatError(err),
        color: 'red',
      });
    }
  }, [workspaceId, loadFiles, triggerFileTreeRefresh, t]);

  const uploadFile = useCallback(async (file: File) => {
    if (!workspaceId) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      if (!arrayBuffer) return;

      const uint8Array = new Uint8Array(arrayBuffer);
      const contentArray = Array.from(uint8Array);

      try {
        await invoke('upload_workspace_file', {
          workspaceId,
          relativePath: file.name,
          content: contentArray,
        });
        notifications.show({
          title: t('chat.workspace.uploadSuccess'),
          message: t('chat.workspace.uploadSuccessDesc', { name: file.name }),
          color: 'teal',
        });
        loadFiles();
        triggerFileTreeRefresh();
      } catch (err: unknown) {
        notifications.show({
          title: t('chat.workspace.uploadFailed'),
          message: formatError(err),
          color: 'red',
        });
      }
    };
    reader.readAsArrayBuffer(file);
  }, [workspaceId, loadFiles, triggerFileTreeRefresh, t]);

  const deleteFileOrDir = useCallback(async (relativePath: string, name: string, isDir: boolean) => {
    if (!workspaceId) return;
    const typeStr = isDir ? t('sidebar.workspace') : t('chat.workspace.file');
    const confirmMsg = t('chat.workspace.deleteFileConfirm', { type: typeStr, name });
    if (window.confirm(confirmMsg)) {
      try {
        await invoke('delete_workspace_file_or_dir', {
          workspaceId,
          relativePath,
        });
        notifications.show({
          title: t('chat.workspace.delete') + t('common.success'),
          message: t('chat.workspace.deleteSuccess', { name }),
          color: 'teal',
        });
        loadFiles();
        triggerFileTreeRefresh();
      } catch (err: unknown) {
        notifications.show({
          title: t('chat.workspace.deleteFailed'),
          message: formatError(err),
          color: 'red',
        });
      }
    }
  }, [workspaceId, loadFiles, triggerFileTreeRefresh, t]);

  return {
    files,
    loading,
    loadFiles,
    createFile,
    createDirectory,
    uploadFile,
    deleteFileOrDir,
  };
}
