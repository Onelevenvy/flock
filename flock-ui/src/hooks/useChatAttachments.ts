import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { AssistantInputConfig } from '../types/assistant';

export interface ChatAttachment {
  id: string;
  kind: 'image' | 'file';
  name: string;
  mime_type: string;
  size: number;
  data_base64?: string;
}

export function useChatAttachments(config?: AssistantInputConfig) {
  const { t } = useTranslation();
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const addFile = useCallback(async (file: File) => {
    const allowFile = config?.allow_file_upload ?? true;
    const allowImage = config?.allow_image_upload ?? true;
    const maxCount = config?.max_file_count ?? 5;
    const maxSizeMb = config?.max_file_size_mb ?? 10;
    const allowedTypes = config?.allowed_mime_types ?? [];

    const isImage = file.type.startsWith('image/');

    // Check type permission
    if (isImage && !allowImage) {
      notifications.show({
        title: t('chat.upload.titleFailed', 'Upload Failed'),
        message: t('chat.upload.disabledImages', 'Image upload is disabled for this assistant/workflow'),
        color: 'red',
      });
      return;
    }
    if (!isImage && !allowFile) {
      notifications.show({
        title: t('chat.upload.titleFailed', 'Upload Failed'),
        message: t('chat.upload.disabledFiles', 'File upload is disabled for this assistant/workflow'),
        color: 'red',
      });
      return;
    }

    // Check count limit
    if (attachments.length >= maxCount) {
      notifications.show({
        title: t('chat.upload.titleFailed', 'Upload Failed'),
        message: t('chat.upload.maxCountReached', `You can only upload up to ${maxCount} attachments`, { count: maxCount }),
        color: 'red',
      });
      return;
    }

    // Check size limit
    const fileSizeMb = file.size / (1024 * 1024);
    if (fileSizeMb > maxSizeMb) {
      notifications.show({
        title: t('chat.upload.titleFailed', 'Upload Failed'),
        message: t('chat.upload.maxSizeExceeded', `File size cannot exceed ${maxSizeMb}MB`, { size: maxSizeMb }),
        color: 'red',
      });
      return;
    }

    // Check mime type (if configured and not empty)
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      notifications.show({
        title: t('chat.upload.titleFailed', 'Upload Failed'),
        message: t('chat.upload.unsupportedFormat', `Unsupported file format: ${file.type}`, { type: file.type }),
        color: 'red',
      });
      return;
    }

    setIsUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const newAttachment: ChatAttachment = {
        id: crypto.randomUUID?.() || Math.random().toString(36).substring(2),
        kind: isImage ? 'image' : 'file',
        name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size: file.size,
        data_base64: base64,
      };
      setAttachments(prev => [...prev, newAttachment]);
    } catch (e) {
      console.error(e);
      notifications.show({
        title: t('chat.upload.titleFailed', 'Upload Failed'),
        message: t('chat.upload.readFailed', 'Failed to read file, please try again'),
        color: 'red',
      });
    } finally {
      setIsUploading(false);
    }
  }, [attachments, config, t]);

  const removeFile = useCallback((id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  }, []);

  const clearFiles = useCallback(() => {
    setAttachments([]);
  }, []);

  return {
    attachments,
    addFile,
    removeFile,
    clearFiles,
    isUploading,
  };
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};
