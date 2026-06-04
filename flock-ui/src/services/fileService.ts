import { invoke } from '@tauri-apps/api/core';
import type { FileEntry } from '@/hooks/useWorkspaceFiles';

export const fileService = {
  async listWorkspaceFiles(workspaceId: string, relativePath: string = '', recursive: boolean = true): Promise<FileEntry[]> {
    return await invoke<FileEntry[]>('list_workspace_files', {
      workspaceId,
      relativePath,
      recursive,
    });
  },

  async createWorkspaceFile(workspaceId: string, relativePath: string, content: string = ''): Promise<void> {
    await invoke('create_workspace_file', {
      workspaceId,
      relativePath,
      content,
    });
  },

  async createWorkspaceDirectory(workspaceId: string, relativePath: string): Promise<void> {
    await invoke('create_workspace_directory', {
      workspaceId,
      relativePath,
    });
  },

  async uploadWorkspaceFile(workspaceId: string, relativePath: string, content: number[]): Promise<void> {
    await invoke('upload_workspace_file', {
      workspaceId,
      relativePath,
      content,
    });
  },

  async deleteWorkspaceFileOrDir(workspaceId: string, relativePath: string): Promise<void> {
    await invoke('delete_workspace_file_or_dir', {
      workspaceId,
      relativePath,
    });
  }
};
