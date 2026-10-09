import WorkflowRunProgress from './WorkflowRunProgress'
import type { AgentWorkflow } from '../../../../shared/workflow-types'

const CANVAS_W = 4000
const CANVAS_H = 3000
const NODE_W = 160
const NODE_H_MID = 24

type Props = {
  workflowId: string
  nodes: AgentWorkflow['nodes']
  edges: AgentWorkflow['edges']
  draggingPos: { nodeId: string; x: number; y: number } | null
  nodePositions: Record<string, { x: number; y: number }>
  onDeleteEdge: (edgeId: string) => void
}

export default function WorkflowCanvasEdgesLayer({
  workflowId,
  nodes,
  edges,
  draggingPos,
  nodePositions,
  onDeleteEdge
}: Props): React.JSX.Element {
  function ep(nodeId: string, stored: { x: number; y: number }): { x: number; y: number } {
    return draggingPos?.nodeId === nodeId ? { x: draggingPos.x, y: draggingPos.y } : stored
  }
  return (
    <>
      <svg
        className="absolute inset-0"
        style={{ width: CANVAS_W, height: CANVAS_H, pointerEvents: 'none' }}
      >
        {edges.map((edge) => {
          const src = nodes.find((n) => n.id === edge.sourceNodeId)
          const tgt = nodes.find((n) => n.id === edge.targetNodeId)
          if (!src || !tgt) {
            return null
          }
          const sp = ep(src.id, src.pos)
          const tp = ep(tgt.id, tgt.pos)
          const x1 = sp.x + NODE_W
          const y1 = sp.y + NODE_H_MID
          const x2 = tp.x
          const y2 = tp.y + NODE_H_MID
          const cp = Math.max(60, Math.abs(x2 - x1) / 2)
          const d = `M${x1},${y1} C${x1 + cp},${y1} ${x2 - cp},${y2} ${x2},${y2}`
          return (
            <g
              key={edge.id}
              style={{ pointerEvents: 'all', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                onDeleteEdge(edge.id)
              }}
            >
              <path d={d} fill="none" stroke="transparent" strokeWidth={12} />
              <path
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeDasharray="6 3"
                strokeLinecap="round"
                className="text-foreground/60 hover:text-destructive transition-colors"
              />
            </g>
          )
        })}
      </svg>
      <WorkflowRunProgress workflowId={workflowId} nodePositions={nodePositions} />
    </>
  )
}
