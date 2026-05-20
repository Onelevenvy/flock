import {
  IconPlayerPlay,
  IconPlayerStop,
  IconRobot,
  IconBolt,
  IconGitBranch,
  IconMessageCircle,
  IconCode,
  IconUser,
  IconCrosshair,
  IconPuzzle,
  IconBrain,
  type IconProps,
} from '@tabler/icons-react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Tabler icon component type
type TablerIconComponent = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

export interface NodeConfigItem {
  display: string;
  displayKey: string; // i18n key
  icon: TablerIconComponent;
  color: string;       // Mantine color
  colorHex: string;   // CSS hex for ReactFlow node header
  allowedConnections: {
    sources: string[];
    targets: string[];
  };
  initialData?: Record<string, unknown>;
}

export const nodeConfig: Record<string, NodeConfigItem> = {
  start: {
    display: 'Start',
    displayKey: 'workflow.nodes.start.label',
    icon: IconPlayerPlay,
    color: 'teal',
    colorHex: '#0d9488',
    allowedConnections: { sources: ['right'], targets: [] },
  },
  end: {
    display: 'End',
    displayKey: 'workflow.nodes.end.label',
    icon: IconPlayerStop,
    color: 'red',
    colorHex: '#ef4444',
    allowedConnections: { sources: [], targets: ['left'] },
  },
  llm: {
    display: 'LLM',
    displayKey: 'workflow.nodes.llm.label',
    icon: IconRobot,
    color: 'blue',
    colorHex: '#3b82f6',
    allowedConnections: { sources: ['right'], targets: ['left'] },
    initialData: {
      model: '',
      temperature: 0.7,
      systemMessage: '',
      userMessage: '${start.query}',
    },
  },
  agent: {
    display: 'Agent',
    displayKey: 'workflow.nodes.agent.label',
    icon: IconBolt,
    color: 'yellow',
    colorHex: '#f59e0b',
    allowedConnections: { sources: ['right'], targets: ['left'] },
    initialData: {
      model: '',
      temperature: 0.7,
      systemMessage: '',
      userMessage: '${start.query}',
      tools: [],
    },
  },
  classifier: {
    display: 'Classifier',
    displayKey: 'workflow.nodes.classifier.label',
    icon: IconBrain,
    color: 'pink',
    colorHex: '#ec4899',
    allowedConnections: { sources: [], targets: ['left'] },
    initialData: {
      model: '',
      categories: [
        { category_id: uuidv4(), category_name: '' },
        { category_id: 'others_category', category_name: 'Others' },
      ],
      input: '${start.query}',
    },
  },
  ifelse: {
    display: 'If-Else',
    displayKey: 'workflow.nodes.ifelse.label',
    icon: IconGitBranch,
    color: 'violet',
    colorHex: '#8b5cf6',
    allowedConnections: { sources: [], targets: ['left'] },
    initialData: {
      cases: [
        {
          case_id: uuidv4(),
          logical_operator: 'and',
          conditions: [],
        },
        {
          case_id: 'false_else',
          logical_operator: 'and',
          conditions: [],
        },
      ],
    },
  },
  answer: {
    display: 'Answer',
    displayKey: 'workflow.nodes.answer.label',
    icon: IconMessageCircle,
    color: 'orange',
    colorHex: '#f97316',
    allowedConnections: { sources: ['right'], targets: ['left'] },
    initialData: {
      answer: '',
    },
  },
  code: {
    display: 'Code',
    displayKey: 'workflow.nodes.code.label',
    icon: IconCode,
    color: 'grape',
    colorHex: '#a855f7',
    allowedConnections: { sources: ['right'], targets: ['left'] },
    initialData: {
      code: '',
      language: 'python',
    },
  },
  human: {
    display: 'Human',
    displayKey: 'workflow.nodes.human.label',
    icon: IconUser,
    color: 'cyan',
    colorHex: '#06b6d4',
    allowedConnections: { sources: ['right'], targets: ['left'] },
    initialData: {
      interaction_type: 'tool_review',
      title: '',
      routes: { approved: '', rejected: '' },
    },
  },
  parameterExtractor: {
    display: 'Extractor',
    displayKey: 'workflow.nodes.parameterExtractor.label',
    icon: IconCrosshair,
    color: 'lime',
    colorHex: '#84cc16',
    allowedConnections: { sources: ['right'], targets: ['left'] },
    initialData: {
      model: '',
      parameters: [],
      instruction: '',
      input: '${start.query}',
    },
  },
  plugin: {
    display: 'Plugin',
    displayKey: 'workflow.nodes.plugin.label',
    icon: IconPuzzle,
    color: 'gray',
    colorHex: '#6b7280',
    allowedConnections: { sources: ['right'], targets: ['left'] },
    initialData: {
      tool: null,
      args: '',
    },
  },
};

export type NodeType = keyof typeof nodeConfig;
