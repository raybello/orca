import { describe, it, expect } from 'vitest'
import { runJsonTransformNode } from './workflow-node-runner-json'

describe('runJsonTransformNode', () => {
  it('returns input unchanged for empty expression', () => {
    expect(runJsonTransformNode({ expression: '' }, { a: 1 })).toEqual({ value: { a: 1 } })
  })

  it('returns input unchanged for identity expression "."', () => {
    expect(runJsonTransformNode({ expression: '.' }, [1, 2, 3])).toEqual({ value: [1, 2, 3] })
  })

  it('extracts a top-level property with $.field', () => {
    expect(runJsonTransformNode({ expression: '$.name' }, { name: 'alice' })).toEqual({
      value: 'alice'
    })
  })

  it('extracts a top-level property with bare field name', () => {
    expect(runJsonTransformNode({ expression: 'name' }, { name: 'bob' })).toEqual({ value: 'bob' })
  })

  it('extracts a nested property', () => {
    expect(runJsonTransformNode({ expression: '$.a.b' }, { a: { b: 99 } })).toEqual({ value: 99 })
  })

  it('extracts an array element by index', () => {
    expect(runJsonTransformNode({ expression: '$.items[1]' }, { items: ['x', 'y', 'z'] })).toEqual({
      value: 'y'
    })
  })

  it('returns null for a missing property', () => {
    expect(runJsonTransformNode({ expression: '$.missing' }, { a: 1 })).toEqual({ value: null })
  })

  it('returns null when traversal hits a non-object', () => {
    expect(runJsonTransformNode({ expression: '$.a.b' }, { a: 'string' })).toEqual({ value: null })
  })

  it('returns null when input is null', () => {
    expect(runJsonTransformNode({ expression: '$.field' }, null)).toEqual({ value: null })
  })

  it('returns null when input is a primitive', () => {
    expect(runJsonTransformNode({ expression: '$.field' }, 42)).toEqual({ value: null })
  })
})
