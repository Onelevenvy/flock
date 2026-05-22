export function parseScheduleDesc(descStr: string | undefined | null, t: any): string {
  if (!descStr) return '';
  const trimmed = descStr.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed);
      if (obj.key) {
        let params = { ...obj.params };
        if (params.dayKey) {
          params.day = t(params.dayKey);
        }
        return t(obj.key, params);
      }
    } catch {
      return descStr;
    }
  }
  return descStr;
}

export function formatTime(ts: number | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
