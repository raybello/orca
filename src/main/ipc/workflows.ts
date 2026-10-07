import { ipcMain } from 'electron'
import { runProcess } from '../../shared/child-process/run-process'
import {
  CLAUDE_MODEL_LIST_STDIN,
  CLAUDE_MODEL_LIST_ARGS,
  parseClaudeModelList
} from '../../shared/claude-model-list-probe'
import type { WorkflowService } from '../workflows/workflow-service'
import type { AgentWorkflow } from '../../shared/workflow-types'
import type { TuiAgent } from '../../shared/tui-agent'

export type WorkflowModel = { id: string; label: string }

const MODEL_LIST_TIMEOUT_MS = 10_000

function parseCursorAgentModels(stdout: string): WorkflowModel[] {
  const seen = new Set<string>()
  const models: WorkflowModel[] = []
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim()
    // format: "model-id - Display Name" or just "model-id"
    const dashIdx = line.indexOf(' - ')
    const id = dashIdx !== -1 ? line.slice(0, dashIdx).trim() : line
    const label = dashIdx !== -1 ? line.slice(dashIdx + 3).trim() : line
    if (!id || !/^[a-z0-9][a-z0-9._-]*$/i.test(id) || seen.has(id)) {
      continue
    }
    seen.add(id)
    models.push({ id, label: label || id })
  }
  return models
}

async function fetchModelsForAgent(agentId: TuiAgent): Promise<WorkflowModel[]> {
  if (agentId === 'claude') {
    const result = await runProcess({
      program: 'claude',
      args: CLAUDE_MODEL_LIST_ARGS,
      input: CLAUDE_MODEL_LIST_STDIN,
      timeoutMs: MODEL_LIST_TIMEOUT_MS
    })
    return parseClaudeModelList(result.stdout).map((m) => ({ id: m.id, label: m.label }))
  }
  if (agentId === 'cursor') {
    const result = await runProcess({
      program: 'cursor-agent',
      args: ['models'],
      timeoutMs: MODEL_LIST_TIMEOUT_MS
    })
    return parseCursorAgentModels(result.stdout)
  }
  if (agentId === 'codex') {
    const result = await runProcess({
      program: 'codex',
      args: ['models', '--json'],
      timeoutMs: MODEL_LIST_TIMEOUT_MS
    })
    try {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: parsing unknown CLI JSON output; shape verified by field checks below
      const parsed = JSON.parse(result.stdout) as {
        models?: { slug?: string; display_name?: string }[]
      }
      return (parsed.models ?? [])
        .filter(
          (m): m is { slug: string; display_name: string } =>
            typeof m.slug === 'string' && typeof m.display_name === 'string'
        )
        .map((m) => ({ id: m.slug, label: m.display_name }))
    } catch {
      return []
    }
  }
  return []
}

export function registerWorkflowHandlers(service: WorkflowService): void {
  ipcMain.handle('workflows:list', () => service.listWorkflows())

  ipcMain.handle('workflows:getRuns', (_e, workflowId?: string) => service.listRuns(workflowId))

  ipcMain.handle(
    'workflows:create',
    (_e, partial: Omit<AgentWorkflow, 'id' | 'createdAt' | 'updatedAt'>) =>
      service.createWorkflow(partial)
  )

  ipcMain.handle('workflows:update', (_e, id: string, patch: Partial<AgentWorkflow>) =>
    service.updateWorkflow(id, patch)
  )

  ipcMain.handle('workflows:delete', (_e, id: string) => service.deleteWorkflow(id))

  ipcMain.handle('workflows:runNow', async (_e, workflowId: string) => {
    const workflow = service.getWorkflow(workflowId)
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found.`)
    }
    return service.runWorkflow(workflow, 'manual')
  })

  ipcMain.handle('workflows:cancelRun', (_e, runId: string) => {
    service.cancelRun(runId)
  })

  ipcMain.handle(
    'workflows:listModels',
    async (_e, agentId: TuiAgent): Promise<WorkflowModel[]> => {
      try {
        return await fetchModelsForAgent(agentId)
      } catch {
        return []
      }
    }
  )
}

export function unregisterWorkflowHandlers(): void {
  for (const channel of [
    'workflows:list',
    'workflows:getRuns',
    'workflows:create',
    'workflows:update',
    'workflows:delete',
    'workflows:runNow',
    'workflows:cancelRun',
    'workflows:listModels'
  ]) {
    ipcMain.removeHandler(channel)
  }
}
