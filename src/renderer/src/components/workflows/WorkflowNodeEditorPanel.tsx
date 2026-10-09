import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { X, Loader2 } from 'lucide-react'
import Editor from '@monaco-editor/react'
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
import { useDocumentDarkTheme } from '@/hooks/use-document-dark-theme'
import WorkflowCronScheduleField from './WorkflowCronScheduleField'
import type { AgentWorkflow } from '../../../../shared/workflow-types'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { WorkflowModel } from '../../../../preload/api/workflow-bridge'

type Props = {
  workflow: AgentWorkflow
  nodeId: string
  onClose: () => void
  onWorkflowChange: (wf: AgentWorkflow) => void
}

// Agents that support non-interactive (-p / --quiet) execution in workflows
function getWorkflowAgents(): { value: TuiAgent; label: string }[] {
  return [
    { value: 'claude', label: translate('workflows.nodeEditor.agentClaude', 'Claude (claude -p)') },
    {
      value: 'cursor',
      label: translate('workflows.nodeEditor.agentCursor', 'Cursor (cursor-agent -p)')
    },
    {
      value: 'codex',
      label: translate('workflows.nodeEditor.agentCodex', 'Codex (codex --quiet)')
    },
    { value: 'gemini', label: translate('workflows.nodeEditor.agentGemini', 'Gemini (gemini -p)') },
    { value: 'amp', label: translate('workflows.nodeEditor.agentAmp', 'Amp (amp -p)') },
    {
      value: 'opencode',
      label: translate('workflows.nodeEditor.agentOpenCode', 'OpenCode (opencode -p)')
    }
  ]
}

type ModelFetch =
  | { state: 'loading' }
  | { state: 'done'; models: WorkflowModel[] }
  | { state: 'error' }

// Fields that get a Monaco editor instead of a plain text input
function getMonacoFields(): Record<string, { language: string; label: string }> {
  return {
    script: { language: 'python', label: translate('workflows.nodeEditor.fieldScript', 'Script') },
    command: {
      language: 'shell',
      label: translate('workflows.nodeEditor.fieldCommand', 'Command')
    },
    expression: {
      language: 'javascript',
      label: translate('workflows.nodeEditor.fieldExpression', 'Expression')
    }
  }
}

function getAvailableShells(): string[] {
  if (navigator.userAgent.includes('Win')) {
    return ['powershell', 'cmd']
  }
  if (navigator.userAgent.includes('Mac')) {
    return ['zsh', 'bash', 'sh']
  }
  return ['bash', 'sh', 'zsh', 'tcsh']
}

