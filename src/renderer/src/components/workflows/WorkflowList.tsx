import { useState, useEffect } from 'react'
import { Plus, Trash2, Play, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { AgentWorkflow } from '../../../../shared/workflow-types'

type Props = {
  selectedWorkflowId: string | null
  onSelect: (wf: AgentWorkflow | null) => void
}

export default function WorkflowList({ selectedWorkflowId, onSelect }: Props): React.JSX.Element {
  const [workflows, setWorkflows] = useState<AgentWorkflow[]>([])
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    void window.api.workflows.list().then(setWorkflows)
    const unsub = window.api.workflows.onChanged(({ workflows: wfs }) => setWorkflows(wfs))
    return unsub
  }, [])

  async function handleCreate(): Promise<void> {
    const wf = await window.api.workflows.create({
      name: 'New Workflow',
      description: '',
      schedule: null,
      enabled: true,
      executionTargetType: 'local',
      executionTargetId: 'local',
      nodes: [],
      edges: []
    })
    onSelect(wf)
    // immediately open rename dialog
    setRenamingId(wf.id)
    setRenameValue(wf.name)
  }

  async function handleDelete(id: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    await window.api.workflows.delete(id)
    if (selectedWorkflowId === id) {
      onSelect(null)
    }
  }

  async function handleRunNow(id: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    await window.api.workflows.runNow(id)
  }

  function openRename(wf: AgentWorkflow, e: React.MouseEvent): void {
    e.stopPropagation()
    setRenamingId(wf.id)
    setRenameValue(wf.name)
  }

  async function handleRenameSave(): Promise<void> {
    if (!renamingId || !renameValue.trim()) {
      return
    }
    await window.api.workflows.update(renamingId, { name: renameValue.trim() })
    setRenamingId(null)
  }

  return (
    <>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {translate('workflows.list.title', 'Workflows')}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            onClick={() => void handleCreate()}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-sleek min-h-0">
          {workflows.length === 0 ? (
            <div className="px-3 py-4 text-[13px] text-muted-foreground">
              {translate('workflows.list.empty', 'No workflows yet. Click + to create one.')}
            </div>
          ) : (
            workflows.map((wf) => (
              <div
                key={wf.id}
                onClick={() => onSelect(wf)}
                className={cn(
                  'group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 border-b border-border/50',
                  selectedWorkflowId === wf.id && 'bg-muted'
                )}
              >
                <span className="flex-1 text-[13px] truncate font-medium">{wf.name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-5"
                    onClick={(e) => openRename(wf, e)}
                    title="Rename"
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-5"
                    onClick={(e) => void handleRunNow(wf.id, e)}
                    title="Run now"
                  >
                    <Play className="size-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="size-5"
                    onClick={(e) => void handleDelete(wf.id, e)}
                    title="Delete"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={renamingId !== null} onOpenChange={(open) => !open && setRenamingId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Workflow</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void handleRenameSave()
              }
            }}
            autoFocus
            className="h-8"
            placeholder="Workflow name"
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRenamingId(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void handleRenameSave()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
