import type { AgentWorkflow } from './workflow-types'
import { topologicalSort } from './workflow-graph-topology'

export type WorkflowValidationError =
  | { kind: 'no_trigger'; message: string }
  | { kind: 'multiple_triggers'; message: string }
  | { kind: 'cycle'; message: string }
  | { kind: 'missing_node'; message: string; nodeId: string }
  | { kind: 'empty_workflow'; message: string }

export function validateWorkflow(workflow: AgentWorkflow): WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = []
  if (workflow.nodes.length === 0) {
    errors.push({ kind: 'empty_workflow', message: 'Workflow has no nodes.' })
    return errors
  }
  const nodeIds = new Set(workflow.nodes.map((n) => n.id))
  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.sourceNodeId)) {
      errors.push({
        kind: 'missing_node',
        message: `Edge references missing node: ${edge.sourceNodeId}`,
        nodeId: edge.sourceNodeId
      })
    }
    if (!nodeIds.has(edge.targetNodeId)) {
      errors.push({
        kind: 'missing_node',
        message: `Edge references missing node: ${edge.targetNodeId}`,
        nodeId: edge.targetNodeId
      })
    }
  }
  const triggers = workflow.nodes.filter(
    (n) => n.type === 'trigger_cron' || n.type === 'trigger_manual'
  )
  if (triggers.length === 0) {
    errors.push({ kind: 'no_trigger', message: 'Workflow must have at least one trigger node.' })
  }
  if (topologicalSort(workflow) === null) {
    errors.push({ kind: 'cycle', message: 'Workflow graph contains a cycle.' })
  }
  return errors
}
