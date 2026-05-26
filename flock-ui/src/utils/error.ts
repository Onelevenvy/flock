import i18n from '../i18n';

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
    return i18n.t('common.errors.dbLocked', { defaultValue: '数据库已被锁定，请重试' });
  }
  if (lowerMsg.includes('unique constraint failed')) {
    return i18n.t('common.errors.uniqueConstraint', { defaultValue: '该名称或标识已存在' });
  }

  // 2. 资源未找到
  if (lowerMsg.includes('not found')) {
    if (lowerMsg.includes('assistant')) {
      return i18n.t('common.errors.assistantNotFound', { defaultValue: '指定的助手不存在' });
    }
    if (lowerMsg.includes('conversation')) {
      return i18n.t('common.errors.conversationNotFound', { defaultValue: '指定的会话不存在' });
    }
    if (lowerMsg.includes('workspace')) {
      return i18n.t('common.errors.workspaceNotFound', { defaultValue: '指定的工作区不存在' });
    }
    return i18n.t('common.errors.notFound', { defaultValue: '所请求的资源未找到' });
  }

  // 3. 文件系统/权限异常
  if (lowerMsg.includes('permission denied')) {
    return i18n.t('common.errors.permissionDenied', { defaultValue: '权限不足，操作被拒绝' });
  }
  if (lowerMsg.includes('failed to read file') || lowerMsg.includes('read file failed')) {
    return i18n.t('common.errors.readFailed', { defaultValue: '读取文件失败' });
  }
  if (lowerMsg.includes('failed to write file') || lowerMsg.includes('write file failed')) {
    return i18n.t('common.errors.writeFailed', { defaultValue: '写入文件失败' });
  }

  // 4. 网络/API/连接异常
  if (lowerMsg.includes('timeout') || lowerMsg.includes('timed out')) {
    return i18n.t('common.errors.timeout', { defaultValue: '连接或请求超时，请检查网络' });
  }
  if (lowerMsg.includes('connection refused') || lowerMsg.includes('failed to connect') || lowerMsg.includes('cannot connect')) {
    return i18n.t('common.errors.connRefused', { defaultValue: '服务连接失败，请检查服务状态' });
  }

  // 5. 鉴权与 API 秘钥错误
  if (lowerMsg.includes('unauthorized') || lowerMsg.includes('invalid credentials') || lowerMsg.includes('api key')) {
    return i18n.t('common.errors.unauthorized', { defaultValue: '鉴权失败，请检查凭据或 API Key' });
  }

  return errMsg;
}
