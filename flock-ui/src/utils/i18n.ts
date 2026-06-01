import i18n from '@/i18n';

export function parseMultiLang(fieldVal: any): string {
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
