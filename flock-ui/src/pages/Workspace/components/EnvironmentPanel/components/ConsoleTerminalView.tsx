import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, ScrollArea, Group } from '@mantine/core';
import { useUiStore } from '../../../../../store/uiStore';
import { useAgentStore } from '../../../../../store/agentStore';

interface ConsoleTerminalViewProps {
  content: string;
}

// 提取并清洗底层返回的冗余固定文案，只保留纯净的命令行 stdout/stderr
function cleanOutput(output: string): string {
  if (!output) return '';
  
  let cleaned = output;
  
  // 清洗成功头部
  cleaned = cleaned.replace(/^命令执行成功 \(退出码: 0\)。\n\n\[输出\]\n/, '');
  cleaned = cleaned.replace(/^命令执行成功。\n\n\[输出\]\n/, '');
  cleaned = cleaned.replace(/^代码执行成功。\n\n\[输出结果\]\n/, '');
  
  // 清洗失败头部
  cleaned = cleaned.replace(/^命令执行失败 \(退出码: \d+\)。\n\n\[错误输出\]\n/, '');
  cleaned = cleaned.replace(/^代码执行失败，退出码: \d+。\n\n\[错误输出\]\n/, '');
  
  // 清洗 trailing remote desktop / VNC link info and screenshots
  cleaned = cleaned.replace(/\n\n!\[桌面截图\]\(file:\/\/\/[^\)]+\)/g, '');
  cleaned = cleaned.replace(/\n\n当前桌面远程连接如下：[\s\S]*$/g, '');
  
  return cleaned.replace(/\n+$/, ''); // 仅移除尾随空行，保留中间排版
}

// 遍历当前会话的 messages，重构极具极客感且持久的历史终端流
function buildLiveTerminalContent(messages: any[]): string {
  const terminalLines: string[] = [];

  for (const msg of messages) {
    if (!msg.chunks) continue;
    for (const chunk of msg.chunks) {
      if (chunk.kind !== 'tool_request') continue;
      
      const toolName = chunk.tool?.name || '';
      const lowerTool = toolName.toLowerCase();
      
      // 安全地解析参数，因为 args 可能是 JSON 字符串或对象
      let args: any = {};
      if (chunk.tool?.args) {
        try {
          if (typeof chunk.tool.args === 'string') {
            args = JSON.parse(chunk.tool.args);
          } else {
            args = chunk.tool.args;
          }
        } catch (e) {
          args = {};
        }
      }
      
      // 匹配沙盒相关命令执行工具
      const isSandboxExec = lowerTool.includes('sandboxexec') || lowerTool.includes('sandbox_exec');
      const isCodeExec = lowerTool.includes('code_execution');
      const isBash = lowerTool.includes('bash') || lowerTool.includes('python');
      const isComputerUseExec = (lowerTool.includes('computer_use') || lowerTool.includes('computeruse')) && 
        (args.action === 'exec' || args.action === 'EXEC');

      if (!isSandboxExec && !isCodeExec && !isBash && !isComputerUseExec) {
        continue;
      }

      // 重建终端输入命令
      let cmdStr = '';
      if (isCodeExec) {
        const rawCode = args.code || '';
        cmdStr = `python3 << 'EOF'\n${rawCode}\nEOF`;
      } else {
        cmdStr = args.command || args.code || args.script || '';
      }

      // 写入命令提示符与命令输入
      terminalLines.push(`flock-sandbox:/workspace$ ${cmdStr}`);

      if (chunk.status === 'running') {
        terminalLines.push('正在执行命令...');
      } else if (chunk.status === 'done') {
        const cleaned = cleanOutput(chunk.result || '');
        if (cleaned) {
          terminalLines.push(cleaned);
        }
        // 增加空行间隔，让界面清爽
        terminalLines.push('');
      } else if (chunk.status === 'cancelled') {
        terminalLines.push('命令已取消。\n');
      } else if (chunk.status === 'denied') {
        terminalLines.push('命令被拒绝执行。\n');
      }
    }
  }

  // 提取最后一个沙盒执行块以辅助渲染最后的激活 Prompt
  const lastChunk = messages
    .flatMap((m) => m.chunks || [])
    .filter((c) => {
      if (c.kind !== 'tool_request') return false;
      const lower = (c.tool?.name || '').toLowerCase();
      
      let args: any = {};
      if (c.tool?.args) {
        try {
          if (typeof c.tool.args === 'string') {
            args = JSON.parse(c.tool.args);
          } else {
            args = c.tool.args;
          }
        } catch (e) {
          args = {};
        }
      }
      
      const isSandboxExec = lower.includes('sandboxexec') || lower.includes('sandbox_exec');
      const isCodeExec = lower.includes('code_execution');
      const isBash = lower.includes('bash') || lower.includes('python');
      const isComputerUseExec = (lower.includes('computer_use') || lower.includes('computeruse')) && 
        (args.action === 'exec' || args.action === 'EXEC');
      return isSandboxExec || isCodeExec || isBash || isComputerUseExec;
    })
    .pop();

  if (!lastChunk || lastChunk.status === 'done' || lastChunk.status === 'cancelled' || lastChunk.status === 'denied') {
    terminalLines.push('flock-sandbox:/workspace$ ');
  }

  return terminalLines.join('\n');
}

