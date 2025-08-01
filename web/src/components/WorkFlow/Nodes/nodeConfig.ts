import {
  FaPlay,
  FaRobot,
  FaStop,
  FaCommentDots,
  FaDatabase,
  FaCode,
  FaCodeBranch,
  FaUserCog,
  FaProjectDiagram,
  FaCrosshairs,
  FaUserAstronaut,
} from "react-icons/fa";
import { FaBookAtlas, FaPeopleGroup } from "react-icons/fa6";
import { TfiGithub } from "react-icons/tfi";
import { v4 as uuidv4 } from "uuid";
import { LuBrainCircuit } from "react-icons/lu";
import AnswerNodeProperties from "./Answer/AnswerNodeProperties";
import EndNodeProperties from "./End/EndNodeProperties";
import LLMNodeProperties from "./LLM/LLMNodeProperties";
import PluginNodeProperties from "./Plugin/PluginNodeProperties";
import RetrievalProperties from "./Retrieval/RetrievalNodeProperties";
import RetrievalToolNodeProperties from "./RetrievalTool/RetrievalToolNodeProperties";
import StartNodeProperties from "./Start/StartNodeProperties";

import CrewAINodeProperties from "./CrewAI/CrewAINodeProperties";
import ClassifierNodeProperties from "./Classifier/ClassifierNodeProperties";

import CodeNodeProperties from "./Code/CodeNodeProperties";
import IfElseNodeProperties from "./IfElse/IfElseNodeProperties";
import { LogicalOperator } from "../types";
import HumanNodeProperties from "./Human/HumanNodeProperties";
import SubgraphNodeProperties from "./Subgraph/SubgraphNodeProperties";
import ParameterExtractorNodeProperties from "./ParameterExtractor/ParameterExtractorNodeProperties";

