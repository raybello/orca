import { Monitor, Server } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { AgentWorkflow } from '../../../../shared/workflow-types'

type Props = {
  workflow: AgentWorkflow
}

export default function WorkflowExecutionTargetBadge({ workflow }: Props): React.JSX.Element {
  const sshTargetLabels = useAppStore((s) => s.sshTargetLabels)
  const sshConnectionStates = useAppStore((s) => s.sshConnectionStates)

  if (workflow.executionTargetType === 'local') {
    return (
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground border border-border/60 rounded px-1.5 py-0.5 bg-background/80 select-none">
        <Monitor className="size-2.5 shrink-0" />
        <span>{translate('workflows.executionTarget.local', 'Local')}</span>
      </div>
    )
  }

  const label = sshTargetLabels.get(workflow.executionTargetId) ?? workflow.executionTargetId
  const state = sshConnectionStates.get(workflow.executionTargetId)
  const connected = state?.status === 'connected'

  return (
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground border border-border/60 rounded px-1.5 py-0.5 bg-background/80 select-none">
      <Server className="size-2.5 shrink-0" />
      <span className="max-w-[120px] truncate">{label}</span>
      <span
        className={
          connected
            ? 'size-1.5 rounded-full bg-status-success shrink-0'
            : 'size-1.5 rounded-full bg-muted-foreground/40 shrink-0'
        }
      />
    </div>
  )
}
