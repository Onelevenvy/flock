import { useMemo } from "react";
import { Handle, getConnectedEdges, useNodeId, useStore } from "reactflow";

const selector = (s: { nodeInternals: any; edges: any }) => ({
  nodeInternals: s.nodeInternals,
  edges: s.edges,
});

interface LimitConnectionHandleProps
  extends React.ComponentProps<typeof Handle> {
  connectionLimit?: number;
}

const LimitConnectionHandle = ({
  connectionLimit,
  ...props
}: LimitConnectionHandleProps) => {
  const { nodeInternals, edges } = useStore(selector);
  const nodeId = useNodeId();

  const isHandleConnectable = useMemo(() => {
    if (connectionLimit !== undefined) {
      const node = nodeInternals.get(nodeId);

      const connectedEdges = getConnectedEdges([node], edges).filter((edge) =>
        props.type === "target"
          ? edge.target === nodeId
          : edge.source === nodeId,
      );

      return connectedEdges.length < connectionLimit;
    }
  }, [nodeInternals, edges, nodeId, connectionLimit, props.type]);

  return <Handle {...props} isConnectable={isHandleConnectable} />;
};

export default LimitConnectionHandle;
