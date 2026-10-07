import { Workflow } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'

export default function AgentWorkflowsSidebarEntry(): React.JSX.Element {
  const openWorkflowsPage = useAppStore((s) => s.openWorkflowsPage)
  const workflowsActive = useAppStore((s) => s.activeView === 'workflows')
  return (
    <button
      type="button"
      onClick={openWorkflowsPage}
      aria-current={workflowsActive ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
        workflowsActive
          ? 'bg-worktree-sidebar-foreground/10 text-worktree-sidebar-foreground'
          : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
      )}
    >
      <Workflow
        className={cn(
          'size-4 shrink-0',
          workflowsActive
            ? 'text-worktree-sidebar-foreground'
            : 'text-worktree-sidebar-foreground/30'
        )}
        strokeWidth={workflowsActive ? 2.25 : 1.75}
      />
      <span className="flex-1">{translate('workflows.sidebar.label', 'Agent Workflows')}</span>
    </button>
  )
}
