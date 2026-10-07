import { useState, useEffect } from 'react'
import WorkflowList from './WorkflowList'
import WorkflowCanvas from './WorkflowCanvas'
import WorkflowNodeEditorPanel from './WorkflowNodeEditorPanel'
import WorkflowRunHistory from './WorkflowRunHistory'
import type { AgentWorkflow } from '../../../../shared/workflow-types'

export default function WorkflowsPage(): React.JSX.Element {
  const [canvasFocused, setCanvasFocused] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<AgentWorkflow | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const selectedWorkflowId = selectedWorkflow?.id ?? null
  useEffect(() => {
    if (!selectedWorkflowId) {
      return
    }
    const unsub = window.api.workflows.onChanged(({ workflows }) => {
      const updated = workflows.find((w) => w.id === selectedWorkflowId)
      if (updated) {
        setSelectedWorkflow(updated)
      }
    })
    return unsub
  }, [selectedWorkflowId])

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-background">
      <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
        {!canvasFocused && (
          <div className="w-[240px] shrink-0 border-r border-border flex flex-col min-h-0 overflow-hidden">
            <WorkflowList
              selectedWorkflowId={selectedWorkflow?.id ?? null}
              onSelect={setSelectedWorkflow}
            />
          </div>
        )}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <div className="flex flex-row flex-1 min-h-0">
            <div className="flex-1 min-w-0 min-h-0">
              <WorkflowCanvas
                workflow={selectedWorkflow}
                focused={canvasFocused}
                onFocus={() => setCanvasFocused(true)}
                onUnfocus={() => setCanvasFocused(false)}
                onNodeSelect={setSelectedNodeId}
                selectedNodeId={selectedNodeId}
              />
            </div>
            {selectedNodeId !== null && selectedWorkflow !== null && (
              <div className="w-[320px] shrink-0 border-l border-border">
                <WorkflowNodeEditorPanel
                  workflow={selectedWorkflow}
                  nodeId={selectedNodeId}
                  onClose={() => setSelectedNodeId(null)}
                  onWorkflowChange={setSelectedWorkflow}
                />
              </div>
            )}
          </div>
          {selectedWorkflow !== null && !canvasFocused && (
            <div className="border-t border-border h-[220px] shrink-0 overflow-hidden">
              <WorkflowRunHistory workflowId={selectedWorkflow.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
