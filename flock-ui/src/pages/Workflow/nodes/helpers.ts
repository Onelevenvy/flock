import { TFunction } from 'i18next';
import { type NodeType } from '@/pages/Workflow/nodeConfig';

export function getNodeSummary(
  type: NodeType,
  data: Record<string, unknown>,
  t: TFunction
): string {
  switch (type) {
    case 'llm':
    case 'agent':
      return data.model ? String(data.model) : t('workflow.nodes.noModel', 'No Model');
    case 'classifier':
      return t('workflow.nodes.classifierCount', '{{count}} Categories', { count: (data.categories as unknown[])?.length ?? 0 });
    case 'answer':
      return data.answer ? String(data.answer).slice(0, 40) : t('workflow.nodes.noOutputTemplate', 'No Output Template');
    case 'code':
      return `${data.language ?? 'python'}`;
    case 'plugin':
      return '';
    case 'human':
      return data.title ? String(data.title).slice(0, 30) : t('workflow.nodes.waitingHuman', 'Waiting review');
    case 'parameterExtractor':
      return t('workflow.nodes.parameterCount', '{{count}} Parameters', { count: (data.parameters as unknown[])?.length ?? 0 });
    default:
      return '';
  }
}
