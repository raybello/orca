import { runProcess } from '../../shared/child-process/run-process'
import type { PythonScriptData } from '../../shared/workflow-types'
import type { RemoteExecFn } from './workflow-remote-exec'

export type PythonNodeResult = {
  stdout: string
  stderr: string
  exitCode: number | null
}

export async function runPythonScriptNode(
  data: PythonScriptData,
  stdin?: string,
  remoteExec?: RemoteExecFn,
  signal?: AbortSignal
): Promise<PythonNodeResult> {
  const python = data.pythonBin ?? 'python3'
  if (remoteExec) {
    // Escape single quotes in the script for remote shell safety
    const escaped = data.script.replace(/'/g, `'\\''`)
    const result = await remoteExec(`${python} -c '${escaped}'`, {
      stdin,
      signal,
      timeoutMs: data.timeoutSeconds * 1000
    })
    return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode }
  }
  const result = await runProcess({
    program: python,
    args: ['-c', data.script],
    cwd: data.workingDirectory || undefined,
    timeoutMs: data.timeoutSeconds * 1000,
    input: stdin
  })
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.code }
}
