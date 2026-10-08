import type { WorkflowNode, WorkflowNodeType } from '../../../../shared/workflow-types'

export const NODE_TYPE_LABELS: Record<WorkflowNodeType, string> = {
  trigger_cron: 'Cron Trigger',
  trigger_manual: 'Manual Trigger',
  shell_command: 'Shell Command',
  python_script: 'Python Script',
  agent_call: 'Agent Call',
  file_read: 'File Read',
  file_write: 'File Write',
  email_send: 'Email Send',
  json_transform: 'JSON Transform'
}

export const NODE_TYPE_COLORS: Record<WorkflowNodeType, string> = {
  trigger_cron: 'border-violet-400 bg-violet-50 dark:bg-violet-950/30',
  trigger_manual: 'border-violet-400 bg-violet-50 dark:bg-violet-950/30',
  shell_command: 'border-slate-400 bg-slate-50 dark:bg-slate-900/30',
  python_script: 'border-blue-400 bg-blue-50 dark:bg-blue-950/30',
  agent_call: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30',
  file_read: 'border-amber-400 bg-amber-50 dark:bg-amber-950/30',
  file_write: 'border-orange-400 bg-orange-50 dark:bg-orange-950/30',
  email_send: 'border-pink-400 bg-pink-50 dark:bg-pink-950/30',
  json_transform: 'border-cyan-400 bg-cyan-50 dark:bg-cyan-950/30'
}

export function nodeLabel(node: WorkflowNode): string {
  switch (node.type) {
    case 'shell_command':
      return node.data.command || node.id.slice(0, 8)
    case 'python_script':
      return node.data.script.slice(0, 30) || node.id.slice(0, 8)
    case 'agent_call':
      return node.data.prompt.slice(0, 30) || node.id.slice(0, 8)
    case 'file_read':
      return node.data.filePath || node.id.slice(0, 8)
    case 'file_write':
      return node.data.filePath || node.id.slice(0, 8)
    case 'trigger_cron':
      return node.data.schedule || node.id.slice(0, 8)
    case 'trigger_manual':
      return 'Manual'
    case 'email_send':
      return node.data.to || node.id.slice(0, 8)
    case 'json_transform':
      return node.data.expression.slice(0, 30) || node.id.slice(0, 8)
  }
}

export const ADD_NODE_TYPES: WorkflowNodeType[] = [
  'trigger_cron',
  'trigger_manual',
  'shell_command',
  'python_script',
  'agent_call',
  'file_read',
  'file_write',
  'email_send',
  'json_transform'
]

export function buildDefaultNode(
  id: string,
  type: WorkflowNodeType,
  pos: { x: number; y: number }
): WorkflowNode {
  switch (type) {
    case 'trigger_cron':
      return { id, type, pos, data: { schedule: '0 8 * * *' } }
    case 'trigger_manual':
      return { id, type, pos, data: {} }
    case 'shell_command':
      return { id, type, pos, data: { command: '', workingDirectory: '', timeoutSeconds: 30 } }
    case 'python_script':
      return {
        id,
        type,
        pos,
        data: { script: '', workingDirectory: '', timeoutSeconds: 30, pythonBin: 'python3' }
      }
    case 'agent_call':
      return {
        id,
        type,
        pos,
        data: {
          prompt: '',
          agentId: 'cursor',
          structuredOutputSchema: null,
          workingDirectory: '',
          timeoutSeconds: 120
        }
      }
    case 'file_read':
      return { id, type, pos, data: { filePath: '' } }
    case 'file_write':
      return {
        id,
        type,
        pos,
        data: { filePath: '', content: '', mode: 'overwrite', createParents: true }
      }
    case 'email_send':
      return { id, type, pos, data: { to: '', subject: '', body: '', smtpProfileId: null } }
    case 'json_transform':
      return { id, type, pos, data: { expression: '' } }
  }
}
