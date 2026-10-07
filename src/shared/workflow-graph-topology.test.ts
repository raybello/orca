import { describe, it, expect } from 'vitest'
import { topologicalSort, findTriggerNodes } from './workflow-graph-topology'
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

describe('topologicalSort', () => {
  it('returns empty for empty workflow', () => {
    expect(topologicalSort(makeWorkflow({}))).toEqual([])
  })
  it('sorts linear chain correctly', () => {
    const w = makeWorkflow({
      nodes: [
        { id: 'a', type: 'trigger_manual', pos: { x: 0, y: 0 }, data: {} },
        {
          id: 'b',
          type: 'shell_command',
          pos: { x: 0, y: 0 },
          data: { command: 'ls', workingDirectory: '/', timeoutSeconds: 10 }
        },
        {
          id: 'c',
          type: 'shell_command',
          pos: { x: 0, y: 0 },
          data: { command: 'echo', workingDirectory: '/', timeoutSeconds: 10 }
        }
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'a', targetNodeId: 'b' },
        { id: 'e2', sourceNodeId: 'b', targetNodeId: 'c' }
      ]
    })
    const sorted = topologicalSort(w)
    expect(sorted?.map((n) => n.id)).toEqual(['a', 'b', 'c'])
  })
  it('returns null for cycle', () => {
    const w = makeWorkflow({
      nodes: [
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
        { id: 'e1', sourceNodeId: 'a', targetNodeId: 'b' },
        { id: 'e2', sourceNodeId: 'b', targetNodeId: 'a' }
      ]
    })
    expect(topologicalSort(w)).toBeNull()
  })
})

describe('findTriggerNodes', () => {
  it('finds trigger node with no incoming edges', () => {
    const w = makeWorkflow({
      nodes: [
        {
          id: 'trigger',
          type: 'trigger_cron',
          pos: { x: 0, y: 0 },
          data: { schedule: '0 8 * * *' }
        },
        {
          id: 'step',
          type: 'shell_command',
          pos: { x: 0, y: 0 },
          data: { command: 'ls', workingDirectory: '/', timeoutSeconds: 10 }
        }
      ],
      edges: [{ id: 'e1', sourceNodeId: 'trigger', targetNodeId: 'step' }]
    })
    const triggers = findTriggerNodes(w)
    expect(triggers.map((n) => n.id)).toEqual(['trigger'])
  })
})
