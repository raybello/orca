import { WorkflowService } from '../workflows/workflow-service'
import { mainProcessState as state } from './main-process-state'

export function initializeMainProcessWorkflows(): WorkflowService {
  const store = state.store
  if (!store) {
    throw new Error('Store must be initialized before workflows')
  }
  return new WorkflowService(store)
}
