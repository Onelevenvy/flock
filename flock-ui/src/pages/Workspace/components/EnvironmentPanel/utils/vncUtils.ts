export interface ScreenshotInfo {
  path: string;
  callId: string;
  action?: string;
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  toolName?: string;
}

export function getRelativePath(absPath: string): string {
  if (!absPath) return '';
  const normalized = absPath.replace(/\\/g, '/');
  const keyword = '.flock/sandbox/screenshots/';
  const idx = normalized.indexOf(keyword);
  if (idx !== -1) {
    return normalized.substring(idx);
  }
  return '';
}

export function extractScreenshotsStructured(messages: any[]): ScreenshotInfo[] {
  const list: ScreenshotInfo[] = [];
  const fileRegex = /file:\/\/\/([^\s'")\])]+\.png)/gi;

  const foundPaths: string[] = [];
  messages.forEach((msg) => {
    if (!msg.chunks) return;
    msg.chunks.forEach((chunk: any) => {
      let textToScan = '';
      if (chunk.kind === 'text') {
        textToScan = chunk.text || '';
      } else if (chunk.kind === 'tool_request' && chunk.result) {
        textToScan = chunk.result || '';
      }

      if (textToScan) {
        let match;
        const scanText = textToScan.replace(/\\/g, '/');
        fileRegex.lastIndex = 0;
        while ((match = fileRegex.exec(scanText)) !== null) {
          let path = match[1];
          if (path.match(/^\/[a-zA-Z]:/)) {
            path = path.substring(1);
          }
          if (!foundPaths.includes(path)) {
            foundPaths.push(path);
          }
        }
      }
    });
  });

  foundPaths.forEach((path) => {
    let cleanPath = path;
    if (path.endsWith('_labeled.png')) {
      cleanPath = path.substring(0, path.length - 12) + '.png';
    }
    const baseName = cleanPath.split(/[/\\]/).pop() || '';
    const callId = baseName.replace(/\.png$/i, '');

    let action = '';
    let x: number | undefined = undefined;
    let y: number | undefined = undefined;
    let text = '';
    let key = '';
    let toolName = '';

    for (const msg of messages) {
      if (!msg.chunks) continue;
      const foundChunk = msg.chunks.find(
        (c: any) => c.kind === 'tool_request' && c.call_id === callId,
      );
      if (foundChunk && foundChunk.tool) {
        toolName = foundChunk.tool.name || '';
        const args = foundChunk.tool.args || {};
        try {
          const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
          action = parsedArgs.action || '';
          x =
            typeof parsedArgs.x === 'number'
              ? parsedArgs.x
              : parsedArgs.x
                ? parseInt(parsedArgs.x)
                : undefined;
          y =
            typeof parsedArgs.y === 'number'
              ? parsedArgs.y
              : parsedArgs.y
                ? parseInt(parsedArgs.y)
                : undefined;
          text = parsedArgs.text || '';
          key = parsedArgs.key || parsedArgs.button || '';
        } catch {
          // Fallback if parsing fails
        }
        break;
      }
    }

    list.push({ path: cleanPath, callId, action, x, y, text, key, toolName });
  });

  return list;
}
