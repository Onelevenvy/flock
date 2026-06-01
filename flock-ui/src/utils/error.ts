import i18n from '@/i18n';

/**
 * 格式化并本地化从 Rust 端或网络请求返回的错误信息
 */
export function formatError(err: unknown): string {
  if (!err) return '';

  const errMsg = typeof err === 'string'
    ? err
    : (err as any).message || String(err);

  const lowerMsg = errMsg.toLowerCase();

  // 1. 数据库异常
  if (lowerMsg.includes('database is locked')) {
    return i18n.t('common.errors.dbLocked');
  }
  if (lowerMsg.includes('unique constraint failed')) {
    return i18n.t('common.errors.uniqueConstraint');
  }

  // 2. 资源未找到
  if (lowerMsg.includes('not found')) {
    if (lowerMsg.includes('assistant')) {
      return i18n.t('common.errors.assistantNotFound');
    }
    if (lowerMsg.includes('conversation')) {
      return i18n.t('common.errors.conversationNotFound');
    }
    if (lowerMsg.includes('workspace')) {
      return i18n.t('common.errors.workspaceNotFound');
    }
    return i18n.t('common.errors.notFound');
  }

  // 3. 文件系统/权限异常
  if (lowerMsg.includes('permission denied')) {
    return i18n.t('common.errors.permissionDenied');
  }
  if (lowerMsg.includes('failed to read file') || lowerMsg.includes('read file failed')) {
    return i18n.t('common.errors.readFailed');
  }
  if (lowerMsg.includes('failed to write file') || lowerMsg.includes('write file failed')) {
    return i18n.t('common.errors.writeFailed');
  }

  // 4. 网络/API/连接异常
  if (lowerMsg.includes('timeout') || lowerMsg.includes('timed out')) {
    return i18n.t('common.errors.timeout');
  }
  if (lowerMsg.includes('connection refused') || lowerMsg.includes('failed to connect') || lowerMsg.includes('cannot connect')) {
    return i18n.t('common.errors.connRefused');
  }

  // 5. 鉴权与 API 秘钥错误
  if (lowerMsg.includes('unauthorized') || lowerMsg.includes('invalid credentials') || lowerMsg.includes('api key')) {
    return i18n.t('common.errors.unauthorized');
  }

  return errMsg;
}
