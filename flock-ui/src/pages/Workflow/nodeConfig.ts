import {
  IconPlayerPlay,
  IconPlayerStop,
  IconRobot,
  IconGitBranch,
  IconMessageCircle,
  IconCode,
  IconUser,
  IconCrosshair,
  IconPuzzle,
  IconBrain,
  IconTags,
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
    colorHex: '#0f766e',
    allowedConnections: { sources: ['right'], targets: [] },
  },
  end: {
    display: 'End',
    displayKey: 'workflow.nodes.end.label',
    icon: IconPlayerStop,
    color: 'red',
    colorHex: '#be123c',
    allowedConnections: { sources: [], targets: ['left'] },
  },
  llm: {
    display: 'LLM',
    displayKey: 'workflow.nodes.llm.label',
    icon: IconBrain,
    color: 'blue',
    colorHex: '#2563eb',
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
    icon: IconRobot,
    color: 'yellow',
    colorHex: '#d97706',
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
    icon: IconTags,
    color: 'pink',
    colorHex: '#db2777',
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
    colorHex: '#7c3aed',
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
    colorHex: '#ea580c',
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
    colorHex: '#9333ea',
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
    colorHex: '#0891b2',
    allowedConnections: { sources: [], targets: ['left'] },
    initialData: {
      webapp_enabled: true,
      form_content: '',
      user_actions: [
        { key: 'action_1', label: 'Approve' },
        { key: 'action_2', label: 'Reject' },
      ],
      timeout_num: 3,
      timeout_unit: 'hours',
    },
  },
  parameterExtractor: {
    display: 'Extractor',
    displayKey: 'workflow.nodes.parameterExtractor.label',
    icon: IconCrosshair,
    color: 'lime',
    colorHex: '#65a30d',
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
    colorHex: '#4b5563',
    allowedConnections: { sources: ['right'], targets: ['left'] },
    initialData: {
      tool: null,
      args: '',
    },
  },
};

export type NodeType = keyof typeof nodeConfig;