export default function WorkflowNodeEditorPanel({
  workflow,
  nodeId,
  onClose,
  onWorkflowChange
}: Props): React.JSX.Element {
  const node = workflow.nodes.find((n) => n.id === nodeId)
  const isDark = useDocumentDarkTheme()

  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: node.data is a plain record; exact shape varies by node type but all values are serializable
  const [localData, setLocalData] = useState<Record<string, string>>(
    node
      ? Object.fromEntries(
          // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: same as above
          Object.entries(node.data as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])
        )
      : {}
  )

  // Per-agent model cache — persists across agent switches in the same panel mount
  const modelCache = useRef<Map<TuiAgent, ModelFetch>>(new Map())
  const [modelFetch, setModelFetch] = useState<ModelFetch>({ state: 'loading' })

  const isAgentCall = node?.type === 'agent_call'
  const isShellCommand = node?.type === 'shell_command'
  const isFileWrite = node?.type === 'file_write'
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: localData is built from node.data which has agentId: TuiAgent; string cast is safe here
  const currentAgent = (localData['agentId'] as TuiAgent | undefined) ?? 'claude'

  useEffect(() => {
    if (!isAgentCall) {
      return
    }
    const cached = modelCache.current.get(currentAgent)
    if (cached) {
      setModelFetch(cached)
      return
    }
    const loading: ModelFetch = { state: 'loading' }
    modelCache.current.set(currentAgent, loading)
    setModelFetch(loading)
    void window.api.workflows
      .listModels(currentAgent)
      .then((models) => {
        const done: ModelFetch = { state: 'done', models }
        modelCache.current.set(currentAgent, done)
        setModelFetch((prev) => (prev === loading ? done : prev))
      })
      .catch(() => {
        const err: ModelFetch = { state: 'error' }
        modelCache.current.set(currentAgent, err)
        setModelFetch((prev) => (prev === loading ? err : prev))
      })
  }, [isAgentCall, currentAgent])

  const handleSave = useCallback(async (): Promise<void> => {
    if (!node) {
      return
    }
    const updatedNodes = workflow.nodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...localData } } : n
    )
    // Sync cron trigger node schedule to workflow.schedule
    const cronNode = updatedNodes.find((n) => n.type === 'trigger_cron')
    const schedulePatch =
      node.type === 'trigger_cron' && localData['schedule'] !== undefined
        ? { schedule: localData['schedule'] || null }
        : {}
    const updated = await window.api.workflows.update(workflow.id, {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: updatedNodes preserves the discriminated union structure; data field values may widen to unknown but nodes array is type-compatible
      nodes: updatedNodes as AgentWorkflow['nodes'],
      ...schedulePatch
    })
    if (updated) {
      onWorkflowChange(updated)
      toast.success(translate('workflows.node.saved', 'Node saved'))
    }
    void cronNode
  }, [node, nodeId, localData, workflow, onWorkflowChange])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 's') {
        return
      }
      e.preventDefault()
      void handleSave()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSave])

  if (!node) {
    return <div />
  }

  const isCronTrigger = node.type === 'trigger_cron'

  // Fields to render as plain text inputs (excluding agent-specific dropdowns, cron schedule, and shell selector)
  const genericFields = Object.keys(localData).filter((k) => {
    if (isAgentCall && (k === 'agentId' || k === 'model' || k === 'structuredOutputSchema')) {
      return false
    }
    if (isCronTrigger && k === 'schedule') {
      return false
    }
    if (isShellCommand && k === 'shell') {
      return false
    }
    if (isFileWrite && k === 'mode') {
      return false
    }
    if (isFileWrite && k === 'createParents') {
      return false
    }
    return true
  })

  const availableModels = modelFetch.state === 'done' ? modelFetch.models : []
  const selectedModel = localData['model'] ?? ''

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
                {translate('workflows.nodeEditor.agent', 'Agent')}
              </span>
              <Select
                value={currentAgent}
                onValueChange={(v) => {
                  setLocalData((prev) => ({ ...prev, agentId: v, model: '' }))
                }}
              >
                <SelectTrigger className="h-7">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getWorkflowAgents().map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {translate('workflows.nodeEditor.model', 'Model')}
              </span>
              {modelFetch.state === 'loading' && (
                <div className="flex items-center gap-1.5 h-7 text-[12px] text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  <span>{translate('workflows.nodeEditor.loadingModels', 'Loading models…')}</span>
                </div>
              )}
              {modelFetch.state === 'error' && (
                <div className="h-7 flex items-center text-[12px] text-muted-foreground">
                  {translate(
                    'workflows.nodeEditor.modelsError',
                    'Could not fetch models — enter manually'
                  )}
                </div>
              )}
              {modelFetch.state === 'done' && availableModels.length === 0 && (
                <div className="h-7 flex items-center text-[12px] text-muted-foreground">
                  {translate('workflows.nodeEditor.noModels', 'No models found for this agent')}
                </div>
              )}
              {modelFetch.state === 'done' && availableModels.length > 0 && (
                <Select
                  value={selectedModel || '__default__'}
                  onValueChange={(v) =>
                    setLocalData((prev) => ({ ...prev, model: v === '__default__' ? '' : v }))
                  }
                >
                  <SelectTrigger className="h-7">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">
                      {translate('workflows.nodeEditor.modelDefault', 'Default')}
                    </SelectItem>
                    {availableModels.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </>
        )}
        {isCronTrigger && (
          <WorkflowCronScheduleField
            value={localData['schedule'] ?? ''}
            onChange={(v) => setLocalData((prev) => ({ ...prev, schedule: v }))}
          />
        )}
        {isShellCommand && (
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {translate('workflows.nodeEditor.shell', 'Shell')}
            </span>
            <Select
              value={localData['shell'] ?? ''}
              onValueChange={(v) => setLocalData((prev) => ({ ...prev, shell: v }))}
            >
              <SelectTrigger className="h-7">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getAvailableShells().map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {isFileWrite && (
          <>
            <div className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {translate('workflows.nodeEditor.fileWriteMode', 'Mode')}
              </span>
              <Select
                value={localData['mode'] ?? 'overwrite'}
                onValueChange={(v) => setLocalData((prev) => ({ ...prev, mode: v }))}
              >
                <SelectTrigger className="h-7">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overwrite">
                    {translate('workflows.nodeEditor.fileWriteModeOverwrite', 'Overwrite')}
                  </SelectItem>
                  <SelectItem value="append">
                    {translate('workflows.nodeEditor.fileWriteModeAppend', 'Append')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-[12px] cursor-pointer">
              <input
                type="checkbox"
                checked={localData['createParents'] !== 'false'}
                onChange={(e) =>
                  setLocalData((prev) => ({ ...prev, createParents: String(e.target.checked) }))
                }
              />
              {translate('workflows.nodeEditor.createParents', 'Create parent directories')}
            </label>
          </>
        )}
        {genericFields.map((key) => {
          const monacoConfig = getMonacoFields()[key]
          if (monacoConfig) {
            return (
              <div key={key} className="space-y-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {monacoConfig.label}
                </span>
                <div
                  className="rounded border border-border overflow-hidden"
                  style={{ height: 180 }}
                >
                  <Editor
                    value={localData[key]}
                    language={monacoConfig.language}
                    theme={isDark ? 'vs-dark' : 'light'}
                    options={{
                      minimap: { enabled: false },
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      fontSize: 12,
                      tabSize: 2,
                      automaticLayout: true,
                      padding: { top: 6, bottom: 6 }
                    }}
                    onChange={(v) => setLocalData((prev) => ({ ...prev, [key]: v ?? '' }))}
                  />
                </div>
              </div>
            )
          }
          return (
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
          )
        })}
      </div>
      <div className="px-3 py-2 border-t border-border shrink-0">
        <Button size="sm" className="w-full h-7" onClick={() => void handleSave()}>
          {translate('workflows.node.save', 'Save')}
        </Button>
      </div>
    </div>
  )
}
