import { describe, it, expect } from 'vitest'
import { validateWorkflow } from './workflow-graph-validation'
import type { AgentWorkflow } from './workflow-types'

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

describe('validateWorkflow', () => {
  it('errors on empty workflow', () => {
    const errs = validateWorkflow(makeWorkflow({}))
    expect(errs.some((e) => e.kind === 'empty_workflow')).toBe(true)
  })
  it('errors with no trigger node', () => {
    const errs = validateWorkflow(
      makeWorkflow({
        nodes: [
          {
            id: 'a',
            type: 'shell_command',
            pos: { x: 0, y: 0 },
            data: { command: 'ls', workingDirectory: '/', timeoutSeconds: 10 }
          }
        ]
      })
    )
    expect(errs.some((e) => e.kind === 'no_trigger')).toBe(true)
  })
  it('passes valid workflow', () => {
    const errs = validateWorkflow(
      makeWorkflow({
        nodes: [
          { id: 't', type: 'trigger_manual', pos: { x: 0, y: 0 }, data: {} },
          {
            id: 's',
            type: 'shell_command',
            pos: { x: 0, y: 0 },
            data: { command: 'ls', workingDirectory: '/', timeoutSeconds: 10 }
          }
        ],
        edges: [{ id: 'e1', sourceNodeId: 't', targetNodeId: 's' }]
      })
    )
    expect(errs).toHaveLength(0)
  })
  it('detects cycle', () => {
    const errs = validateWorkflow(
      makeWorkflow({
        nodes: [
          { id: 't', type: 'trigger_manual', pos: { x: 0, y: 0 }, data: {} },
          {
            id: 'a',
            type: 'shell_command',
            pos: { x: 0, y: 0 },
            data: { command: 'ls', workingDirectory: '/', timeoutSeconds: 10 }
          },
          {
            id: 'b',
            type: 'shell_command',
            pos: { x: 0, y: 0 },
            data: { command: 'ls', workingDirectory: '/', timeoutSeconds: 10 }
          }
        ],
        edges: [
          { id: 'e1', sourceNodeId: 't', targetNodeId: 'a' },
          { id: 'e2', sourceNodeId: 'a', targetNodeId: 'b' },
          { id: 'e3', sourceNodeId: 'b', targetNodeId: 'a' }
        ]
      })
    )
    expect(errs.some((e) => e.kind === 'cycle')).toBe(true)
  })
})
