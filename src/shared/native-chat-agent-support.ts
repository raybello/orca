import type { TuiAgent } from './tui-agent'

export type NativeChatTranscriptAgent = 'claude' | 'codex' | 'cursor' | 'grok' | 'omp' | 'opencode'

/** Agents whose transcripts the native chat view can parse and render, in the
 *  order the settings pane advertises them. */
export const NATIVE_CHAT_SUPPORTED_AGENT_LIST: readonly TuiAgent[] = [
  'claude',
  'openclaude',
  'codex',
  'cursor',
  'grok',
  'omp',
  'opencode',
  'opencode2',
  'zcode'
]

export const NATIVE_CHAT_SUPPORTED_AGENTS: ReadonlySet<string> = new Set(
  NATIVE_CHAT_SUPPORTED_AGENT_LIST
)

export function isNativeChatSupportedAgent(agent: string | null | undefined): boolean {
  return agent != null && NATIVE_CHAT_SUPPORTED_AGENTS.has(agent)
}

/** Agents whose Model-A SSH transcript reader is not supported. A hook path alone
 *  does not establish owning-host reads, so OMP and Cursor remain gated even with metadata. */
export function nativeChatRequiresLocalTranscript(agent: string | null | undefined): boolean {
  const transcriptAgent = resolveNativeChatTranscriptAgent(agent)
  return (
    transcriptAgent === 'cursor' ||
    transcriptAgent === 'grok' ||
    transcriptAgent === 'omp' ||
    transcriptAgent === 'opencode'
  )
}

/** Selector TUIs require key steps rather than pasted option labels. */
export function shouldStepNativeChatAskAnswer(agent: string | null | undefined): boolean {
  const transcriptAgent = resolveNativeChatTranscriptAgent(agent)
  return (
    transcriptAgent === 'claude' ||
    transcriptAgent === 'codex' ||
    transcriptAgent === 'cursor' ||
    transcriptAgent === 'opencode'
  )
}

export function resolveNativeChatTranscriptAgent(
  agent: string | null | undefined
): NativeChatTranscriptAgent | null {
  // Why: OpenClaude writes the Claude transcript format and layout even though
  // Orca preserves its distinct agent identity for launch and UI behavior.
  if (agent === 'claude' || agent === 'openclaude') {
    return 'claude'
  }
  if (agent === 'opencode' || agent === 'opencode2' || agent === 'zcode') {
    return 'opencode'
  }
  if (agent === 'codex' || agent === 'cursor' || agent === 'grok' || agent === 'omp') {
    return agent
  }
  return null
}

export function nativeChatApprovalAcceptKey(agent: string | null | undefined): string {
  const transcriptAgent = resolveNativeChatTranscriptAgent(agent)
  if (transcriptAgent === 'opencode') {
    return '\r'
  }
  // Why: Cursor's approval prompt accepts 'y' for "Run (once)", not '1'.
  if (transcriptAgent === 'cursor') {
    return 'y'
  }
  return '1'
}
