import { useState, useEffect } from 'react'
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { WorkflowRun, WorkflowNodeRunStatus } from '../../../../shared/workflow-types'

type Props = {
  workflowId: string | null
  nodePositions: Record<string, { x: number; y: number }>
}

function StatusIcon({ status }: { status: WorkflowNodeRunStatus }): React.JSX.Element {
  switch (status) {
    case 'running':
      return <Loader2 className="size-3 animate-spin text-status-warning" />
    case 'completed':
      return <CheckCircle2 className="size-3 text-status-success" />
    case 'failed':
      return <XCircle className="size-3 text-destructive" />
    case 'skipped':
    case 'pending':
      return <Clock className="size-3 text-muted-foreground" />
  }
}

function statusOverlayClass(status: WorkflowNodeRunStatus): string {
  switch (status) {
    case 'running':
      return 'border-yellow-400 bg-yellow-400/10 ring-2 ring-yellow-400/50 animate-pulse'
    case 'completed':
      return 'border-emerald-400 bg-emerald-400/10 ring-2 ring-emerald-400/30'
    case 'failed':
      return 'border-red-400 bg-red-400/10 ring-2 ring-red-400/50'
    case 'pending':
    case 'skipped':
      return 'border-border bg-muted/20'
  }
}

export default function WorkflowRunProgress({
  workflowId,
  nodePositions
}: Props): React.JSX.Element | null {
  const [activeRun, setActiveRun] = useState<WorkflowRun | null>(null)

  useEffect(() => {
    if (!workflowId) {
      setActiveRun(null)
      return
    }
    let dismissTimer: ReturnType<typeof setTimeout> | null = null
    const unsub = window.api.workflows.onRunUpdated(({ workflowId: wid, run }) => {
      if (wid !== workflowId) {
        return
      }
      setActiveRun(run)
      if (run.status !== 'running' && run.status !== 'pending') {
        // Keep visible briefly after completion so user can see final state
        if (dismissTimer) {
          clearTimeout(dismissTimer)
        }
        dismissTimer = setTimeout(() => setActiveRun(null), 3000)
      }
    })
    return () => {
      unsub()
      if (dismissTimer) {
        clearTimeout(dismissTimer)
      }
    }
  }, [workflowId])

  if (!activeRun) {
    return null
  }

  return (
    <>
      {activeRun.nodeRuns.map((nr) => {
        const pos = nodePositions[nr.nodeId]
        if (!pos) {
          return null
        }
        return (
          <div
            key={nr.nodeId}
            className={cn(
              'absolute rounded-lg border-2 pointer-events-none transition-all duration-300',
              statusOverlayClass(nr.status)
            )}
            style={{ left: pos.x - 2, top: pos.y - 2, width: 164, height: 52 }}
          >
            <div className="absolute -top-2 -right-2 bg-background rounded-full p-0.5 shadow-sm">
              <StatusIcon status={nr.status} />
            </div>
          </div>
        )
      })}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 bg-background/90 border border-border rounded-lg px-3 py-1.5 shadow-lg pointer-events-none flex items-center gap-2">
        {activeRun.status === 'running' && (
          <Loader2 className="size-3 animate-spin text-status-warning" />
        )}
        {activeRun.status === 'completed' && (
          <CheckCircle2 className="size-3 text-status-success" />
        )}
        {activeRun.status === 'failed' && <XCircle className="size-3 text-destructive" />}
        <span className="text-[11px] font-medium">
          {activeRun.status === 'running'
            ? `${translate('workflows.run.running', 'Running…')} ${activeRun.nodeRuns.filter((nr) => nr.status === 'completed').length}/${activeRun.nodeRuns.length} ${translate('workflows.run.nodes', 'nodes')}`
            : activeRun.status === 'completed'
              ? translate('workflows.run.completed', 'Run completed')
              : activeRun.status === 'failed'
                ? `${translate('workflows.run.failed', 'Run failed:')} ${activeRun.error ?? ''}`
                : activeRun.status}
        </span>
      </div>
    </>
  )
}
