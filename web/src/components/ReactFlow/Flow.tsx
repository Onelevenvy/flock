import { Box, Flex, Spinner } from "@chakra-ui/react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery } from "react-query";
import ReactFlow, {
  type Connection,
  type Edge,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
  type NodeChange,
} from "reactflow";

import "reactflow/dist/style.css";
import {
  type ApiError,
  type MemberCreate,
  type MemberUpdate,
  type MembersOut,
  MembersService,
} from "../../client";
import ConnectionLine from "./Edges/ConnectionLine";
import defaultEdgeOptions from "./Edges/DefaultEdge";
import { nodeTypes } from "./Nodes";
import useCustomToast from "../../hooks/useCustomToast";

interface FlowComponentProps {
  initialNodes: Node[];
  initialEdges: Edge[];
}

interface EditMemberDataProps {
  id: number;
  requestBody: MemberUpdate;
}

// TODO: Fix issue where a leader node with members is changed to worker, reactflow will warn due to the lost of handles and edges
const FlowComponent = ({ initialNodes, initialEdges }: FlowComponentProps) => {
  const showToast = useCustomToast();
  const { teamId } = useParams() as { teamId: string };
  const connectingNodeId: React.MutableRefObject<string | null> = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition, getNode } = useReactFlow();

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const createMember = async (data: MemberCreate) => {
    return await MembersService.createMember({
      teamId: Number.parseInt(teamId),
      requestBody: data,
    });
  };
  const createMemberMutation = useMutation(createMember, {
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail;

      showToast("Something went wrong.", `${errDetail}`, "error");
    },
  });
  // const addMember = async (data: MemberCreate) => {
  //   return await createMemberMutation.mutateAsync(data)
  // }
  const addMember = useCallback(
    async (data: MemberCreate) => {
      return await createMemberMutation.mutateAsync(data);
    },
    [createMemberMutation],
  );
  const deleteMember = async (id: number) => {
    await MembersService.deleteMember({ teamId: Number.parseInt(teamId), id });
  };
  const deleteMemberMutation = useMutation(deleteMember, {
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail;

      showToast("Something went wrong.", `${errDetail}`, "error");
    },
  });

  // const removeMember = (id: number) => {
  //   deleteMemberMutation.mutate(id)
  // }
  const removeMember = useCallback(
    (id: number) => {
      deleteMemberMutation.mutate(id);
    },
    [deleteMemberMutation],
  );

  const updateMember = async (data: EditMemberDataProps) => {
    const { id, requestBody } = data;

    await MembersService.updateMember({
      id,
      teamId: Number.parseInt(teamId),
      requestBody,
    });
  };
  const updateMemberMutation = useMutation(updateMember, {
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail;

      // suppress error due to update and delete node triggering together
      // TODO: Fix this by using onDelete handler in xyflow v12. See https://github.com/xyflow/xyflow/discussions/3035
      console.error(errDetail);
      // showToast("Something went wrong.", `${errDetail}`, "error")
    },
  });
  // const editMember = (data: EditMemberDataProps) => {
  //   updateMemberMutation.mutate(data);
  // };
  const editMember = useCallback(
    (data: EditMemberDataProps) => {
      updateMemberMutation.mutate(data);
    },
    [updateMemberMutation],
  );
  /**
   * Handle creating a connection between two nodes
   */
  const onConnect = useCallback(
    (params: Edge | Connection) => {
      // reset the start node on connections
      connectingNodeId.current = null;
      setEdges((eds) => addEdge(params, eds));

      if (!params.source || !params.target) return;

      const sourceNode = getNode(params.source);
      const targetNode = getNode(params.target);

      if (!sourceNode || !targetNode) return;

      editMember({
        id: Number.parseInt(targetNode.id),
        requestBody: {
          ...targetNode.data.member,
          source: Number.parseInt(sourceNode.id),
        },
      });
    },
    [setEdges, editMember, getNode],
  );

  const onConnectStart = useCallback((_: any, { nodeId }: any) => {
    connectingNodeId.current = nodeId;
  }, []);

  /**
   * Handle creating a new node at the end of the edge on mouse release.
   */
  const onConnectEnd = useCallback(
    async (event: any) => {
      if (!connectingNodeId.current) return;
      const targetIsPane = event.target.classList.contains("react-flow__pane");

      const sourceType = nodes.filter(
        (node) => node.id === connectingNodeId.current,
      )[0].type;

      if (targetIsPane && sourceType) {
        // we need to remove the wrapper bounds, in order to get the correct position
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        const newNodeType = sourceType.startsWith("freelancer")
          ? "freelancer"
          : "worker";
        // TODO: Fix bug when node.length is smaller than labelling due to deleted nodes
        const memberData = {
          name: `Worker${nodes.length}`,
          backstory: null,
          role: "Answer any questions you are given.",
          // if previous node is a freelancer, than next node should be a freelancer
          type: newNodeType,
          belongs_to: teamId,
          owner_of: null,
          position_x: position.x,
          position_y: position.y,
          source: Number.parseInt(connectingNodeId.current),
        };
        const member = await addMember(memberData);
        const nodeId = `${member.id}`;
        const newNode = {
          id: nodeId,
          position,
          type: newNodeType,
          data: {
            teamId,
            member,
          },
          origin: [0.5, 0],
        };

        setNodes((nds) => nds.concat(newNode));
        setEdges((eds) =>
          eds.concat({
            id: nodeId,
            source: connectingNodeId.current!,
            target: nodeId,
          }),
        );
      }
    },
    [screenToFlowPosition, setEdges, setNodes, teamId, nodes, addMember],
  );

  /**
   * Trigger API to remove nodes to be deleted. Dont delete root nodes.
   */
  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      for (const deletedNode of deletedNodes) {
        // Skip root node
        if (deletedNode.type?.endsWith("root")) continue;
        removeMember(deletedNode.data.member.id);
      }
    },
    [removeMember],
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      for (const deletedEdge of deletedEdges) {
        const sourceNode = getNode(deletedEdge.source);
        const targetNode = getNode(deletedEdge.target);

        if (!sourceNode || !targetNode) continue;
        editMember({
          id: Number.parseInt(targetNode.id),
          requestBody: {
            ...targetNode.data.member,
            source: null,
          },
        });
      }
    },
    [editMember, getNode],
  );

  const handleNodesChange = (changes: NodeChange[]) => {
    // Filter items in nextChanges that is about removing root
    const nextChanges = changes.reduce((prev, change) => {
      if (change.type === "remove") {
        const node = getNode(change.id);

        if (node?.type?.endsWith("root")) {
          return prev;
        }

        prev.push(change);

        return prev;
      }

      prev.push(change);

      return prev;
    }, [] as NodeChange[]);

    onNodesChange(nextChanges);
  };

  // TODO: Fix issue where edit is triggered when trying to delete a node
  const onNodeDragStop = (_event: any, node: Node) => {
    if (!node || !node.dragging) return;

    editMember({
      id: Number.parseInt(node.id),
      requestBody: {
        ...node.data.member,
        position_x: node.position.x,
        position_y: node.position.y,
      },
    });
  };

  return (
    <Box flexGrow={1} maxH="85vh" height="full" my={2}>
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeDragStop={onNodeDragStop}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineComponent={ConnectionLine}
        snapToGrid
        fitView
        nodeOrigin={[0.5, 0]}
      />
    </Box>
  );
};

