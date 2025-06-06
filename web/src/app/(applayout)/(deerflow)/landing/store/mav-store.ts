// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

import { create } from "zustand";

import { sleep } from "@/components/DeerFlow/core/utils";

import { graph, type Graph } from "./graph";
import { playbook } from "./playbook";

// Store for MAV(Multi-Agent Visualization)
export const useMAVStore = create<{
  graph: Graph;
  activeStepIndex: number;
  playing: boolean;
}>(() => ({
  graph,
  activeStepIndex: -1,
  playing: false,
}));

export function activateStep(stepIndex: number) {
  const nextStep = playbook.steps[stepIndex]!;
  const currentGraph = useMAVStore.getState().graph;
  const nextGraph: Graph = {
    nodes: currentGraph.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        active: nextStep.activeNodes.includes(node.id),
        stepDescription:
          nextStep.activeNodes.indexOf(node.id) ===
            nextStep.activeNodes.length - 1 && nextStep.description,
        stepTooltipPosition:
          nextStep.activeNodes.indexOf(node.id) ===
            nextStep.activeNodes.length - 1 && nextStep.tooltipPosition,
      },
    })),
    edges: currentGraph.edges.map((edge) => ({
      ...edge,
      animated: nextStep.activeEdges.includes(edge.id),
    })),
  };
  useMAVStore.setState({
    activeStepIndex: stepIndex,
    graph: nextGraph,
  });
}

export function nextStep() {
  let stepIndex = useMAVStore.getState().activeStepIndex;
  if (stepIndex >= playbook.steps.length - 1) {
    stepIndex = 0;
  } else {
    stepIndex++;
  }
  activateStep(stepIndex);
}

export function prevStep() {
  let stepIndex = useMAVStore.getState().activeStepIndex;
  if (stepIndex <= 0) {
    stepIndex = playbook.steps.length - 1;
  } else {
    stepIndex--;
  }
  activateStep(stepIndex);
}

export async function play() {
  const state = useMAVStore.getState();
  const activeStepIndex = state.activeStepIndex;
  if (activeStepIndex >= playbook.steps.length - 1) {
    if (state.playing) {
      stop();
      return;
    }
  }
  useMAVStore.setState({
    playing: true,
  });
  nextStep();
  await sleep(3000);
  const playing = useMAVStore.getState().playing;
  if (playing) {
    await play();
  }
}

export function pause() {
  useMAVStore.setState({
    playing: false,
  });
}

export async function togglePlay() {
  const playing = useMAVStore.getState().playing;
  if (playing) {
    pause();
  } else {
    await play();
  }
}

export function stop() {
  useMAVStore.setState({
    playing: false,
    activeStepIndex: -1,
    graph,
  });
}
