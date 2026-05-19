import type { ToolProvider } from './types';
import i18n from '../../i18n';

function parseMultiLang(fieldVal: string | undefined | null): string {
  if (!fieldVal) return '';
  const trimmed = fieldVal.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const currentLang = (i18n.language || 'zh').split('-')[0];
      return parsed[currentLang] || parsed['en'] || parsed['zh'] || fieldVal;
    } catch {
      return fieldVal;
    }
  }
  return fieldVal;
}

export function getProviderDescription(provider: ToolProvider): string {
  return parseMultiLang(provider.description) || '暂无描述';
}

export function getProviderName(provider: ToolProvider): string {
  return parseMultiLang(provider.provider_name);
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
