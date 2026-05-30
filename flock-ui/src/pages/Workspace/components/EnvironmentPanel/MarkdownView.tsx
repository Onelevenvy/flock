import { Box } from '@mantine/core';
import { MarkdownRenderer } from '../../../../components/chat/shared/MarkdownRenderer';

interface MarkdownViewProps {
  content: string;
}

export function MarkdownView({ content }: MarkdownViewProps) {
  return (
    <Box
      px="xl"
      py="md"
      className="markdown-body"
      style={{ color: 'var(--flock-text-primary)', lineHeight: 1.7 }}
    >
      <MarkdownRenderer content={content} />
    </Box>
  );
}