import AgentNodeProperties from "./Agent/AgentNodeProperties";

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
  outputVariables: string[] | ((data: any) => { name: string; type: string }[]);
  outputSchema?: any
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
    outputSchema: {          
      query: 'String'
    }
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
      systemMessage: "",
      userMessage: "${start.query}",
    },
    inputVariables: [],
    outputVariables: ["response"],
    outputSchema: {           
      response: 'String'
    }
    
  },
  agent: {
    display: "Agent",
    icon: FaUserAstronaut,
    colorScheme: "yellow",
    properties: AgentNodeProperties,
    allowedConnections: {
      sources: ["left", "right"],
      targets: ["left", "right"],
    },
    outputVariables: ["response"],
    outputSchema: {           
      response: 'String'
    },
    inputVariables: [],
    initialData: {
      model: "glm-4-flash",
      temperature: 0.1,
      systemMessage: "",
      userMessage: "",
      tools: [{
      }],
      retrievalTools: [],
    },
  },
  plugin: {
    display: "Plugin",
    icon: TfiGithub,
    colorScheme: "gray",
    properties: PluginNodeProperties,
    initialData: {
      toolName: "",
      args: "",
      tool: {
        id: 2,
        name: "Math Calculator",
        provider: "math",
      },
    },
    allowedConnections: {
      sources: ["right"],
      targets: ["left"],
    },
    inputVariables: [],
    outputVariables: ["response"],
    outputSchema: {           
      response: 'String'
    }
  },

  retrieval: {
    display: "KB Retrieval",
    icon: FaBookAtlas,
    colorScheme: "red",
    properties: RetrievalProperties,
    initialData: {
      query: null,
      rag_method: "Adaptive_RAG",
      knownledge_database: [],
      usr_id: "",
      kb_id: "",
    },
    allowedConnections: {
      sources: ["right"],
      targets: ["left"],
    },
    inputVariables: [],
    outputVariables: ["response"],
    outputSchema: {           
      response: 'String'
    }
  },
  toolretrieval: {
    display: "Retrieval As Tools",
    icon: FaDatabase,
    colorScheme: "teal",
    properties: RetrievalToolNodeProperties,
    allowedConnections: {
      sources: ["right"],
      targets: ["left"],
    },
    initialData: {
      tools: [],
    },
    inputVariables: [],
    outputVariables: ["response"],
    outputSchema: {           
      response: 'String'
    }
  },
  crewai: {
    display: "CrewAI",
    icon: FaPeopleGroup,
    colorScheme: "purple",
    properties: CrewAINodeProperties,
    allowedConnections: {
      sources: ["right"],
      targets: ["left"],
    },
    initialData: {
      agents: [],
      tasks: [],
      process_type: "sequential",
      llm_config: {},
      manager_config: {},
    },
    inputVariables: [],
    outputVariables: ["response"],
    outputSchema: {           
      response: 'String'
    }
  },
  classifier: {
    icon: LuBrainCircuit,
    display: "Intent Recognition",
    colorScheme: "pink",
    properties: ClassifierNodeProperties,
    allowedConnections: {
      sources: [],
      targets: ["input"],
    },
    outputVariables: ["class_name"],
    outputSchema: {           
      class_name: 'String'
    },
    inputVariables: ["Input"],
    initialData: {
      categories: [
        { category_id: uuidv4(), category_name: "" },
        { category_id: "others_category", category_name: "Others Intent" },
      ],
      model: "glm-4-flash",
    },
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
      sources: ["right"],
      targets: ["left"],
    },
    inputVariables: [],
    outputVariables: ["response"],
    outputSchema: {           
      response: 'String'
    }
  },
  code: {
    display: "Code Execution",
    icon: FaCode,
    colorScheme: "purple",
    properties: CodeNodeProperties,
    allowedConnections: {
      sources: ["right"],
      targets: ["left"],
    },
    outputVariables: ["code_result"],
    outputSchema: {           
      code_result: 'String'
    },
    inputVariables: [],
    initialData: {
      code: "",
      language: "python",
    },
  },
  ifelse: {
    display: "If-Else",
    icon: FaCodeBranch,
    colorScheme: "purple",
    properties: IfElseNodeProperties,
    initialData: {
      cases: [
        {
          case_id: uuidv4(),
          logical_operator: LogicalOperator.and,
          conditions: [],
        },
        {
          case_id: "false_else",
          logical_operator: LogicalOperator.and,
          conditions: [],
        },
      ],
    },
    allowedConnections: {
      sources: [],
      targets: ["left"],
    },
    inputVariables: [],
    outputVariables: ["result"],
    outputSchema: {           
      result: 'String'
    }
  },
  human: {
    display: "Human Interaction",
    icon: FaUserCog,
    colorScheme: "purple",
    properties: HumanNodeProperties,
    allowedConnections: {
      sources: ["right"],
      targets: ["left"],
    },
    inputVariables: [],
    outputVariables: ["response", "action"],
    outputSchema: {                  // <-- 在这里加上 Schema
      response: 'String',
      action: 'String'
    },
    initialData: {
      interaction_type: "tool_review",
      routes: {
        approved: "",
        rejected: "",
        update: "",
        feedback: "",
      },
      title: "",
    },
  },
  subgraph: {
    display: "Subgraph",
    icon: FaProjectDiagram,
    colorScheme: "teal",
    properties: SubgraphNodeProperties,
    allowedConnections: {
      sources: ["right"],
      targets: ["left"],
    },

    initialData: {
      subgraphId: "",
      description: "",
    },
    inputVariables: ["Input"],
    outputVariables: ["response"],
    outputSchema: {           
      response: 'String'
    }
  },
  parameterExtractor: {
    display: "Parameter Extractor",
    icon: FaCrosshairs,
    colorScheme: "cyan",
    properties: ParameterExtractorNodeProperties,
    allowedConnections: {
      sources: ["right"],
      targets: ["left"],
    },
    initialData: {
      model: "glm-4-flash",
      parameters: [],
      toolImport: null,
    },
    inputVariables: ["Input"],
    outputVariables: (data: any): { name: string; type: string }[] => {
      if (data && Array.isArray(data.parameters)) {
        return data.parameters.map((param: any) => {
          const name = Object.keys(param)[0];
          const type = param[name]?.type || 'any';
          return { name, type }; // 确保返回的是包含 name 和 type 的对象
        });
      }
      return [];
    },
  },
};

export type NodeType = keyof typeof nodeConfig;
