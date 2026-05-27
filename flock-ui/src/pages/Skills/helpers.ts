import type { ToolProvider } from './types';
import i18n from '../../i18n';

function parseMultiLang(fieldVal: any): string {
  if (!fieldVal) return '';
  if (typeof fieldVal === 'object') {
    const currentLang = (i18n.language || 'zh').split('-')[0];
    return fieldVal[currentLang] || fieldVal['en'] || fieldVal['zh'] || '';
  }
  if (typeof fieldVal === 'string') {
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
  return '';
}


export function getProviderDescription(provider: any): string {
  return parseMultiLang(provider.description) || i18n.t('skills.skills.noDescription');
}

export function getProviderName(provider: any): string {
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

export function getToolName(tool: any, provider: any, t: any): string {
  const currentLang = (i18n.language || 'zh').split('-')[0];
  if (provider?.tools_i18n && provider.tools_i18n[tool.name]) {
    const i18nObj = provider.tools_i18n[tool.name];
    if (i18nObj.name) {
      return i18nObj.name[currentLang] || i18nObj.name['en'] || i18nObj.name['zh'] || tool.name;
    }
  }
  const toolLocKey = `skills.tools_i18n.${tool.name}`;
  return t(`${toolLocKey}.name`, { defaultValue: tool.name });
}

export function getToolDescription(tool: any, provider: any, t: any): string {
  const currentLang = (i18n.language || 'zh').split('-')[0];
  if (provider?.tools_i18n && provider.tools_i18n[tool.name]) {
    const i18nObj = provider.tools_i18n[tool.name];
    if (i18nObj.description) {
      return i18nObj.description[currentLang] || i18nObj.description['en'] || i18nObj.description['zh'] || tool.description;
    }
  }
  const toolLocKey = `skills.tools_i18n.${tool.name}`;
  return t(`${toolLocKey}.description`, { defaultValue: tool.description });
}

export function getToolParamDescription(paramName: string, defaultDesc: string, tool: any, provider: any, t: any): string {
  const currentLang = (i18n.language || 'zh').split('-')[0];
  if (provider?.tools_i18n && provider.tools_i18n[tool.name]) {
    const i18nObj = provider.tools_i18n[tool.name];
    if (i18nObj.params && i18nObj.params[paramName]) {
      const pVal = i18nObj.params[paramName];
      if (typeof pVal === 'object') {
        return pVal[currentLang] || pVal['en'] || pVal['zh'] || defaultDesc;
      }
      return pVal || defaultDesc;
    }
  }
  const toolLocKey = `skills.tools_i18n.${tool.name}`;
  return t(`${toolLocKey}.params.${paramName}`, { defaultValue: defaultDesc });
}

