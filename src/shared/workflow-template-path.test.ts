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
  it('builds nested array index path', () => {
    expect(buildTemplateExpr('n2', ['data', 'rows', 3, 'name'])).toBe(
      '{{steps.n2.json.data.rows[3].name}}'
    )
  })
  it('handles node ids with hyphens and underscores', () => {
    expect(buildTemplateExpr('my-node_01', [])).toBe('{{steps.my-node_01.output}}')
  })
  it('builds path with single key', () => {
    expect(buildTemplateExpr('n1', ['result'])).toBe('{{steps.n1.json.result}}')
  })
  it('builds path starting with numeric index (treated as key at index 0)', () => {
    expect(buildTemplateExpr('n1', [0])).toBe('{{steps.n1.json.[0]}}')
  })
})

describe('resolveTemplateExpr', () => {
  const steps = {
    n1: {
      output: 'hello world',
      json: { name: 'Alice', scores: [10, 20], nested: { value: 'deep' } }
    },
    n2: { output: '', json: null }
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
  it('resolves nested json field', () => {
    expect(resolveTemplateExpr('{{steps.n1.json.nested.value}}', steps)).toBe('deep')
  })
  it('leaves unknown node refs unchanged', () => {
    expect(resolveTemplateExpr('{{steps.missing.output}}', steps)).toBe('{{steps.missing.output}}')
  })
  it('leaves malformed refs unchanged', () => {
    expect(resolveTemplateExpr('{{steps.n1}}', steps)).toBe('{{steps.n1}}')
    expect(resolveTemplateExpr('{{notSteps.n1.output}}', steps)).toBe('{{notSteps.n1.output}}')
  })
  it('resolves multiple refs in one string', () => {
    expect(
      resolveTemplateExpr('{{steps.n1.json.name}} scored {{steps.n1.json.scores[0]}}', steps)
    ).toBe('Alice scored 10')
  })
  it('resolves null json to string "null"', () => {
    expect(
      resolveTemplateExpr('{{steps.n1.json.name}}', {
        n1: { output: '', json: { name: null } }
      })
    ).toBe('null')
  })
  it('handles out-of-bounds array index gracefully (leaves unchanged)', () => {
    expect(resolveTemplateExpr('{{steps.n1.json.scores[99]}}', steps)).toBe(
      '{{steps.n1.json.scores[99]}}'
    )
  })
  it('leaves ref unchanged when json is null', () => {
    expect(resolveTemplateExpr('{{steps.n2.json.name}}', steps)).toBe('{{steps.n2.json.name}}')
  })
  it('handles empty string output', () => {
    expect(resolveTemplateExpr('{{steps.n2.output}}', steps)).toBe('')
  })
  it('no-op when string has no template refs', () => {
    expect(resolveTemplateExpr('plain text', steps)).toBe('plain text')
  })
  it('handles adjacent template refs', () => {
    expect(resolveTemplateExpr('{{steps.n1.json.name}}{{steps.n1.output}}', steps)).toBe(
      'Alicehello world'
    )
  })
})
