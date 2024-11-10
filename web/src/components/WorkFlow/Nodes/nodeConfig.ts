import {
  FaPlay,
  FaRobot,
  FaStop,
  FaTools,
  FaCommentDots,
  FaDatabase } from "react-icons/fa";
import { FaBookAtlas } from "react-icons/fa6";
import { TfiGithub } from "react-icons/tfi";

import AnswerNodeProperties from "./Answer/AnswerNodeProperties";
import EndNodeProperties from "./End/EndNodeProperties";
import LLMNodeProperties from "./LLM/LLMNodeProperties";
import PluginNodeProperties from "./Plugin/PluginNodeProperties";
import RetrievalProperties from "./Retrieval/RetrievalNodeProperties";
import RetrievalToolNodeProperties from "./RetrievalTool/RetrievalToolNodeProperties";
import StartNodeProperties from "./Start/StartNodeProperties";
import ToolNodeProperties from "./Tool/ToolNodeProperties";
import CrewAINodeProperties from "./CrewAI/CrewAINodeProperties";


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
    colorScheme: "pink",
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
    display: "Tools",
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
  retrieval: {
    display: "Knowledge Retrieval",
    icon: FaBookAtlas,
    colorScheme: "teal",
    properties: RetrievalProperties,
    initialData: {
      query: null,
      rag_method: "Adaptive_RAG",
      knownledge_database: [],
      usr_id: "",
      kb_id: "",
    },
    allowedConnections: {
      sources: ["left", "right"],
      targets: ["left", "right"],
    },
    inputVariables: [],
    outputVariables: ["result"],
  },
  toolretrieval: {
    display: "Retrieval As Tools",
    icon: FaDatabase,
    colorScheme: "red",
    properties: RetrievalToolNodeProperties,
    allowedConnections: {
      sources: ["left", "right"],
      targets: ["left", "right"],
    },
    initialData: {
      tools: [],
    },
    inputVariables: [],
    outputVariables: ["output"],
  },
  crewai: {
    display: "CrewAI",
    icon: FaRobot,
    colorScheme: "purple",
    properties: CrewAINodeProperties,
    allowedConnections: {
      sources: ["left", "right"],
      targets: ["left", "right"]
    },
    initialData: {
      agents: [],
      tasks: [],
      process_type: "sequential",
      llm_config: {},
      manager_config: {}
    },
    inputVariables: [],
    outputVariables: ["result"]
  }
};

export type NodeType = keyof typeof nodeConfig;
