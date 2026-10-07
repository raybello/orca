import { ipcMain } from 'electron'
import type { WorkflowService } from '../workflows/workflow-service'
import type { AgentWorkflow } from '../../shared/workflow-types'

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
}

export function unregisterWorkflowHandlers(): void {
  for (const channel of [
    'workflows:list',
    'workflows:getRuns',
    'workflows:create',
    'workflows:update',
    'workflows:delete',
    'workflows:runNow',
    'workflows:cancelRun'
  ]) {
    ipcMain.removeHandler(channel)
  }
}
