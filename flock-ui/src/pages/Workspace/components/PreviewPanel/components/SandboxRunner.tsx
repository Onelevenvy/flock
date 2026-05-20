import React from 'react';

interface SandboxRunnerProps {
  content: string;
}

export function SandboxRunner({ content }: SandboxRunnerProps) {
  return (
    <iframe
      srcDoc={content}
      title="HTML Sandbox Runner"
      sandbox="allow-scripts"
      style={{
        width: '100%',
        height: 'calc(100vh - 120px)',
        border: 'none',
        background: '#ffffff',
      }}
    />
  );
}
