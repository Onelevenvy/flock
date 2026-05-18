import { Box } from '@mantine/core';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeViewProps {
  content: string;
  lang: string;
}

export function CodeView({ content, lang }: CodeViewProps) {
  return (
    <Box style={{ fontSize: 13 }}>
      <SyntaxHighlighter
        language={lang}
        style={vscDarkPlus}
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
