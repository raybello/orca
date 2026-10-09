import { useState, useEffect } from 'react'
import { Loader2, Monitor, Server, CheckCircle2, Circle, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { SshTarget } from '../../../../shared/ssh-types'
import type { AgentWorkflow } from '../../../../shared/workflow-types'

type ExecutionTarget = 'local' | 'ssh'

type Props = {
  open: boolean
  onClose: () => void
  onCreate: (wf: AgentWorkflow) => void
}

export default function WorkflowCreateDialog({
  open,
  onClose,
  onCreate
}: Props): React.JSX.Element {
  const [name, setName] = useState(translate('workflows.create.defaultName', 'New Workflow'))
  const [target, setTarget] = useState<ExecutionTarget>('local')
  const [sshTargets, setSshTargets] = useState<SshTarget[]>([])
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const sshConnectionStates = useAppStore((s) => s.sshConnectionStates)

  useEffect(() => {
    if (!open) {
      return
    }
    void window.api.ssh.listTargets().then((targets) => {
      setSshTargets(targets)
      if (targets.length > 0 && selectedTargetId === null) {
        setSelectedTargetId(targets[0].id)
      }
    })
  }, [open, selectedTargetId])

  // Resets happen via key prop in parent (WorkflowList) — no state-on-prop-change effect needed

  function connectionStatus(targetId: string): 'connected' | 'connecting' | 'disconnected' {
    const state = sshConnectionStates.get(targetId)
    if (!state) {
      return 'disconnected'
    }
    if (state.status === 'connected') {
      return 'connected'
    }
    if (state.status === 'connecting' || state.status === 'reconnecting') {
      return 'connecting'
    }
    return 'disconnected'
  }

  async function handleConnect(targetId: string): Promise<void> {
    setConnectingId(targetId)
    try {
      await window.api.ssh.connect({ targetId })
    } finally {
      setConnectingId(null)
    }
  }

  async function handleCreate(): Promise<void> {
    const trimmed = name.trim()
    if (!trimmed) {
      return
    }
    if (target === 'ssh' && !selectedTargetId) {
      return
    }
    setCreating(true)
    try {
      const wf = await window.api.workflows.create({
        name: trimmed,
        description: '',
        schedule: null,
        enabled: false,
        executionTargetType: target,
        executionTargetId: target === 'ssh' ? (selectedTargetId ?? 'local') : 'local',
        nodes: [],
        edges: []
      })
      onCreate(wf)
    } finally {
      setCreating(false)
    }
  }

  const canCreate =
    name.trim().length > 0 &&
    (target === 'local' || (target === 'ssh' && selectedTargetId !== null))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{translate('workflows.create.title', 'Create Workflow')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">
              {translate('workflows.create.nameLabel', 'Name')}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canCreate) {
                  void handleCreate()
                }
              }}
              autoFocus
              className="h-8"
              placeholder={translate('workflows.create.namePlaceholder', 'Workflow name')}
            />
          </div>

          {/* Execution target */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">
              {translate('workflows.create.runOnLabel', 'Run on')}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTarget('local')}
                className={cn(
                  'flex-1 flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] transition-colors',
                  target === 'local'
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                )}
              >
                <Monitor className="size-3.5 shrink-0" />
                {translate('workflows.create.localTarget', 'This machine')}
              </button>
              <button
                type="button"
                onClick={() => setTarget('ssh')}
                className={cn(
                  'flex-1 flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] transition-colors',
                  target === 'ssh'
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                )}
              >
                <Server className="size-3.5 shrink-0" />
                {translate('workflows.create.sshTarget', 'SSH Remote')}
              </button>
            </div>
          </div>

          {/* SSH target picker */}
          {target === 'ssh' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">
                {translate('workflows.create.sshConnectionLabel', 'SSH Connection')}
              </label>
              {sshTargets.length === 0 ? (
                <p className="text-[11px] text-muted-foreground px-1">
                  {translate(
                    'workflows.create.noSshConnections',
                    'No SSH connections saved. Add one in Settings → SSH.'
                  )}
                </p>
              ) : (
                <div className="flex flex-col rounded-md border border-border overflow-hidden">
                  {sshTargets.map((t) => {
                    const status = connectionStatus(t.id)
                    const isSelected = selectedTargetId === t.id
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTargetId(t.id)}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2.5 cursor-pointer text-[12px] border-b border-border/50 last:border-b-0 transition-colors',
                          isSelected
                            ? 'bg-primary/5 text-foreground'
                            : 'hover:bg-muted/50 text-muted-foreground'
                        )}
                      >
                        {/* Selection indicator */}
                        {isSelected ? (
                          <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                        ) : (
                          <Circle className="size-3.5 shrink-0 opacity-40" />
                        )}

                        {/* Target info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{t.label}</div>
                          <div className="text-[10px] opacity-60 truncate">
                            {t.host}:{t.port}
                          </div>
                        </div>

                        {/* Connection status */}
                        {status === 'connected' ? (
                          <span className="text-[10px] text-status-success shrink-0">
                            {translate('workflows.create.sshConnected', 'connected')}
                          </span>
                        ) : status === 'connecting' ? (
                          <Loader2 className="size-3 animate-spin text-muted-foreground shrink-0" />
                        ) : (
                          <button
                            type="button"
                            className="shrink-0 text-[10px] text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleConnect(t.id)
                            }}
                            disabled={connectingId === t.id}
                          >
                            {connectingId === t.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              translate('workflows.create.sshConnect', 'Connect')
                            )}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground px-0.5">
                {translate(
                  'workflows.create.sshHint',
                  'Shell, Python, and agent nodes will run on the remote machine. The agent CLI must be installed there.'
                )}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={creating}>
            {translate('workflows.create.cancel', 'Cancel')}
          </Button>
          <Button size="sm" onClick={() => void handleCreate()} disabled={!canCreate || creating}>
            {creating ? (
              <Loader2 className="size-3 animate-spin mr-1" />
            ) : (
              <Plus className="size-3 mr-1" />
            )}
            {translate('workflows.create.create', 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
