import { runProcess } from '../../shared/child-process/run-process'
import type { ShellCommandData } from '../../shared/workflow-types'

export type ShellNodeResult = {
  stdout: string
  stderr: string
  exitCode: number | null
}

export async function runShellCommandNode(
  data: ShellCommandData,
  stdin?: string
): Promise<ShellNodeResult> {
  const result = await runProcess({
    program: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
    args: process.platform === 'win32' ? ['/c', data.command] : ['-c', data.command],
    cwd: data.workingDirectory || undefined,
    env: data.env,
    timeoutMs: data.timeoutSeconds * 1000,
    input: stdin
  })
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.code
  }
}
