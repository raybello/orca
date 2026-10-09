import { useState, useEffect } from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  Square
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { NODE_TYPE_LABELS } from './workflow-canvas-node-config'
import type {
  WorkflowRun,
  WorkflowNodeRun,
  WorkflowRunStatus,
  WorkflowNodeRunStatus
} from '../../../../shared/workflow-types'
import WorkflowNodeOutputInspector from './WorkflowNodeOutputInspector'

function RunStatusIcon({ status }: { status: WorkflowRunStatus }): React.JSX.Element {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="size-3 text-status-success shrink-0" />
    case 'failed':
      return <XCircle className="size-3 text-destructive shrink-0" />
    case 'running':
      return <Loader2 className="size-3 text-status-warning shrink-0 animate-spin" />
    case 'cancelled':
      return <Square className="size-3 text-muted-foreground shrink-0" />
    case 'pending':
      return <Clock className="size-3 text-muted-foreground shrink-0" />
  }
}

function NodeStatusIcon({ status }: { status: WorkflowNodeRunStatus }): React.JSX.Element {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="size-2.5 text-status-success shrink-0" />
    case 'failed':
      return <XCircle className="size-2.5 text-destructive shrink-0" />
    case 'running':
      return <Loader2 className="size-2.5 text-status-warning shrink-0 animate-spin" />
    case 'skipped':
    case 'pending':
      return <Clock className="size-2.5 text-muted-foreground shrink-0" />
  }
}

function nodeStatusClass(status: WorkflowNodeRunStatus): string {
  switch (status) {
    case 'completed':
      return 'text-status-success'
    case 'failed':
      return 'text-destructive'
    case 'running':
      return 'text-status-warning'
    case 'pending':
    case 'skipped':
      return 'text-muted-foreground'
  }
}

// Truncate full UUIDs in stored error strings (old-format runs used the full id)
function formatRunError(error: string): string {
  return error.replace(
    /\b([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g,
    (_, first8: string) => first8
  )
}

function formatDuration(ms: number | null): string {
  if (ms === null) {
    return ''
  }
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function NodeRunRow({
  nr,
  isAutoExpanded
}: {
  nr: WorkflowNodeRun
  isAutoExpanded: boolean
}): React.JSX.Element {
  // null = user hasn't toggled; derive from prop. Non-null = user explicitly toggled.
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null)
  const expanded = manualExpanded !== null ? manualExpanded : isAutoExpanded

  const hasOutput = nr.outputValue !== null || nr.stdout

  return (
    <div className="text-[11px]">
      <button
        type="button"
        onClick={() => setManualExpanded((v) => !(v ?? isAutoExpanded))}
        className="flex items-center gap-1.5 w-full text-left hover:bg-muted/30 px-1 py-0.5 rounded"
      >
        <NodeStatusIcon status={nr.status} />
        <span className={cn('font-medium', nodeStatusClass(nr.status))}>{nr.status}</span>
        <span className="font-medium text-foreground/80 shrink-0 w-20 truncate">
          {NODE_TYPE_LABELS[nr.nodeType]}
        </span>
        <span className="text-muted-foreground truncate flex-1">{nr.nodeId.slice(0, 8)}</span>
        <span className="text-muted-foreground font-mono">{formatDuration(nr.durationMs)}</span>
        {hasOutput && (
          <span className="text-muted-foreground">
            {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </span>
        )}
      </button>
      {nr.error && (
        <div className="ml-5 mt-0.5 text-[10px] text-destructive font-mono truncate">
          {nr.error}
        </div>
      )}
      {expanded && hasOutput && (
        <div className="ml-4 mt-1 mb-1">
          <WorkflowNodeOutputInspector nodeId={nr.nodeId} output={nr.outputValue ?? nr.stdout} />
        </div>
      )}
    </div>
  )
}

type Props = { workflowId: string }

export default function WorkflowRunHistory({ workflowId }: Props): React.JSX.Element {
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

  useEffect(() => {
    void window.api.workflows.getRuns(workflowId).then((r) => {
      const sorted = r.toReversed()
      setRuns(sorted)
      // Auto-expand the most recent run if it failed or is running
      const latest = sorted[0]
      if (latest && (latest.status === 'failed' || latest.status === 'running')) {
        setExpandedRunId(latest.id)
      }
    })
    const unsub = window.api.workflows.onRunUpdated(({ workflowId: wid, run }) => {
      if (wid !== workflowId) {
        return
      }
      setRuns((prev) => {
        const idx = prev.findIndex((r) => r.id === run.id)
        if (idx === -1) {
          return [run, ...prev]
        }
        return prev.map((r) => (r.id === run.id ? run : r))
      })
      if (run.status === 'running' || run.status === 'failed') {
        setExpandedRunId(run.id)
      }
    })
    return unsub
  }, [workflowId])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto scrollbar-sleek min-h-0">
        {runs.length === 0 ? (
          <div className="px-3 py-3 text-[12px] text-muted-foreground">
            {translate('workflows.history.empty', 'No runs yet.')}
          </div>
        ) : (
          runs.map((run) => {
            const totalMs =
              run.completedAt && run.startedAt ? run.completedAt - run.startedAt : null
            const isExpanded = expandedRunId === run.id
            return (
              <div key={run.id} className="border-b border-border/50">
                <button
                  type="button"
                  onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40 text-left"
                >
                  <RunStatusIcon status={run.status} />
                  <span className="text-[11px] text-muted-foreground">
                    {formatTime(run.startedAt)}
                  </span>
                  <span className="text-[11px] text-muted-foreground capitalize">
                    {run.trigger}
                  </span>
                  {totalMs !== null && (
                    <span className="text-[11px] text-muted-foreground font-mono ml-auto">
                      {formatDuration(totalMs)}
                    </span>
                  )}
                  {run.status === 'running' && (
                    <span className="text-[11px] text-status-warning ml-auto">
                      {run.nodeRuns.filter((nr) => nr.status === 'completed').length}/
                      {run.nodeRuns.length}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {isExpanded ? (
                      <ChevronDown className="size-3" />
                    ) : (
                      <ChevronRight className="size-3" />
                    )}
                  </span>
                </button>
                {run.error && !isExpanded && (
                  <div className="px-3 text-[10px] text-destructive pb-1 truncate">
                    {formatRunError(run.error)}
                  </div>
                )}
                {isExpanded && (
                  <div className="px-3 pb-2 space-y-0.5">
                    {[...run.nodeRuns]
                      .sort((a, b) => (a.startedAt ?? Infinity) - (b.startedAt ?? Infinity))
                      .map((nr: WorkflowNodeRun) => (
                        <NodeRunRow
                          key={nr.nodeId}
                          nr={nr}
                          isAutoExpanded={nr.status === 'failed'}
                        />
                      ))}
                    {run.error && (
                      <div className="text-[10px] text-destructive font-mono mt-1 px-1">
                        {formatRunError(run.error)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
