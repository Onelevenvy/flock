import { Box } from '@mantine/core';
import { convertFileSrc } from '@tauri-apps/api/core';

interface ImageViewProps {
  absPath: string;
  fileName: string;
}

export function ImageView({ absPath, fileName }: ImageViewProps) {
  return (
    <Box
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--flock-bg-deepest)',
        backgroundImage: 'radial-gradient(var(--flock-border-dim, #374151) 1px, transparent 0)',
        backgroundSize: '16px 16px',
        minHeight: '400px',
      }}
    >
      <img
        src={convertFileSrc(absPath)}
        alt={fileName}
        style={{
          maxWidth: '100%',
          maxHeight: '450px',
          objectFit: 'contain',
          borderRadius: '8px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          background: 'var(--flock-bg-base)',
          border: '1px solid var(--flock-border-subtle)',
        }}
      />
    </Box>
  );
}
