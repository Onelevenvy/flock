import {
  FaPlay,
  FaRobot,
  FaStop,
  FaTools,
  FaCommentDots,
} from "react-icons/fa";

import { TfiGithub } from "react-icons/tfi";
import EndNodeProperties from "./End/EndNodeProperties";
import LLMNodeProperties from "./LLM/LLMNodeProperties";

import StartNodeProperties from "./Start/StartNodeProperties";
import ToolNodeProperties from "./Tool/ToolNodeProperties";
import PluginNodeProperties from "./Plugin/PluginNodeProperties";
import AnswerNodeProperties from "./Answer/AnswerNodeProperties";

interface NodeConfigItem {
  display: string;
  icon: React.ComponentType;
  colorScheme: string;
  properties: React.ComponentType<any>;
  allowedConnections: {
    sources: string[];
    targets: string[];
  };
  initialData?: Record<string, any>;
  inputVariables: string[];
  outputVariables: string[];
}

export const nodeConfig: Record<string, NodeConfigItem> = {
  start: {
    display: "Start",
    icon: FaPlay,
    colorScheme: "green",
    properties: StartNodeProperties,
    allowedConnections: {
      sources: ["right"],
      targets: [],
    },
    inputVariables: [],
    outputVariables: ["query"],
  },
  end: {
    display: "End",
    icon: FaStop,
    colorScheme: "red",
    properties: EndNodeProperties,
    allowedConnections: {
      sources: [],
      targets: ["left"],
    },
    inputVariables: [],
    outputVariables: [],
  },
  llm: {
    display: "LLM",
    icon: FaRobot,
    colorScheme: "blue",
    properties: LLMNodeProperties,
    allowedConnections: {
      sources: ["left", "right"],
      targets: ["left", "right"],
    },
    initialData: {
      model: "glm-4-flash",
      temperature: 0.1,
      systemMessage: null,
    },
    inputVariables: [],
    outputVariables: ["response"],
  },
  tool: {
    display: "Tool",
    icon: FaTools,
    colorScheme: "purple",
    properties: ToolNodeProperties,
    allowedConnections: {
      sources: ["left", "right"],
      targets: ["left", "right"],
    },
    initialData: {
      tools: ["Open Weather"],
    },
    inputVariables: [],
    outputVariables: ["output"],
  },
  plugin: {
    display: "Plugin",
    icon: TfiGithub,
    colorScheme: "gray",
    properties: PluginNodeProperties,
    initialData: {
      toolName: "",
      args: {},
    },
    allowedConnections: {
      sources: ["right"],
      targets: ["left"],
    },
    inputVariables: [],
    outputVariables: ["output"],
  },
  answer: {
    display: "Answer",
    icon: FaCommentDots,
    colorScheme: "orange",
    properties: AnswerNodeProperties,
    initialData: {
      answer: null,
    },
    allowedConnections: {
      sources: ["left", "right"],
      targets: ["left", "right"],
    },
    inputVariables: [],
    outputVariables: ["output"],
  },
};

export type NodeType = keyof typeof nodeConfig;