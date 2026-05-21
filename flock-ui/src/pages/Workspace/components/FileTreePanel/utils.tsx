import React from 'react';
import {
  IconFile,
  IconFileTypeCss,
  IconFileTypeJs,
  IconFileTypeTs,
  IconCode,
  IconBraces,
  IconMarkdown,
  IconPhoto,
  IconFileText,
} from '@tabler/icons-react';

export function getFileIcon(name: string, extension?: string) {
  const ext = extension?.toLowerCase() || name.split('.').pop()?.toLowerCase() || '';
  const size = 14;
  switch (ext) {
    case 'ts':
    case 'tsx':
      return <IconFileTypeTs size={size} color="#3178c6" />;
    case 'js':
    case 'jsx':
    case 'mjs':
      return <IconFileTypeJs size={size} color="#f7df1e" />;
    case 'py':
      return <IconCode size={size} color="#3776ab" />;
    case 'css':
    case 'scss':
    case 'less':
      return <IconFileTypeCss size={size} color="#1572b6" />;
    case 'json':
    case 'toml':
    case 'yaml':
    case 'yml':
      return <IconBraces size={size} color="#f59e0b" />;
    case 'md':
    case 'mdx':
      return <IconMarkdown size={size} color="#6b7280" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <IconPhoto size={size} color="#ec4899" />;
    case 'rs':
      return <IconCode size={size} color="#e57324" />;
    case 'html':
    case 'htm':
      return <IconCode size={size} color="#e34c26" />;
    case 'txt':
    case 'log':
      return <IconFileText size={size} color="#9ca3af" />;
    default:
      return <IconFile size={size} color="#6b7280" />;
  }
}

export function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