export function ConsoleTerminalView({ content }: ConsoleTerminalViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';
  
  const previewFile = useUiStore((s) => s.previewFile);
  const isLiveTerminal = previewFile?.path === '.flock/sandbox/code_result.log';

  const messages = useAgentStore((s) => s.messages);
  // 智能区分：实时沙盒终端则重构全局历史流，静态普通 .log 文件则直出
  const liveContent = isLiveTerminal ? buildLiveTerminalContent(messages) : content;

  const [displayedContent, setDisplayedContent] = useState('');
  const queueRef = useRef<string[]>([]);
  const timerRef = useRef<number | null>(null);
  const lastProcessedContentRef = useRef('');

  useEffect(() => {
    if (liveContent === lastProcessedContentRef.current) {
      return;
    }
    const prevContent = lastProcessedContentRef.current;
    lastProcessedContentRef.current = liveContent;

    if (!liveContent) {
      setDisplayedContent('');
      queueRef.current = [];
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // 处理正在执行或等待状态
    if (liveContent === '正在执行沙盒命令...' || liveContent.startsWith('正在执行') || liveContent.startsWith('等待命令')) {
      setDisplayedContent(liveContent);
      queueRef.current = [];
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // 智能打字机：仅对增量流式追加部分起效，历史前序命令直接瞬间渲染
    if (prevContent && liveContent.startsWith(prevContent)) {
      const extra = liveContent.substring(prevContent.length);
      if (extra) {
        const newLines = extra.split('\n');
        queueRef.current.push(...newLines);
      }
    } else {
      const newLines = liveContent.split('\n');
      setDisplayedContent('');
      queueRef.current = newLines;
    }

    // 启动流式吐字渲染定时器
    if (!timerRef.current) {
      const processQueue = () => {
        if (queueRef.current.length > 0) {
          // 每次弹出 1-3 行以提供飞速流动又不致卡顿的视觉极客感
          const batchSize = Math.min(3, queueRef.current.length);
          const batch = queueRef.current.splice(0, batchSize);
          
          setDisplayedContent((prev) => {
            const separator = prev ? (prev.endsWith('\n') ? '' : '\n') : '';
            return prev + separator + batch.join('\n');
          });
          timerRef.current = requestAnimationFrame(processQueue);
        } else {
          timerRef.current = null;
        }
      };
      timerRef.current = requestAnimationFrame(processQueue);
    }

    return () => {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [liveContent]);

  // displayedContent 改变时触发，使终端滚屏极速且流畅
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [displayedContent]);

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: isDark ? '#121212' : '#f8f9fa', // 深色/浅色终端背景
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4) inset' : '0 2px 8px rgba(0,0,0,0.06) inset',
        margin: '16px',
        border: isDark ? '1px solid #333' : '1px solid #e4e4e7',
      }}
    >
      {/* 终端顶部标题栏 (macOS 风格) */}
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '28px',
          background: isDark ? '#2d2d2d' : '#f1f3f5',
          borderBottom: isDark ? '1px solid #111' : '1px solid #e4e4e7',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <Group gap={6} style={{ position: 'absolute', left: '12px' }}>
          <Box style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56' }} />
          <Box style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
          <Box style={{ width: 12, height: 12, borderRadius: '50%', background: '#27c93f' }} />
        </Group>
        <Text size="xs" c={isDark ? '#888' : '#71717a'} fw={600} style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
          bash — flock-sandbox
        </Text>
      </Box>

      {/* 终端输出内容区 */}
      <ScrollArea viewportRef={viewportRef} style={{ flex: 1, padding: '12px 16px' }}>
        <Box
          component="pre"
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            fontFamily: 'var(--mantine-font-family-monospace)',
            fontSize: '13px',
            lineHeight: '1.5',
            color: isDark ? '#a9b7c6' : '#18181b', // 经典的 IDE/Terminal 文字颜色
          }}
        >
          {displayedContent || 'flock-sandbox:/workspace$ '}
          {/* 光标闪烁效果 */}
          <span className="blinking-cursor">_</span>
        </Box>
        <style>{`
          .blinking-cursor {
            font-weight: bold;
            color: ${isDark ? '#fff' : '#18181b'};
            animation: 1s blink step-end infinite;
            margin-left: 2px;
          }
          @keyframes blink {
            from, to { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>
      </ScrollArea>
    </Box>
  );
}
