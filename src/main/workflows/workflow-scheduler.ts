import { parseSchedule } from '../../shared/automation-schedule-parsing'
import { cronMatches, floorToMinute } from '../../shared/automation-cron-occurrence'
import type { AgentWorkflow } from '../../shared/workflow-types'

export function isWorkflowDue(workflow: AgentWorkflow, now: number): boolean {
  if (!workflow.enabled || !workflow.schedule) {
    return false
  }
  try {
    const parsed = parseSchedule(workflow.schedule)
    if (parsed.kind !== 'cron') {
      return false
    }
    const minute = floorToMinute(now)
    return cronMatches(parsed, minute)
  } catch {
    return false
  }
}

export function findDueWorkflows(workflows: AgentWorkflow[], now: number): AgentWorkflow[] {
  return workflows.filter((w) => isWorkflowDue(w, now))
}
