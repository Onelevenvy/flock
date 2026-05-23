interface HtmlViewProps {
  content: string;
  fileName: string;
}

export function HtmlView({ content, fileName }: HtmlViewProps) {
  return (
    <iframe
      srcDoc={content}
      title={fileName}
      style={{
        width: '100%',
        height: '600px',
        border: 'none',
        background: '#ffffff',
      }}
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
    />
  );
}
