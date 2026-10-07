import { describe, it, expect } from 'vitest'
import { isWorkflowDue, findDueWorkflows } from './workflow-scheduler'
import type { AgentWorkflow } from '../../shared/workflow-types'

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

// Build timestamps using local time (cronMatches uses getHours/getMinutes which are local)
function localTimestamp(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0
): number {
  const d = new Date(year, month - 1, day, hour, minute, second, 0)
  return d.getTime()
}

// 2024-01-15 08:00:00 local — a Monday
const MON_8AM_UTC = localTimestamp(2024, 1, 15, 8, 0, 0)
const MON_8AM_30S = MON_8AM_UTC + 30_000 // 30 seconds past the minute
const MON_9AM_UTC = localTimestamp(2024, 1, 15, 9, 0, 0)

describe('isWorkflowDue', () => {
  it('returns false when workflow is disabled', () => {
    const wf = makeWorkflow({ schedule: '0 8 * * *', enabled: false })
    expect(isWorkflowDue(wf, MON_8AM_UTC)).toBe(false)
  })

  it('returns false when workflow has no schedule', () => {
    const wf = makeWorkflow({ schedule: null, enabled: true })
    expect(isWorkflowDue(wf, MON_8AM_UTC)).toBe(false)
  })

  it('returns true when cron matches current minute', () => {
    const wf = makeWorkflow({ schedule: '0 8 * * *', enabled: true })
    expect(isWorkflowDue(wf, MON_8AM_UTC)).toBe(true)
  })

  it('returns true within the same minute (30s past)', () => {
    const wf = makeWorkflow({ schedule: '0 8 * * *', enabled: true })
    expect(isWorkflowDue(wf, MON_8AM_30S)).toBe(true)
  })

  it('returns false one hour later', () => {
    const wf = makeWorkflow({ schedule: '0 8 * * *', enabled: true })
    expect(isWorkflowDue(wf, MON_9AM_UTC)).toBe(false)
  })

  it('returns false for invalid cron expression', () => {
    const wf = makeWorkflow({ schedule: 'not a cron', enabled: true })
    expect(isWorkflowDue(wf, MON_8AM_UTC)).toBe(false)
  })

  it('matches every-minute cron', () => {
    const wf = makeWorkflow({ schedule: '* * * * *', enabled: true })
    expect(isWorkflowDue(wf, MON_8AM_UTC)).toBe(true)
    expect(isWorkflowDue(wf, MON_9AM_UTC)).toBe(true)
  })
})

describe('findDueWorkflows', () => {
  it('returns only due workflows', () => {
    const due = makeWorkflow({ id: 'due', schedule: '0 8 * * *', enabled: true })
    const notDue = makeWorkflow({ id: 'not-due', schedule: '0 9 * * *', enabled: true })
    const disabled = makeWorkflow({ id: 'disabled', schedule: '0 8 * * *', enabled: false })
    const result = findDueWorkflows([due, notDue, disabled], MON_8AM_UTC)
    expect(result.map((w) => w.id)).toEqual(['due'])
  })

  it('returns empty array when no workflows are due', () => {
    const wf = makeWorkflow({ schedule: '0 9 * * *', enabled: true })
    expect(findDueWorkflows([wf], MON_8AM_UTC)).toHaveLength(0)
  })

  it('returns multiple workflows when several are due', () => {
    const wf1 = makeWorkflow({ id: 'w1', schedule: '* * * * *', enabled: true })
    const wf2 = makeWorkflow({ id: 'w2', schedule: '* * * * *', enabled: true })
    const result = findDueWorkflows([wf1, wf2], MON_8AM_UTC)
    expect(result).toHaveLength(2)
  })
})