/**
 * Convert the list of team members into nodes and edges
 * @param membersOut Response from read_members endpoint
 * @returns Object containing the nodes and edges
 */
const importTeamMembers = (membersOut: MembersOut) => {
  const nodes = [];
  const edges = [];

  for (const member of membersOut.data) {
    const node = {
      id: `${member.id}`,
      type: member.type,
      data: { teamId: member.belongs_to, member: member },
      position: { x: member.position_x, y: member.position_y },
    };

    nodes.push(node);

    if (!member.source) continue;

    const edge = {
      id: `${member.id}->${member.source}`,
      source: `${member.source}`,
      target: `${member.id}`,
    };

    edges.push(edge);
  }

  return { nodes, edges };
};

export default function Fflow() {
  const { teamId } = useParams() as { teamId: string };
  const showToast = useCustomToast();
  const {
    data: members,
    isLoading,
    isError,
    error,
  } = useQuery(`teams/${teamId}/members`, () =>
    MembersService.readMembers({ teamId: Number.parseInt(teamId) }),
  );

  if (isError) {
    const errDetail = (error as ApiError).body?.detail;

    showToast("Something went wrong.", `${errDetail}`, "error");
  }

  const { nodes, edges } = members
    ? importTeamMembers(members)
    : { nodes: [], edges: [] };

  return (
    <>
      {isLoading ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <ReactFlowProvider>
          <FlowComponent initialNodes={nodes} initialEdges={edges} />
        </ReactFlowProvider>
      )}
    </>
  );
}
