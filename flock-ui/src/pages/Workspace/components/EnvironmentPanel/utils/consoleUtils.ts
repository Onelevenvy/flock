function isCommandLineTool(lowerTool: string, args?: any): boolean {
  const isSandboxExec = lowerTool.includes('sandboxexec') || lowerTool.includes('sandbox_exec');
  const isCodeExec = lowerTool.includes('code_execution');
  const isBash = lowerTool.includes('bash') || lowerTool.includes('python');
  const isComputerUseExec =
    (lowerTool.includes('computer_use') || lowerTool.includes('computeruse')) &&
    (args?.action === 'exec' || args?.action === 'EXEC');
  return isSandboxExec || isCodeExec || isBash || isComputerUseExec;
}

function parseToolArgs(rawArgs: any): any {
  if (!rawArgs) return {};
  try {
    return typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
  } catch {
    return {};
  }
}

export function cleanOutput(output: string): string {
  if (!output) return '';

  let cleaned = output;

  // Strip success headers (backend boilerplate)
  cleaned = cleaned.replace(/^命令执行成功 \(退出码: 0\)。\n\n\[输出\]\n/, '');
  cleaned = cleaned.replace(/^命令执行成功。\n\n\[输出\]\n/, '');
  cleaned = cleaned.replace(/^代码执行成功。\n\n\[输出结果\]\n/, '');

  // Strip failure headers
  cleaned = cleaned.replace(/^命令执行失败 \(退出码: \d+\)。\n\n\[错误输出\]\n/, '');
  cleaned = cleaned.replace(/^代码执行失败，退出码: \d+。\n\n\[错误输出\]\n/, '');

  // Strip trailing VNC link info and screenshots
  cleaned = cleaned.replace(/\n\n!\[桌面截图\]\(file:\/\/\/[^\)]+\)/g, '');
  cleaned = cleaned.replace(/\n\n当前桌面远程连接如下：[\s\S]*$/g, '');

  return cleaned.replace(/\n+$/, '');
}

export function buildLiveTerminalContent(messages: any[]): string {
  const terminalLines: string[] = [];

  for (const msg of messages) {
    if (!msg.chunks) continue;
    for (const chunk of msg.chunks) {
      if (chunk.kind !== 'tool_request') continue;

      const toolName = chunk.tool?.name || '';
      const lowerTool = toolName.toLowerCase();
      const args = parseToolArgs(chunk.tool?.args);

      if (!isCommandLineTool(lowerTool, args)) continue;

      let cmdStr = '';
      if (lowerTool.includes('code_execution')) {
        const rawCode = args.code || '';
        cmdStr = `python3 << 'EOF'\n${rawCode}\nEOF`;
      } else {
        cmdStr = args.command || args.code || args.script || '';
      }

      terminalLines.push(`flock-sandbox:/workspace$ ${cmdStr}`);

      if (chunk.status === 'running') {
        terminalLines.push('正在执行命令...');
      } else if (chunk.status === 'done') {
        const cleaned = cleanOutput(chunk.result || '');
        if (cleaned) terminalLines.push(cleaned);
        terminalLines.push('');
      } else if (chunk.status === 'cancelled') {
        terminalLines.push('命令已取消。\n');
      } else if (chunk.status === 'denied') {
        terminalLines.push('命令被拒绝执行。\n');
      }
    }
  }

  const lastChunk = messages
    .flatMap((m) => m.chunks || [])
    .filter((c) => {
      if (c.kind !== 'tool_request') return false;
      const lower = (c.tool?.name || '').toLowerCase();
      const args = parseToolArgs(c.tool?.args);
      return isCommandLineTool(lower, args);
    })
    .pop();

  if (
    !lastChunk ||
    lastChunk.status === 'done' ||
    lastChunk.status === 'cancelled' ||
    lastChunk.status === 'denied'
  ) {
    terminalLines.push('flock-sandbox:/workspace$ ');
  }

  return terminalLines.join('\n');
}
