import { convertFileSrc } from '@tauri-apps/api/core';

interface PdfViewProps {
  absPath: string;
  fileName: string;
}

export function PdfView({ absPath, fileName }: PdfViewProps) {
  return (
    <iframe
      src={convertFileSrc(absPath)}
      title={fileName}
      style={{
        width: '100%',
        height: '600px',
        border: 'none',
        background: 'var(--flock-bg-deepest)',
      }}
    />
  );
}
