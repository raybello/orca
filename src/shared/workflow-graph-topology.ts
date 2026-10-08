import type { AgentWorkflow, WorkflowNode } from './workflow-types'

export function topologicalSort(workflow: AgentWorkflow): WorkflowNode[] | null {
  const nodeById = new Map(workflow.nodes.map((n) => [n.id, n]))
  const inDegree = new Map<string, number>(workflow.nodes.map((n) => [n.id, 0]))
  const adj = new Map<string, string[]>(workflow.nodes.map((n) => [n.id, []]))

  for (const edge of workflow.edges) {
    if (!nodeById.has(edge.sourceNodeId) || !nodeById.has(edge.targetNodeId)) {
      return null
    }
    adj.get(edge.sourceNodeId)!.push(edge.targetNodeId)
    inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1)
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id)
    }
  }
  const sorted: WorkflowNode[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    const node = nodeById.get(id)
    if (!node) {
      return null
    }
    sorted.push(node)
    for (const next of adj.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1
      inDegree.set(next, deg)
      if (deg === 0) {
        queue.push(next)
      }
    }
  }
  return sorted.length === workflow.nodes.length ? sorted : null
}

export function findTriggerNodes(workflow: AgentWorkflow): WorkflowNode[] {
  const hasIncoming = new Set(workflow.edges.map((e) => e.targetNodeId))
  return workflow.nodes.filter(
    (n) => (n.type === 'trigger_cron' || n.type === 'trigger_manual') && !hasIncoming.has(n.id)
  )
}
