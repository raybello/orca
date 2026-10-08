/* oxlint-disable react-doctor/no-array-index-as-key -- Why: read-only JSON display tree; array items have no stable id and order never changes */
import { translate } from '@/i18n/i18n'
import { buildTemplateExpr } from '../../../../shared/workflow-template-path'
import type { JsonPath } from '../../../../shared/workflow-template-path'

type Props = {
  nodeId: string
  output: unknown
  onCopyExpr?: (expr: string) => void
}

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  })
}

function JsonNode({
  nodeId,
  value,
  path,
  onCopyExpr
}: {
  nodeId: string
  value: unknown
  path: JsonPath
  onCopyExpr?: (expr: string) => void
}): React.JSX.Element {
  if (value === null || typeof value !== 'object') {
    const expr = buildTemplateExpr(nodeId, path)
    const handleClick = (): void => {
      if (onCopyExpr) {
        onCopyExpr(expr)
      } else {
        copyToClipboard(expr)
      }
    }
    return (
      <span
        className="cursor-pointer hover:bg-primary/10 rounded px-0.5 text-[11px] font-mono"
        title={`${translate('workflows.output.clickTo', 'Click to')} ${onCopyExpr ? translate('workflows.output.insert', 'insert') : translate('workflows.output.copy', 'copy')}: ${expr}`}
        onClick={handleClick}
      >
        {JSON.stringify(value)}
      </span>
    )
  }
  if (Array.isArray(value)) {
    // TypeScript narrows value to unknown[] after Array.isArray check
    return (
      <span className="text-[11px] font-mono">
        [
        {value.map((item, i) => (
          <span key={i}>
            <JsonNode nodeId={nodeId} value={item} path={[...path, i]} onCopyExpr={onCopyExpr} />
            {i < value.length - 1 ? ', ' : ''}
          </span>
        ))}
        ]
      </span>
    )
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: value is a non-null non-array object at this point; narrowed above
  const entries = Object.entries(value as Record<string, unknown>)
  return (
    <div className="text-[11px] font-mono ml-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-start gap-1">
          <span className="text-muted-foreground shrink-0">{k}:</span>
          <JsonNode nodeId={nodeId} value={v} path={[...path, k]} onCopyExpr={onCopyExpr} />
        </div>
      ))}
    </div>
  )
}

export default function WorkflowNodeOutputInspector({
  nodeId,
  output,
  onCopyExpr
}: Props): React.JSX.Element {
  return (
    <div className="bg-muted/30 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto scrollbar-sleek">
      <JsonNode nodeId={nodeId} value={output} path={[]} onCopyExpr={onCopyExpr} />
    </div>
  )
}
