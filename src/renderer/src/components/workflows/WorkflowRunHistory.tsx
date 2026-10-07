import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type {
  WorkflowRun,
  WorkflowNodeRun,
  WorkflowRunStatus,
  WorkflowNodeRunStatus
} from '../../../../shared/workflow-types'
import WorkflowNodeOutputInspector from './WorkflowNodeOutputInspector'

function runStatusClass(status: WorkflowRunStatus): string {
  switch (status) {
    case 'completed':
      return 'text-emerald-500'
    case 'failed':
      return 'text-red-500'
    case 'running':
      return 'text-yellow-500'
    case 'pending':
    case 'cancelled':
      return 'text-muted-foreground'
  }
}

function nodeStatusClass(status: WorkflowNodeRunStatus): string {
  switch (status) {
    case 'completed':
      return 'text-emerald-500'
    case 'failed':
      return 'text-red-500'
    case 'running':
      return 'text-yellow-500'
    case 'pending':
    case 'skipped':
      return 'text-muted-foreground'
  }
}

type Props = { workflowId: string }

export default function WorkflowRunHistory({ workflowId }: Props): React.JSX.Element {
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null)

  useEffect(() => {
    void window.api.workflows.getRuns(workflowId).then((r) => setRuns(r.toReversed()))
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
    })
    return unsub
  }, [workflowId])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-1.5 border-b border-border shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {translate('workflows.history.title', 'Run History')}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-sleek min-h-0">
        {runs.length === 0 ? (
          <div className="px-3 py-3 text-[12px] text-muted-foreground">
            {translate('workflows.history.empty', 'No runs yet.')}
          </div>
        ) : (
          runs.map((run) => (
            <div key={run.id} className="border-b border-border/50">
              <button
                type="button"
                onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40 text-left"
              >
                <span className={cn('text-[11px] font-medium', runStatusClass(run.status))}>
                  {run.status}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(run.startedAt).toLocaleString()}
                </span>
                <span className="text-[11px] text-muted-foreground ml-auto">{run.trigger}</span>
              </button>
              {expandedRunId === run.id && (
                <div className="px-3 pb-2 space-y-1">
                  {run.nodeRuns.map((nr: WorkflowNodeRun) => (
                    <div key={nr.nodeId} className="text-[12px]">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedNodeId(expandedNodeId === nr.nodeId ? null : nr.nodeId)
                        }
                        className="flex items-center gap-2 w-full text-left hover:bg-muted/30 px-1 rounded"
                      >
                        <span className={cn('font-medium', nodeStatusClass(nr.status))}>
                          {nr.status}
                        </span>
                        <span className="text-muted-foreground">{nr.nodeId}</span>
                        {nr.durationMs != null && (
                          <span className="text-muted-foreground ml-auto">{nr.durationMs}ms</span>
                        )}
                      </button>
                      {expandedNodeId === nr.nodeId && nr.outputValue !== null && (
                        <div className="ml-4 mt-1">
                          <WorkflowNodeOutputInspector nodeId={nr.nodeId} output={nr.outputValue} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
