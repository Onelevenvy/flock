// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import type { Edge, Node } from "@xyflow/react";
import {
  Brain,
  FilePen,
  MessageSquareQuote,
  Microscope,
  SquareTerminal,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type GraphNode = Node<{
  label: string;
  icon?: LucideIcon;
  active?: boolean;
}>;

export type Graph = {
  nodes: GraphNode[];
  edges: Edge[];
};

const ROW_HEIGHT = 85;
const ROW_1 = 0;
const ROW_2 = ROW_HEIGHT;
const ROW_3 = ROW_HEIGHT * 2;
const ROW_4 = ROW_HEIGHT * 2;
const ROW_5 = ROW_HEIGHT * 3;
const ROW_6 = ROW_HEIGHT * 4;

export const graph: Graph = {
  nodes: [
    {
      id: "Start",
      type: "circle",
      data: { label: "Start" },
      position: { x: -75, y: ROW_1 },
    },
    {
      id: "Coordinator",
      data: { icon: MessageSquareQuote, label: "Coordinator" },
      position: { x: 150, y: ROW_1 },
    },
    {
      id: "Planner",
      data: { icon: Brain, label: "Planner" },
      position: { x: 150, y: ROW_2 },
    },
    {
      id: "Reporter",
      data: { icon: FilePen, label: "Reporter" },
      position: { x: 275, y: ROW_3 },
    },
    {
      id: "HumanFeedback",
      data: { icon: UserCheck, label: "Human Feedback" },
      position: { x: 25, y: ROW_4 },
    },
    {
      id: "ResearchTeam",
      data: { icon: Users, label: "Research Team" },
      position: { x: 25, y: ROW_5 },
    },
    {
      id: "Researcher",
      data: { icon: Microscope, label: "Researcher" },
      position: { x: -75, y: ROW_6 },
    },
    {
      id: "Coder",
      data: { icon: SquareTerminal, label: "Coder" },
      position: { x: 125, y: ROW_6 },
    },
    {
      id: "End",
      type: "circle",
      data: { label: "End" },
      position: { x: 330, y: ROW_6 },
    },
  ],
  edges: [
    {
      id: "Start->Coordinator",
      source: "Start",
      target: "Coordinator",
      sourceHandle: "right",
      targetHandle: "left",
      animated: true,
    },
    {
      id: "Coordinator->Planner",
      source: "Coordinator",
      target: "Planner",
      sourceHandle: "bottom",
      targetHandle: "top",
      animated: true,
    },
    {
      id: "Planner->Reporter",
      source: "Planner",
      target: "Reporter",
      sourceHandle: "right",
      targetHandle: "top",
      animated: true,
    },
    {
      id: "Planner->HumanFeedback",
      source: "Planner",
      target: "HumanFeedback",
      sourceHandle: "left",
      targetHandle: "top",
      animated: true,
    },
    {
      id: "HumanFeedback->Planner",
      source: "HumanFeedback",
      target: "Planner",
      sourceHandle: "right",
      targetHandle: "bottom",
      animated: true,
    },
    {
      id: "HumanFeedback->ResearchTeam",
      source: "HumanFeedback",
      target: "ResearchTeam",
      sourceHandle: "bottom",
      targetHandle: "top",
      animated: true,
    },
    {
      id: "Reporter->End",
      source: "Reporter",
      target: "End",
      sourceHandle: "bottom",
      targetHandle: "top",
      animated: true,
    },
    {
      id: "ResearchTeam->Researcher",
      source: "ResearchTeam",
      target: "Researcher",
      sourceHandle: "left",
      targetHandle: "top",
      animated: true,
    },
    {
      id: "ResearchTeam->Coder",
      source: "ResearchTeam",
      target: "Coder",
      sourceHandle: "bottom",
      targetHandle: "left",
      animated: true,
    },
    {
      id: "ResearchTeam->Planner",
      source: "ResearchTeam",
      target: "Planner",
      sourceHandle: "right",
      targetHandle: "bottom",
      animated: true,
    },
    {
      id: "Researcher->ResearchTeam",
      source: "Researcher",
      target: "ResearchTeam",
      sourceHandle: "right",
      targetHandle: "bottom",
      animated: true,
    },
    {
      id: "Coder->ResearchTeam",
      source: "Coder",
      target: "ResearchTeam",
      sourceHandle: "top",
      targetHandle: "right",
      animated: true,
    },
  ],
};
