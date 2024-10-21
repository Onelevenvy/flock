import type { NodeTypes } from "reactflow";

import { FreelancerNode } from "./FreelancerNode";
import { MemberNode } from "./MemberNode";
import { RootNode } from "./RootNode";

export const nodeTypes = {
  worker: MemberNode,
  leader: MemberNode,
  freelancer: FreelancerNode,
  freelancer_root: FreelancerNode,
  root: RootNode,
} satisfies NodeTypes;
