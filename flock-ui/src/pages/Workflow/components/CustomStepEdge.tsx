import { useState } from 'react';
import { getSmoothStepPath, type EdgeProps, EdgeLabelRenderer } from 'reactflow';
import { ActionIcon } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

export function CustomStepEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [isHovered, setIsHovered] = useState(false);

  const handleCenterClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (data?.onInsertClick) {
      data.onInsertClick('center', e.clientX, e.clientY);
    }
  };

  const handleSourceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (data?.onInsertClick) {
      data.onInsertClick('source', e.clientX, e.clientY);
    }
  };

  const activeStroke = 'var(--flock-accent, #155aef)';
  const baseStroke = style.stroke || 'rgba(21, 90, 239, 0.25)';

  return (
    <>
      {/* Target Edge Line */}
      <path
        id={id}
        style={{
          ...style,
          stroke: isHovered ? activeStroke : baseStroke,
          strokeWidth: isHovered ? 2.5 : 1.8,
          transition: 'stroke 0.15s ease, stroke-width 0.15s ease',
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {/* Broad invisible edge line to handle hover easily */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      
      {isHovered && (
        <EdgeLabelRenderer>
          {/* Branching button (Source Node endpoint) */}
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${sourceX }px, ${sourceY}px)`,
              pointerEvents: 'all',
              zIndex: 1000,
            }}
            className="nodrag nopan"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <ActionIcon
              size="18px"
              radius="xl"
              variant="filled"
              style={{
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                cursor: 'pointer',
                background: 'var(--flock-accent, #155aef)',
              }}
              onClick={handleSourceClick}
            >
              <IconPlus size={11} stroke={3} />
            </ActionIcon>
          </div>

          {/* Insertion button (Center of edge) */}
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 1000,
            }}
            className="nodrag nopan"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <ActionIcon
              size="18px"
              radius="xl"
              variant="filled"
              style={{
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                cursor: 'pointer',
                background: 'var(--flock-accent, #155aef)',
              }}
              onClick={handleCenterClick}
            >
              <IconPlus size={11} stroke={3} />
            </ActionIcon>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
