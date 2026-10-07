export type JsonPath = (string | number)[]

export function buildTemplateExpr(nodeId: string, path: JsonPath): string {
  if (path.length === 0) {
    return `{{steps.${nodeId}.output}}`
  }
  const dotPath = path
    .map((seg, i) => (typeof seg === 'number' ? `[${seg}]` : i === 0 ? seg : `.${seg}`))
    .join('')
  return `{{steps.${nodeId}.json.${dotPath}}}`
}

export function resolveTemplateExpr(
  expr: string,
  steps: Record<string, { output: string; json: unknown }>
): string {
  return expr.replace(/\{\{([^}]+)\}\}/g, (match, path: string) => {
    const parts = path.trim().split('.')
    if (parts[0] !== 'steps' || parts.length < 3) {
      return match
    }
    const nodeId = parts[1]
    const step = steps[nodeId]
    if (!step) {
      return match
    }
    if (parts[2] === 'output') {
      return step.output
    }
    if (parts[2] === 'json') {
      let value: unknown = step.json
      for (let i = 3; i < parts.length; i++) {
        if (value === null || typeof value !== 'object') {
          return match
        }
        const seg = parts[i]
        const arrMatch = seg.match(/^(.+)\[(\d+)\]$/)
        if (arrMatch) {
          const key = arrMatch[1]
          const idx = Number(arrMatch[2])
          // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: traversing unknown JSON at runtime; shape verified by narrowing above
          value = (value as Record<string, unknown[]>)[key]?.[idx]
        } else {
          // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: same as above
          value = (value as Record<string, unknown>)[seg]
        }
        if (value === undefined) {
          return match
        }
      }
      return value === null ? 'null' : String(value)
    }
    return match
  })
}
