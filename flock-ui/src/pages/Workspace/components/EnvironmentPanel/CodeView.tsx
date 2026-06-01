import { Box } from '@mantine/core';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useUiStore } from '@/store/uiStore';

interface CodeViewProps {
  content: string;
  lang: string;
}

export function CodeView({ content, lang }: CodeViewProps) {
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';

  return (
    <Box style={{ fontSize: 13 }}>
      <SyntaxHighlighter
        language={lang}
        style={isDark ? vscDarkPlus : prism}
        customStyle={{
          margin: 0,
          background: 'transparent',
          padding: '16px',
          fontSize: 13,
          lineHeight: 1.6,
        }}
        showLineNumbers={content.split('\n').length > 5}
        wrapLongLines={false}
      >
        {content}
      </SyntaxHighlighter>
    </Box>
  );
}
