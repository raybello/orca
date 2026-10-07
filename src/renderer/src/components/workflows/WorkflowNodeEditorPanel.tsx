import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import type { AgentWorkflow } from '../../../../shared/workflow-types'

type Props = {
  workflow: AgentWorkflow
  nodeId: string
  onClose: () => void
  onWorkflowChange: (wf: AgentWorkflow) => void
}

export default function WorkflowNodeEditorPanel({
  workflow,
  nodeId,
  onClose,
  onWorkflowChange
}: Props): React.JSX.Element {
  const node = workflow.nodes.find((n) => n.id === nodeId)
  const [localData, setLocalData] = useState<Record<string, string>>(
    node
      ? Object.fromEntries(
          // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: node.data is a plain record; exact shape varies by node type but all values are serializable
          Object.entries(node.data as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])
        )
      : {}
  )

  if (!node) {
    return <div />
  }

  async function handleSave(): Promise<void> {
    const updatedNodes = workflow.nodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...localData } } : n
    )
    const updated = await window.api.workflows.update(workflow.id, {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: updatedNodes preserves the discriminated union structure; data field values may widen to unknown but nodes array is type-compatible
      nodes: updatedNodes as AgentWorkflow['nodes']
    })
    if (updated) {
      onWorkflowChange(updated)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-[13px] font-semibold">{node.type.replace(/_/g, ' ')}</span>
        <Button size="icon" variant="ghost" className="size-6" onClick={onClose}>
          <X className="size-3.5" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-sleek p-3 space-y-3">
        {Object.keys(localData).map((key) => (
          <div key={key} className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {key}
            </span>
            <Input
              value={localData[key]}
              onChange={(e) => setLocalData((prev) => ({ ...prev, [key]: e.target.value }))}
              className="h-7"
            />
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-border shrink-0">
        <Button size="sm" className="w-full h-7" onClick={() => void handleSave()}>
          {translate('workflows.node.save', 'Save')}
        </Button>
      </div>
    </div>
  )
}
