import type { JsonTransformData } from '../../shared/workflow-types'

export type JsonTransformResult = { value: unknown }

export function runJsonTransformNode(
  data: JsonTransformData,
  inputJson: unknown
): JsonTransformResult {
  // evaluate simple JSONPath-style dot-access expression against inputJson
  const expr = data.expression.trim()
  if (!expr || expr === '.') {
    return { value: inputJson }
  }
  const parts = expr.replace(/^\$\.?/, '').split('.')
  let value: unknown = inputJson
  for (const part of parts) {
    if (value === null || typeof value !== 'object') {
      return { value: null }
    }
    const arrMatch = part.match(/^([^[]+)\[(\d+)\]$/)
    if (arrMatch) {
      const key = arrMatch[1]
      const idx = Number(arrMatch[2])
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: traversing unknown JSON object; narrowed to non-null object above
      value = (value as Record<string, unknown[]>)[key]?.[idx] ?? null
    } else {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: same as above
      value = (value as Record<string, unknown>)[part] ?? null
    }
  }
  return { value }
}
