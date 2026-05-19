import type { ToolProvider } from './types';

export function getProviderDescription(provider: ToolProvider): string {
  return provider.description || '暂无描述';
}

export function formatLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export function parseInputSchema(
  schema: string
): Record<string, { type: string; description: string }> {
  try {
    const parsed = JSON.parse(schema);
    return parsed.properties || {};
  } catch {
    return {};
  }
}

export const SOURCE_COLORS: Record<string, string> = {
  Bundled: 'blue',
  User: 'green',
  Project: 'orange',
  Mcp: 'grape',
  Legacy: 'gray',
  Managed: 'teal',
};
