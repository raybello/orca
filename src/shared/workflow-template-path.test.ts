import { describe, it, expect } from 'vitest'
import { buildTemplateExpr, resolveTemplateExpr } from './workflow-template-path'

describe('buildTemplateExpr', () => {
  it('builds output ref with empty path', () => {
    expect(buildTemplateExpr('node1', [])).toBe('{{steps.node1.output}}')
  })
  it('builds json field path', () => {
    expect(buildTemplateExpr('node1', ['foo', 'bar'])).toBe('{{steps.node1.json.foo.bar}}')
  })
  it('builds array index path', () => {
    expect(buildTemplateExpr('node1', ['items', 0])).toBe('{{steps.node1.json.items[0]}}')
  })
})

describe('resolveTemplateExpr', () => {
  const steps = {
    n1: { output: 'hello world', json: { name: 'Alice', scores: [10, 20] } }
  }
  it('resolves output reference', () => {
    expect(resolveTemplateExpr('Got: {{steps.n1.output}}', steps)).toBe('Got: hello world')
  })
  it('resolves json field', () => {
    expect(resolveTemplateExpr('{{steps.n1.json.name}}', steps)).toBe('Alice')
  })
  it('resolves array index', () => {
    expect(resolveTemplateExpr('{{steps.n1.json.scores[1]}}', steps)).toBe('20')
  })
  it('leaves unknown refs unchanged', () => {
    expect(resolveTemplateExpr('{{steps.missing.output}}', steps)).toBe('{{steps.missing.output}}')
  })
})
