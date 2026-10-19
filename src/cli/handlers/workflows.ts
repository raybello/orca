import { readFile } from 'node:fs/promises'
import {
  formatWorkflowDelete,
  formatWorkflowImport,
  formatWorkflowList,
  formatWorkflowRun,
  formatWorkflowRuns,
  formatWorkflowShow,
  printResult,
  type WorkflowDeletePayload,
  type WorkflowImportPayload,
  type WorkflowListPayload,
  type WorkflowRunPayload,
  type WorkflowRunsPayload,
  type WorkflowShowPayload
} from '../format'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import type { CommandHandler } from '../dispatch'

function readImportSource(flags: Map<string, string | boolean>): Promise<string> {
  const file = getRequiredStringFlag(flags, 'file')
  if (file === '-') {
    // Import from stdin so agents (and pipelines) can pipe workflow JSON straight in.
    return new Promise((resolve, reject) => {
      let data = ''
      process.stdin.setEncoding('utf8')
      const onData = (chunk: Buffer | string) => {
        data += String(chunk)
      }
      const onEnd = () => {
        cleanup()
        resolve(data)
      }
      const onError = (err: Error) => {
        cleanup()
        reject(err)
      }
      const cleanup = () => {
        process.stdin.off('data', onData)
        process.stdin.off('end', onEnd)
        process.stdin.off('error', onError)
      }
      process.stdin.on('data', onData)
      process.stdin.on('end', onEnd)
      process.stdin.on('error', onError)
    })
  }
  return readFile(file, 'utf8')
}

export const WORKFLOW_HANDLERS: Record<string, CommandHandler> = {
  'workflows list': async ({ client, json }) => {
    const result = await client.call<WorkflowListPayload>('workflows.list')
    printResult(result, json, formatWorkflowList)
  },
  'workflows show': async ({ flags, client, json }) => {
    const result = await client.call<WorkflowShowPayload>('workflows.show', {
      id: getRequiredStringFlag(flags, 'id')
    })
    printResult(result, json, formatWorkflowShow)
  },
  'workflows import': async ({ flags, client, json }) => {
    const raw = await readImportSource(flags)
    const executionTargetId = getOptionalStringFlag(flags, 'execution-target')
    const result = await client.call<WorkflowImportPayload>('workflows.import', {
      json: raw,
      ...(executionTargetId !== undefined ? { executionTargetId } : {})
    })
    printResult(result, json, formatWorkflowImport)
  },
  'workflows rm': async ({ flags, client, json }) => {
    const result = await client.call<WorkflowDeletePayload>('workflows.delete', {
      id: getRequiredStringFlag(flags, 'id')
    })
    printResult(result, json, formatWorkflowDelete)
  },
  'workflows run': async ({ flags, client, json }) => {
    const result = await client.call<WorkflowRunPayload>('workflows.run', {
      id: getRequiredStringFlag(flags, 'id')
    })
    printResult(result, json, formatWorkflowRun)
  },
  'workflows runs': async ({ flags, client, json }) => {
    const workflowId = getOptionalStringFlag(flags, 'id')
    const result = await client.call<WorkflowRunsPayload>('workflows.runs', {
      ...(workflowId !== undefined ? { workflowId } : {}),
      limit: 20
    })
    printResult(result, json, formatWorkflowRuns)
  }
}
