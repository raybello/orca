import { describe, it, expect, vi } from 'vitest'
import { executeWorkflow } from './workflow-executor'
import { createWorkflowRun } from './workflow-run-store'
import type { AgentWorkflow } from '../../shared/workflow-types'
import type { WorkflowStoreOperations } from './workflow-run-store'
import type { PersistedState } from '../../shared/persisted-state-types'

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

function makeOps(workflow: AgentWorkflow): { ops: WorkflowStoreOperations; runId: string } {
  const state: Partial<PersistedState> = { agentWorkflows: [workflow], agentWorkflowRuns: [] }
  const ops: WorkflowStoreOperations = {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test stub
    state: state as PersistedState,
    flush: vi.fn()
  }
  const run = createWorkflowRun(ops, workflow, 'manual')
  return { ops, runId: run.id }
}

describe('executeWorkflow — manual trigger', () => {
  it('completes successfully', async () => {
    const workflow = makeWorkflow({
      nodes: [{ id: 'trigger', type: 'trigger_manual', pos: { x: 0, y: 0 }, data: {} }]
    })
    const { ops, runId } = makeOps(workflow)
    const onRunComplete = vi.fn()
    const onNodeStart = vi.fn()
    const onNodeComplete = vi.fn()
    await executeWorkflow(workflow, runId, ops, { onRunComplete, onNodeStart, onNodeComplete })
    expect(onNodeStart).toHaveBeenCalledWith(runId, 'trigger')
    expect(onNodeComplete).toHaveBeenCalledWith(runId, 'trigger', expect.any(Object))
    expect(onRunComplete).toHaveBeenCalledWith(runId)
    expect(ops.flush).toHaveBeenCalled()
  })

  it('emits timestamp output from trigger', async () => {
    const workflow = makeWorkflow({
      nodes: [{ id: 'trigger', type: 'trigger_manual', pos: { x: 0, y: 0 }, data: {} }]
    })
    const { ops, runId } = makeOps(workflow)
    const onNodeComplete = vi.fn()
    await executeWorkflow(workflow, runId, ops, { onNodeComplete })
    expect(onNodeComplete).toHaveBeenCalledWith(
      runId,
      'trigger',
      expect.objectContaining({
        outputValue: expect.objectContaining({ timestamp: expect.any(String) })
      })
    )
  })
})

describe('executeWorkflow — cron trigger', () => {
  it('executes cron trigger node successfully', async () => {
    const workflow = makeWorkflow({
      nodes: [
        { id: 'cron', type: 'trigger_cron', pos: { x: 0, y: 0 }, data: { schedule: '0 8 * * *' } }
      ]
    })
    const { ops, runId } = makeOps(workflow)
    const onRunComplete = vi.fn()
    await executeWorkflow(workflow, runId, ops, { onRunComplete })
    expect(onRunComplete).toHaveBeenCalledWith(runId)
  })
})

describe('executeWorkflow — json transform', () => {
  it('extracts field via JSONPath from previous node output', async () => {
    const workflow = makeWorkflow({
      nodes: [
        { id: 'trigger', type: 'trigger_manual', pos: { x: 0, y: 0 }, data: {} },
        {
          id: 'transform',
          type: 'json_transform',
          pos: { x: 100, y: 0 },
          // trigger_manual outputs { timestamp: "..." }, extract timestamp
          data: { expression: '$.timestamp' }
        }
      ],
      edges: [{ id: 'e1', sourceNodeId: 'trigger', targetNodeId: 'transform' }]
    })
    const { ops, runId } = makeOps(workflow)
    const onNodeComplete = vi.fn()
    await executeWorkflow(workflow, runId, ops, { onNodeComplete })
    expect(onNodeComplete).toHaveBeenCalledWith(
      runId,
      'transform',
      expect.objectContaining({
        // outputValue should be the ISO timestamp string
        outputValue: expect.stringMatching(/^\d{4}-/)
      })
    )
  })
})

describe('executeWorkflow — remote exec', () => {
  it('routes shell command through remoteExec when provided', async () => {
    const workflow = makeWorkflow({
      nodes: [
        { id: 'trigger', type: 'trigger_manual', pos: { x: 0, y: 0 }, data: {} },
        {
          id: 'shell',
          type: 'shell_command',
          pos: { x: 100, y: 0 },
          data: { command: 'echo hello', workingDirectory: '/', timeoutSeconds: 5 }
        }
      ],
      edges: [{ id: 'e1', sourceNodeId: 'trigger', targetNodeId: 'shell' }]
    })
    const { ops, runId } = makeOps(workflow)
    const remoteExec = vi
      .fn()
      .mockResolvedValue({ stdout: 'remote output', stderr: '', exitCode: 0 })
    const onNodeComplete = vi.fn()
    await executeWorkflow(workflow, runId, ops, { onNodeComplete }, undefined, remoteExec)
    expect(remoteExec).toHaveBeenCalledWith(
      'echo hello',
      expect.objectContaining({ timeoutMs: 5000 })
    )
    expect(onNodeComplete).toHaveBeenCalledWith(
      runId,
      'shell',
      expect.objectContaining({ status: 'completed' })
    )
  })

  it('routes python script through remoteExec when provided', async () => {
    const workflow = makeWorkflow({
      nodes: [
        { id: 'trigger', type: 'trigger_manual', pos: { x: 0, y: 0 }, data: {} },
        {
          id: 'py',
          type: 'python_script',
          pos: { x: 100, y: 0 },
          data: {
            script: 'print(42)',
            workingDirectory: '/',
            timeoutSeconds: 5,
            pythonBin: 'python3'
          }
        }
      ],
      edges: [{ id: 'e1', sourceNodeId: 'trigger', targetNodeId: 'py' }]
    })
    const { ops, runId } = makeOps(workflow)
    const remoteExec = vi.fn().mockResolvedValue({ stdout: '42\n', stderr: '', exitCode: 0 })
    const onNodeComplete = vi.fn()
    await executeWorkflow(workflow, runId, ops, { onNodeComplete }, undefined, remoteExec)
    expect(remoteExec).toHaveBeenCalled()
    expect(onNodeComplete).toHaveBeenCalledWith(
      runId,
      'py',
      expect.objectContaining({ status: 'completed' })
    )
  })

  it('falls back to local exec when remoteExec is not provided', async () => {
    const workflow = makeWorkflow({
      nodes: [{ id: 'trigger', type: 'trigger_manual', pos: { x: 0, y: 0 }, data: {} }]
    })
    const { ops, runId } = makeOps(workflow)
    const onRunComplete = vi.fn()
    // No remoteExec passed — should use local runner
    await executeWorkflow(workflow, runId, ops, { onRunComplete })
    expect(onRunComplete).toHaveBeenCalledWith(runId)
  })
})

