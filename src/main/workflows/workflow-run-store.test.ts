import { describe, it, expect } from 'vitest'
import {
  createWorkflowRun,
  updateWorkflowRun,
  patchNodeRun,
  finalizeWorkflowRun,
  listWorkflowRuns,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  getWorkflow,
  getActiveRun
} from './workflow-run-store'
import type { WorkflowStoreOperations } from './workflow-run-store'
import type { AgentWorkflow } from '../../shared/workflow-types'
import type { PersistedState } from '../../shared/persisted-state-types'

function makeOps(): WorkflowStoreOperations {
  const state: Partial<PersistedState> = { agentWorkflows: [], agentWorkflowRuns: [] }
  return {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test stub
    state: state as PersistedState,
    flush: () => {}
  }
}

function makeWorkflow(id: string): AgentWorkflow {
  return {
    id,
    name: `Workflow ${id}`,
    description: '',
    schedule: null,
    enabled: true,
    executionTargetType: 'local',
    executionTargetId: 'local',
    nodes: [{ id: 'n1', type: 'trigger_manual', pos: { x: 0, y: 0 }, data: {} }],
    edges: [],
    createdAt: 1000,
    updatedAt: 1000
  }
}

describe('workflow CRUD', () => {
  it('creates a workflow record', () => {
    const ops = makeOps()
    const wf = makeWorkflow('w1')
    createWorkflow(ops, wf)
    expect(ops.state.agentWorkflows).toHaveLength(1)
    expect(ops.state.agentWorkflows[0].id).toBe('w1')
  })

  it('updates a workflow record', () => {
    const ops = makeOps()
    const wf = makeWorkflow('w1')
    createWorkflow(ops, wf)
    const updated = updateWorkflow(ops, 'w1', { name: 'Renamed' })
    expect(updated?.name).toBe('Renamed')
    expect(ops.state.agentWorkflows[0].name).toBe('Renamed')
  })

  it('returns null when updating non-existent workflow', () => {
    const ops = makeOps()
    expect(updateWorkflow(ops, 'missing', { name: 'X' })).toBeNull()
  })

  it('deletes a workflow and its runs', () => {
    const ops = makeOps()
    const wf = makeWorkflow('w1')
    createWorkflow(ops, wf)
    createWorkflowRun(ops, wf, 'manual')
    expect(ops.state.agentWorkflowRuns).toHaveLength(1)
    const result = deleteWorkflow(ops, 'w1')
    expect(result).toBe(true)
    expect(ops.state.agentWorkflows).toHaveLength(0)
    expect(ops.state.agentWorkflowRuns).toHaveLength(0)
  })

  it('gets a workflow by id', () => {
    const ops = makeOps()
    createWorkflow(ops, makeWorkflow('w1'))
    expect(getWorkflow(ops.state, 'w1')?.id).toBe('w1')
    expect(getWorkflow(ops.state, 'missing')).toBeNull()
  })
})

describe('workflow run CRUD', () => {
  it('creates a run with pending node runs', () => {
    const ops = makeOps()
    const wf = makeWorkflow('w1')
    const run = createWorkflowRun(ops, wf, 'manual')
    expect(run.status).toBe('pending')
    expect(run.workflowId).toBe('w1')
    expect(run.trigger).toBe('manual')
    expect(run.nodeRuns).toHaveLength(1)
    expect(run.nodeRuns[0].nodeId).toBe('n1')
    expect(run.nodeRuns[0].status).toBe('pending')
  })

  it('patches a node run status', () => {
    const ops = makeOps()
    const wf = makeWorkflow('w1')
    const run = createWorkflowRun(ops, wf, 'manual')
    const updated = patchNodeRun(ops, run.id, 'n1', { status: 'running', startedAt: 2000 })
    expect(updated?.nodeRuns[0].status).toBe('running')
    expect(updated?.nodeRuns[0].startedAt).toBe(2000)
  })

  it('finalizes a run with completed status', () => {
    const ops = makeOps()
    const wf = makeWorkflow('w1')
    const run = createWorkflowRun(ops, wf, 'manual')
    const final = finalizeWorkflowRun(ops, run.id, 'completed')
    expect(final?.status).toBe('completed')
    expect(final?.completedAt).toBeTypeOf('number')
  })

  it('finalizes a run with failed status and error message', () => {
    const ops = makeOps()
    const wf = makeWorkflow('w1')
    const run = createWorkflowRun(ops, wf, 'manual')
    const final = finalizeWorkflowRun(ops, run.id, 'failed', 'Something went wrong')
    expect(final?.status).toBe('failed')
    expect(final?.error).toBe('Something went wrong')
  })

  it('lists runs for a specific workflow', () => {
    const ops = makeOps()
    const wf1 = makeWorkflow('w1')
    const wf2 = makeWorkflow('w2')
    createWorkflow(ops, wf1)
    createWorkflow(ops, wf2)
    createWorkflowRun(ops, wf1, 'manual')
    createWorkflowRun(ops, wf2, 'scheduled')
    expect(listWorkflowRuns(ops.state, 'w1')).toHaveLength(1)
    expect(listWorkflowRuns(ops.state, 'w2')).toHaveLength(1)
    expect(listWorkflowRuns(ops.state)).toHaveLength(2)
  })

  it('detects active (non-final) run', () => {
    const ops = makeOps()
    const wf = makeWorkflow('w1')
    createWorkflow(ops, wf)
    const run = createWorkflowRun(ops, wf, 'manual')
    updateWorkflowRun(ops, run.id, { status: 'running' })
    expect(getActiveRun(ops.state, 'w1')).toBeTruthy()
  })

  it('returns null for active run when all runs are finalized', () => {
    const ops = makeOps()
    const wf = makeWorkflow('w1')
    createWorkflow(ops, wf)
    const run = createWorkflowRun(ops, wf, 'manual')
    finalizeWorkflowRun(ops, run.id, 'completed')
    expect(getActiveRun(ops.state, 'w1')).toBeNull()
  })

  it('prunes runs beyond MAX_RUNS_PER_WORKFLOW', () => {
    const ops = makeOps()
    const wf = makeWorkflow('w1')
    createWorkflow(ops, wf)
    // Create 52 runs — should be pruned to 50
    for (let i = 0; i < 52; i++) {
      createWorkflowRun(ops, wf, 'manual')
    }
    expect(listWorkflowRuns(ops.state, 'w1')).toHaveLength(50)
  })
})
