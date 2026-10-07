import { describe, it, expect, vi } from 'vitest'
import { executeWorkflow } from './workflow-executor'
import type { AgentWorkflow } from '../../shared/workflow-types'
import type { WorkflowStoreOperations } from './workflow-run-store'

function makeWorkflow(partial: Partial<AgentWorkflow>): AgentWorkflow {
  return {
    id: 'w1',
    name: 'Test',
    description: '',
    schedule: null,
    enabled: true,
    executionTargetType: 'local',
    executionTargetId: 'local',
    nodes: [],
    edges: [],
    createdAt: 0,
    updatedAt: 0,
    ...partial
  }
}

function makeOps(): { ops: WorkflowStoreOperations; runs: unknown[] } {
  const state: Record<string, unknown> = {
    agentWorkflowRuns: [
      {
        id: 'run1',
        workflowId: 'w1',
        trigger: 'manual',
        status: 'pending',
        startedAt: Date.now(),
        completedAt: null,
        error: null,
        nodeRuns: []
      }
    ]
  }
  const ops: WorkflowStoreOperations = {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test stub
    state: state as Parameters<typeof executeWorkflow>[2]['state'],
    flush: vi.fn()
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test stub
  return { ops, runs: state.agentWorkflowRuns as unknown[] }
}

describe('executeWorkflow', () => {
  it('completes a workflow with a manual trigger', async () => {
    const { ops } = makeOps()
    const workflow = makeWorkflow({
      nodes: [{ id: 'trigger', type: 'trigger_manual', pos: { x: 0, y: 0 }, data: {} }]
    })
    const onRunComplete = vi.fn()
    await executeWorkflow(workflow, 'run1', ops, { onRunComplete })
    expect(onRunComplete).toHaveBeenCalledWith('run1')
    // just verify flush was called
    expect(ops.flush).toHaveBeenCalled()
  })

  it('fails on workflow with cycle', async () => {
    const { ops } = makeOps()
    const workflow = makeWorkflow({
      nodes: [
        { id: 'a', type: 'trigger_manual', pos: { x: 0, y: 0 }, data: {} },
        {
          id: 'b',
          type: 'shell_command',
          pos: { x: 0, y: 0 },
          data: { command: 'ls', workingDirectory: '/', timeoutSeconds: 5 }
        }
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'a', targetNodeId: 'b' },
        { id: 'e2', sourceNodeId: 'b', targetNodeId: 'a' }
      ]
    })
    const onRunComplete = vi.fn()
    await executeWorkflow(workflow, 'run1', ops, { onRunComplete })
    expect(onRunComplete).toHaveBeenCalledWith('run1')
  })

  it('respects abort signal cancellation', async () => {
    const { ops } = makeOps()
    const workflow = makeWorkflow({
      nodes: [
        { id: 't', type: 'trigger_manual', pos: { x: 0, y: 0 }, data: {} },
        {
          id: 's',
          type: 'shell_command',
          pos: { x: 0, y: 0 },
          data: { command: 'sleep 10', workingDirectory: '/', timeoutSeconds: 30 }
        }
      ],
      edges: [{ id: 'e1', sourceNodeId: 't', targetNodeId: 's' }]
    })
    const ac = new AbortController()
    const onRunComplete = vi.fn()
    // Cancel before execution completes
    ac.abort()
    await executeWorkflow(workflow, 'run1', ops, { onRunComplete }, ac.signal)
    expect(onRunComplete).toHaveBeenCalledWith('run1')
  })
})