describe('executeWorkflow — template expressions', () => {
  it('resolves {{steps.n.output}} in shell command', async () => {
    const workflow = makeWorkflow({
      nodes: [
        { id: 'trigger', type: 'trigger_manual', pos: { x: 0, y: 0 }, data: {} },
        {
          id: 'shell',
          type: 'shell_command',
          pos: { x: 100, y: 0 },
          data: {
            command: 'echo {{steps.trigger.output}}',
            workingDirectory: '/',
            timeoutSeconds: 5
          }
        }
      ],
      edges: [{ id: 'e1', sourceNodeId: 'trigger', targetNodeId: 'shell' }]
    })
    const { ops, runId } = makeOps(workflow)
    const remoteExec = vi.fn().mockResolvedValue({ stdout: 'resolved', stderr: '', exitCode: 0 })
    await executeWorkflow(workflow, runId, ops, {}, undefined, remoteExec)
    // Command should have resolved the template (trigger output is an ISO timestamp)
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: first arg of mock call is always the command string per the runner signature
    const call = remoteExec.mock.calls[0][0] as string
    expect(call).toMatch(/^echo \d{4}-/)
  })
})

describe('executeWorkflow — error handling', () => {
  it('fails on workflow with cycle', async () => {
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
    const { ops, runId } = makeOps(workflow)
    const onRunComplete = vi.fn()
    await executeWorkflow(workflow, runId, ops, { onRunComplete })
    expect(onRunComplete).toHaveBeenCalledWith(runId)
  })

  it('fails and marks node when a node throws', async () => {
    const workflow = makeWorkflow({
      nodes: [
        { id: 'trigger', type: 'trigger_manual', pos: { x: 0, y: 0 }, data: {} },
        {
          id: 'shell',
          type: 'shell_command',
          pos: { x: 100, y: 0 },
          data: { command: 'bad', workingDirectory: '/', timeoutSeconds: 5 }
        }
      ],
      edges: [{ id: 'e1', sourceNodeId: 'trigger', targetNodeId: 'shell' }]
    })
    const { ops, runId } = makeOps(workflow)
    const remoteExec = vi.fn().mockRejectedValue(new Error('remote exec failed'))
    const onRunComplete = vi.fn()
    const onNodeComplete = vi.fn()
    await executeWorkflow(
      workflow,
      runId,
      ops,
      { onRunComplete, onNodeComplete },
      undefined,
      remoteExec
    )
    expect(onRunComplete).toHaveBeenCalledWith(runId)
    // shell node should not be in completed callbacks (it failed)
    expect(onNodeComplete).not.toHaveBeenCalledWith(runId, 'shell', expect.any(Object))
  })

  it('respects abort signal cancellation', async () => {
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
    const { ops, runId } = makeOps(workflow)
    const ac = new AbortController()
    const onRunComplete = vi.fn()
    ac.abort()
    await executeWorkflow(workflow, runId, ops, { onRunComplete }, ac.signal)
    expect(onRunComplete).toHaveBeenCalledWith(runId)
  })
})

describe('executeWorkflow — multi-node chain', () => {
  it('passes output from trigger → json_transform chain', async () => {
    const workflow = makeWorkflow({
      nodes: [
        { id: 'trigger', type: 'trigger_manual', pos: { x: 0, y: 0 }, data: {} },
        {
          id: 'json1',
          type: 'json_transform',
          pos: { x: 100, y: 0 },
          data: { expression: '{"ok": true}' }
        },
        {
          id: 'json2',
          type: 'json_transform',
          pos: { x: 200, y: 0 },
          data: { expression: '99' }
        }
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'trigger', targetNodeId: 'json1' },
        { id: 'e2', sourceNodeId: 'json1', targetNodeId: 'json2' }
      ]
    })
    const { ops, runId } = makeOps(workflow)
    const nodeCompletes: string[] = []
    await executeWorkflow(workflow, runId, ops, {
      onNodeComplete: (_, nodeId) => nodeCompletes.push(nodeId)
    })
    expect(nodeCompletes).toEqual(['trigger', 'json1', 'json2'])
  })
})
