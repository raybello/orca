import { runProcess } from '../../shared/child-process/run-process'
import type { AgentCallData } from '../../shared/workflow-types'
import type { TuiAgent } from '../../shared/tui-agent'

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

export async function runAgentCallNode(
  data: AgentCallData,
  resolvedPrompt: string
): Promise<AgentNodeResult> {
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
