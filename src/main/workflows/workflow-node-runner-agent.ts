import { runProcess } from '../../shared/child-process/run-process'
import type { AgentCallData } from '../../shared/workflow-types'
import type { TuiAgent } from '../../shared/tui-agent'
import type { RemoteExecFn } from './workflow-remote-exec'

export type AgentNodeResult = {
  stdout: string
  stderr: string
  exitCode: number | null
}

function buildAgentArgs(
  agentId: TuiAgent,
  prompt: string,
  structuredOutput: boolean,
  model?: string
): { program: string; args: string[] } {
  const modelArgs = model ? ['--model', model] : []
  if (agentId === 'claude') {
    return {
      program: 'claude',
      args: ['-p', ...modelArgs, ...(structuredOutput ? ['--output-format', 'json'] : []), prompt]
    }
  }
  if (agentId === 'codex') {
    return { program: 'codex', args: ['--quiet', ...modelArgs, prompt] }
  }
  // cursor-agent -p runs non-interactively (print mode), prompt is a positional arg
  return {
    program: 'cursor-agent',
    args: ['-p', ...modelArgs, ...(structuredOutput ? ['--output-format', 'json'] : []), prompt]
  }
}

/** Build a shell-safe single-string command for running an agent CLI over SSH. */
function buildAgentRemoteCommand(
  agentId: TuiAgent,
  prompt: string,
  structuredOutput: boolean,
  model?: string
): string {
  // Escape single-quotes in the prompt so it is safe inside '…'
  const escapedPrompt = prompt.replace(/'/g, `'\\''`)
  const modelFlag = model ? `--model ${model} ` : ''
  const jsonFlag = structuredOutput ? '--output-format json ' : ''
  if (agentId === 'claude') {
    return `claude -p ${modelFlag}${jsonFlag}'${escapedPrompt}'`
  }
  if (agentId === 'codex') {
    return `codex --quiet ${modelFlag}'${escapedPrompt}'`
  }
  return `cursor-agent -p ${modelFlag}${jsonFlag}'${escapedPrompt}'`
}

export async function runAgentCallNode(
  data: AgentCallData,
  resolvedPrompt: string,
  remoteExec?: RemoteExecFn,
  signal?: AbortSignal
): Promise<AgentNodeResult> {
  if (remoteExec) {
    const command = buildAgentRemoteCommand(
      data.agentId,
      resolvedPrompt,
      data.structuredOutputSchema !== null,
      data.model
    )
    const result = await remoteExec(command, {
      signal,
      timeoutMs: data.timeoutSeconds * 1000
    })
    return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode }
  }
  const { program, args } = buildAgentArgs(
    data.agentId,
    resolvedPrompt,
    data.structuredOutputSchema !== null,
    data.model
  )
  const result = await runProcess({
    program,
    args,
    cwd: data.workingDirectory || undefined,
    timeoutMs: data.timeoutSeconds * 1000
  })
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.code }
}
