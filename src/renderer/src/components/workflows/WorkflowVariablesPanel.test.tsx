/** @vitest-environment happy-dom */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WorkflowVariablesPanel from './WorkflowVariablesPanel'

Object.assign(window, {
  api: { workflows: { listVariables: vi.fn(async () => []) } }
})

afterEach(cleanup)

describe('WorkflowVariablesPanel new-variable form', () => {
  it('renders every control at one consistent height', async () => {
    const { container } = render(<WorkflowVariablesPanel />)

    // All form controls use h-7 for consistent height. The Input and SelectTrigger
    // use !h-7 to override their default heights with !important.
    const trigger = container.querySelector('[data-slot="select-trigger"]')
    expect(trigger?.className).toContain('h-7')

    for (const input of container.querySelectorAll('[data-slot="input"]')) {
      expect(input.className).toContain('h-7')
    }

    for (const button of container.querySelectorAll('[data-slot="button"]')) {
      expect(button.className).toContain('h-7')
    }
  })
})
