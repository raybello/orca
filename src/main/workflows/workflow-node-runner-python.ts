import { runProcess } from '../../shared/child-process/run-process'
import type { PythonScriptData } from '../../shared/workflow-types'

export type PythonNodeResult = {
  stdout: string
  stderr: string
  exitCode: number | null
}

export async function runPythonScriptNode(
  data: PythonScriptData,
  stdin?: string
): Promise<PythonNodeResult> {
  const python = data.pythonBin ?? 'python3'
  const result = await runProcess({
    program: python,
    args: ['-c', data.script],
    cwd: data.workingDirectory || undefined,
    timeoutMs: data.timeoutSeconds * 1000,
    input: stdin
  })
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.code }
}
