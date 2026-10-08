import { useState, useRef, useEffect } from 'react'
import { Maximize2, Minimize2, Plus, Workflow, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { createBrowserUuid } from '@/lib/browser-uuid'
import WorkflowRunProgress from './WorkflowRunProgress'
import {
  NODE_TYPE_LABELS,
  NODE_TYPE_COLORS,
  nodeLabel,
  ADD_NODE_TYPES,
  buildDefaultNode
} from './workflow-canvas-node-config'
import type { AgentWorkflow, WorkflowNodeType } from '../../../../shared/workflow-types'

type Props = {
  workflow: AgentWorkflow | null
  focused: boolean
  onFocus: () => void
  onUnfocus: () => void
  onNodeSelect: (nodeId: string | null) => void
  selectedNodeId: string | null
}

export default function WorkflowCanvas({
  workflow,
  focused,
  onFocus,
  onUnfocus,
  onNodeSelect,
  selectedNodeId
}: Props): React.JSX.Element {
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [draggingPos, setDraggingPos] = useState<{ nodeId: string; x: number; y: number } | null>(
    null
  )
  const dragRef = useRef<{
    nodeId: string
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)

  useEffect(() => {
    if (!connectingFrom) {
      return
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setConnectingFrom(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [connectingFrom])

  if (workflow === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <Workflow className="size-8 opacity-30" strokeWidth={1.25} />
        <span className="text-[13px]">
          {translate('workflows.canvas.empty', 'Select or create a workflow to start editing.')}
        </span>
      </div>
    )
  }

  async function connectNodes(sourceId: string, targetId: string): Promise<void> {
    if (!workflow || sourceId === targetId) {
      return
    }
    const alreadyExists = workflow.edges.some(
      (e) => e.sourceNodeId === sourceId && e.targetNodeId === targetId
    )
    if (alreadyExists) {
      return
    }
    await window.api.workflows.update(workflow.id, {
      edges: [
        ...workflow.edges,
        { id: createBrowserUuid(), sourceNodeId: sourceId, targetNodeId: targetId }
      ]
    })
  }

  async function deleteEdge(edgeId: string): Promise<void> {
    if (!workflow) {
      return
    }
    await window.api.workflows.update(workflow.id, {
      edges: workflow.edges.filter((e) => e.id !== edgeId)
    })
  }

  async function deleteNode(nodeId: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    if (!workflow) {
      return
    }
    await window.api.workflows.update(workflow.id, {
      nodes: workflow.nodes.filter((n) => n.id !== nodeId),
      edges: workflow.edges.filter(
        (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId
      )
    })
    if (selectedNodeId === nodeId) {
      onNodeSelect(null)
    }
  }

  async function addNode(type: WorkflowNodeType): Promise<void> {
    if (!workflow) {
      return
    }
    setShowAddMenu(false)
    const id = createBrowserUuid()
    const pos = { x: 80 + workflow.nodes.length * 160, y: 80 }
    const newNode = buildDefaultNode(id, type, pos)
    await window.api.workflows.update(workflow.id, {
      nodes: [...workflow.nodes, newNode]
    })
  }

  function handleMouseDown(e: React.MouseEvent, nodeId: string): void {
    e.stopPropagation()
    const node = workflow?.nodes.find((n) => n.id === nodeId)
    if (!node) {
      return
    }
    dragRef.current = {
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      origX: node.pos.x,
      origY: node.pos.y
    }
    let rafId = 0
    const onMouseMove = (ev: MouseEvent): void => {
      if (!dragRef.current) {
        return
      }
      cancelAnimationFrame(rafId)
      const snap = { ...dragRef.current, clientX: ev.clientX, clientY: ev.clientY }
      rafId = requestAnimationFrame(() => {
        const dx = snap.clientX - snap.startX
        const dy = snap.clientY - snap.startY
        setDraggingPos({ nodeId: snap.nodeId, x: snap.origX + dx, y: snap.origY + dy })
      })
    }
    const onMouseUp = async (ev: MouseEvent): Promise<void> => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      setDraggingPos(null)
      if (!dragRef.current || !workflow) {
        return
      }
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      const newPos = { x: dragRef.current.origX + dx, y: dragRef.current.origY + dy }
      dragRef.current = null
      await window.api.workflows.update(workflow.id, {
        nodes: workflow.nodes.map((n) => (n.id === nodeId ? { ...n, pos: newPos } : n))
      })
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function effectivePos(
    nodeId: string,
    stored: { x: number; y: number }
  ): { x: number; y: number } {
    if (draggingPos?.nodeId === nodeId) {
      return { x: draggingPos.x, y: draggingPos.y }
    }
    return stored
  }

  // Collect node positions for the run progress overlay
  const nodePositions: Record<string, { x: number; y: number }> = {}
  for (const node of workflow.nodes) {
    nodePositions[node.id] = node.pos
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-muted/10">
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <Button
          size="icon"
          variant="outline"
          className="size-7"
          onClick={() => setShowAddMenu((v) => !v)}
          title="Add node"
        >
          <Plus className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="size-7"
          onClick={focused ? onUnfocus : onFocus}
          title={focused ? 'Exit focus' : 'Focus canvas'}
        >
          {focused ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </Button>
      </div>
      {showAddMenu && (
        <div className="absolute top-11 right-2 z-20 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[160px]">
          {ADD_NODE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className="w-full px-3 py-1.5 text-left text-[12px] hover:bg-muted transition-colors"
              onClick={() => void addNode(type)}
            >
              {NODE_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      )}
      <div
        className={cn('relative w-full h-full', connectingFrom && 'cursor-crosshair')}
        onClick={() => {
          if (connectingFrom) {
            setConnectingFrom(null)
            return
          }
          onNodeSelect(null)
          setShowAddMenu(false)
        }}
      >
        {connectingFrom && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-primary text-primary-foreground text-[11px] px-2 py-1 rounded shadow pointer-events-none">
            Click a target node to connect — Esc to cancel
          </div>
        )}
        {/* edges — pointer-events enabled so left-click deletes */}
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
          {workflow.edges.map((edge) => {
            const src = workflow.nodes.find((n) => n.id === edge.sourceNodeId)
            const tgt = workflow.nodes.find((n) => n.id === edge.targetNodeId)
            if (!src || !tgt) {
              return null
            }
            const sp = effectivePos(src.id, src.pos)
            const tp = effectivePos(tgt.id, tgt.pos)
            const x1 = sp.x + 80
            const y1 = sp.y + 24
            const x2 = tp.x + 80
            const y2 = tp.y + 24
            const mx = (x1 + x2) / 2
            return (
              <g
                key={edge.id}
                style={{ pointerEvents: 'all', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  void deleteEdge(edge.id)
                }}
              >
                {/* wide transparent hit area */}
                <path
                  d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                />
                {/* visible bezier edge */}
                <path
                  d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
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
        {/* Run progress overlays (behind nodes, pointer-events-none) */}
        <WorkflowRunProgress workflowId={workflow.id} nodePositions={nodePositions} />
        {workflow.nodes.map((node) => (
          <div
            id={`wf-node-${node.id}`}
            key={node.id}
            className={cn(
              'absolute select-none rounded-lg border-2 px-3 py-2 shadow-sm transition-shadow min-w-[160px] group',
              connectingFrom ? 'cursor-crosshair' : 'cursor-move',
              NODE_TYPE_COLORS[node.type],
              selectedNodeId === node.id && 'ring-2 ring-primary ring-offset-1',
              connectingFrom === node.id && 'ring-2 ring-primary ring-offset-2 opacity-60'
            )}
            style={{
              left: effectivePos(node.id, node.pos).x,
              top: effectivePos(node.id, node.pos).y
            }}
            onMouseDown={(e) => {
              if (!connectingFrom) {
                handleMouseDown(e, node.id)
              }
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (connectingFrom) {
                void connectNodes(connectingFrom, node.id)
                setConnectingFrom(null)
                return
              }
              onNodeSelect(node.id)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setConnectingFrom(node.id)
              setShowAddMenu(false)
            }}
          >
            {/* Delete button — visible on hover */}
            <button
              type="button"
              className="absolute -top-2 -right-2 size-4 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-sm z-10"
              onClick={(e) => void deleteNode(node.id, e)}
              title="Delete node"
            >
              <X className="size-2.5" />
            </button>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
              {NODE_TYPE_LABELS[node.type]}
            </div>
            <div className="text-[12px] font-medium truncate max-w-[140px]">{nodeLabel(node)}</div>
          </div>
        ))}
        {workflow.nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/50 pointer-events-none">
            <span className="text-[13px]">
              {translate('workflows.canvas.addNode', 'Click + to add nodes')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
