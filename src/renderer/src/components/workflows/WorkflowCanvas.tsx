import { useState, useRef } from 'react'
import { Maximize2, Minimize2, Plus, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { createBrowserUuid } from '@/lib/browser-uuid'
import type {
  AgentWorkflow,
  WorkflowNode,
  WorkflowNodeType
} from '../../../../shared/workflow-types'

type Props = {
  workflow: AgentWorkflow | null
  focused: boolean
  onFocus: () => void
  onUnfocus: () => void
  onNodeSelect: (nodeId: string | null) => void
  selectedNodeId: string | null
}

const NODE_TYPE_LABELS: Record<WorkflowNodeType, string> = {
  trigger_cron: 'Cron Trigger',
  trigger_manual: 'Manual Trigger',
  shell_command: 'Shell Command',
  python_script: 'Python Script',
  agent_call: 'Agent Call',
  file_read: 'File Read',
  file_write: 'File Write',
  email_send: 'Email Send',
  json_transform: 'JSON Transform'
}

const NODE_TYPE_COLORS: Record<WorkflowNodeType, string> = {
  trigger_cron: 'border-violet-400 bg-violet-50 dark:bg-violet-950/30',
  trigger_manual: 'border-violet-400 bg-violet-50 dark:bg-violet-950/30',
  shell_command: 'border-slate-400 bg-slate-50 dark:bg-slate-900/30',
  python_script: 'border-blue-400 bg-blue-50 dark:bg-blue-950/30',
  agent_call: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30',
  file_read: 'border-amber-400 bg-amber-50 dark:bg-amber-950/30',
  file_write: 'border-orange-400 bg-orange-50 dark:bg-orange-950/30',
  email_send: 'border-pink-400 bg-pink-50 dark:bg-pink-950/30',
  json_transform: 'border-cyan-400 bg-cyan-50 dark:bg-cyan-950/30'
}

function nodeLabel(node: WorkflowNode): string {
  switch (node.type) {
    case 'shell_command':
      return node.data.command || node.id.slice(0, 8)
    case 'python_script':
      return node.data.script.slice(0, 30) || node.id.slice(0, 8)
    case 'agent_call':
      return node.data.prompt.slice(0, 30) || node.id.slice(0, 8)
    case 'file_read':
      return node.data.filePath || node.id.slice(0, 8)
    case 'file_write':
      return node.data.filePath || node.id.slice(0, 8)
    case 'trigger_cron':
      return node.data.schedule || node.id.slice(0, 8)
    case 'trigger_manual':
      return 'Manual'
    case 'email_send':
      return node.data.to || node.id.slice(0, 8)
    case 'json_transform':
      return node.data.expression.slice(0, 30) || node.id.slice(0, 8)
  }
}

const ADD_NODE_TYPES: WorkflowNodeType[] = [
  'trigger_cron',
  'trigger_manual',
  'shell_command',
  'python_script',
  'agent_call',
  'file_read',
  'file_write',
  'email_send',
  'json_transform'
]

function buildDefaultNode(
  id: string,
  type: WorkflowNodeType,
  pos: { x: number; y: number }
): WorkflowNode {
  switch (type) {
    case 'trigger_cron':
      return { id, type, pos, data: { schedule: '0 8 * * *' } }
    case 'trigger_manual':
      return { id, type, pos, data: {} }
    case 'shell_command':
      return { id, type, pos, data: { command: '', workingDirectory: '', timeoutSeconds: 30 } }
    case 'python_script':
      return {
        id,
        type,
        pos,
        data: { script: '', workingDirectory: '', timeoutSeconds: 30, pythonBin: 'python3' }
      }
    case 'agent_call':
      return {
        id,
        type,
        pos,
        data: {
          prompt: '',
          agentId: 'cursor',
          structuredOutputSchema: null,
          workingDirectory: '',
          timeoutSeconds: 120
        }
      }
    case 'file_read':
      return { id, type, pos, data: { filePath: '' } }
    case 'file_write':
      return {
        id,
        type,
        pos,
        data: { filePath: '', content: '', mode: 'overwrite', createParents: true }
      }
    case 'email_send':
      return { id, type, pos, data: { to: '', subject: '', body: '', smtpProfileId: null } }
    case 'json_transform':
      return { id, type, pos, data: { expression: '' } }
  }
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
  const dragRef = useRef<{
    nodeId: string
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)

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
    const onMouseMove = (ev: MouseEvent): void => {
      if (!dragRef.current || !workflow) {
        return
      }
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      const el = document.getElementById(`wf-node-${nodeId}`)
      if (el) {
        el.style.left = `${dragRef.current.origX + dx}px`
        el.style.top = `${dragRef.current.origY + dy}px`
      }
    }
    const onMouseUp = async (ev: MouseEvent): Promise<void> => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
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
        className="relative w-full h-full"
        onClick={() => {
          onNodeSelect(null)
          setShowAddMenu(false)
        }}
      >
        {/* edges */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {workflow.edges.map((edge) => {
            const src = workflow.nodes.find((n) => n.id === edge.sourceNodeId)
            const tgt = workflow.nodes.find((n) => n.id === edge.targetNodeId)
            if (!src || !tgt) {
              return null
            }
            const x1 = src.pos.x + 80
            const y1 = src.pos.y + 24
            const x2 = tgt.pos.x + 80
            const y2 = tgt.pos.y + 24
            return (
              <line
                key={edge.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                className="text-border"
              />
            )
          })}
        </svg>
        {workflow.nodes.map((node) => (
          <div
            id={`wf-node-${node.id}`}
            key={node.id}
            className={cn(
              'absolute select-none cursor-move rounded-lg border-2 px-3 py-2 shadow-sm transition-shadow min-w-[160px]',
              NODE_TYPE_COLORS[node.type],
              selectedNodeId === node.id && 'ring-2 ring-primary ring-offset-1'
            )}
            style={{ left: node.pos.x, top: node.pos.y }}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onClick={(e) => {
              e.stopPropagation()
              onNodeSelect(node.id)
            }}
          >
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
