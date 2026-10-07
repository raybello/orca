import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import type { AgentWorkflow } from '../../../../shared/workflow-types'
import type { TuiAgent } from '../../../../shared/tui-agent'

type Props = {
  workflow: AgentWorkflow
  nodeId: string
  onClose: () => void
  onWorkflowChange: (wf: AgentWorkflow) => void
}

// Agents that support non-interactive (-p / --quiet) execution in workflows
const WORKFLOW_AGENTS: { value: TuiAgent; label: string }[] = [
  { value: 'claude', label: 'Claude (claude -p)' },
  { value: 'cursor', label: 'Cursor (cursor-agent -p)' },
  { value: 'codex', label: 'Codex (codex --quiet)' },
  { value: 'gemini', label: 'Gemini (gemini -p)' },
  { value: 'amp', label: 'Amp (amp -p)' },
  { value: 'opencode', label: 'OpenCode (opencode -p)' }
]

// Common model suggestions per agent; the input remains free-text
const MODEL_SUGGESTIONS: Partial<Record<TuiAgent, string[]>> = {
  claude: ['sonnet', 'opus', 'haiku', 'claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'],
  cursor: ['claude-opus-4-5', 'claude-sonnet-4-5', 'gpt-4o', 'gemini-2.5-pro'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  codex: ['codex-mini', 'o4-mini']
}

export default function WorkflowNodeEditorPanel({
  workflow,
  nodeId,
  onClose,
  onWorkflowChange
}: Props): React.JSX.Element {
  const node = workflow.nodes.find((n) => n.id === nodeId)

  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: node.data is a plain record; exact shape varies by node type but all values are serializable
  const [localData, setLocalData] = useState<Record<string, string>>(
    node
      ? Object.fromEntries(
          // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: same as above
          Object.entries(node.data as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])
        )
      : {}
  )

  if (!node) {
    return <div />
  }

  const isAgentCall = node.type === 'agent_call'
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: localData is built from node.data which has agentId: TuiAgent; string cast is safe here
  const currentAgent = (localData['agentId'] as TuiAgent | undefined) ?? 'claude'
  const modelSuggestions = MODEL_SUGGESTIONS[currentAgent] ?? []

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

  // Fields to render as plain text inputs (excluding agent-specific dropdowns)
  const genericFields = Object.keys(localData).filter((k) =>
    isAgentCall ? k !== 'agentId' && k !== 'model' && k !== 'structuredOutputSchema' : true
  )

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-[13px] font-semibold">{node.type.replace(/_/g, ' ')}</span>
        <Button size="icon" variant="ghost" className="size-6" onClick={onClose}>
          <X className="size-3.5" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-sleek p-3 space-y-3">
        {isAgentCall && (
          <>
            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Agent
              </span>
              <Select
                value={currentAgent}
                onValueChange={(v) => setLocalData((prev) => ({ ...prev, agentId: v }))}
              >
                <SelectTrigger className="h-7">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_AGENTS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Model
              </span>
              <Input
                value={localData['model'] ?? ''}
                onChange={(e) => setLocalData((prev) => ({ ...prev, model: e.target.value }))}
                placeholder="default"
                list={`model-suggestions-${nodeId}`}
                className="h-7"
              />
              {modelSuggestions.length > 0 && (
                <datalist id={`model-suggestions-${nodeId}`}>
                  {modelSuggestions.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              )}
              {modelSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {modelSuggestions.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/70 text-muted-foreground transition-colors"
                      onClick={() => setLocalData((prev) => ({ ...prev, model: m }))}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {genericFields.map((key) => (
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
