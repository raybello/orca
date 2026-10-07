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
  structuredOutput: boolean
): { program: string; args: string[] } {
  if (agentId === 'claude') {
    return {
      program: 'claude',
      args: ['-p', prompt, ...(structuredOutput ? ['--output-format', 'json'] : [])]
    }
  }
  if (agentId === 'codex') {
    return { program: 'codex', args: ['--quiet', prompt] }
  }
  return {
    program: 'cursor-agent',
    args: ['--prompt', prompt, ...(structuredOutput ? ['--output-format', 'json'] : []), '--yolo']
  }
}

export async function runAgentCallNode(
  data: AgentCallData,
  resolvedPrompt: string
): Promise<AgentNodeResult> {
  const { program, args } = buildAgentArgs(
    data.agentId,
    resolvedPrompt,
    data.structuredOutputSchema !== null
  )
  const result = await runProcess({
    program,
    args,
    cwd: data.workingDirectory || undefined,
    timeoutMs: data.timeoutSeconds * 1000
  })
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.code }
}
