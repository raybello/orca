import { useState, useEffect } from 'react'
import type { WorkflowRun } from '../../../shared/workflow-types'

export type StepOutput = { output: string; json: unknown }

export function useWorkflowLastOutputs(
  workflowId: string | null
): Record<string, StepOutput> | null {
  const [outputs, setOutputs] = useState<Record<string, StepOutput> | null>(null)

  useEffect(() => {
    if (!workflowId) {
      setOutputs(null)
      return
    }

    function extractOutputs(run: WorkflowRun): Record<string, StepOutput> {
      const result: Record<string, StepOutput> = {}
      for (const nr of run.nodeRuns) {
        if (nr.stdout !== null || nr.outputValue !== null) {
          let json: unknown = null
          if (nr.stdout) {
            try {
              json = JSON.parse(nr.stdout)
            } catch {
              json = nr.outputValue
            }
          } else {
            json = nr.outputValue
          }
          result[nr.nodeId] = { output: nr.stdout ?? '', json: json ?? nr.outputValue }
        }
      }
      return result
    }

    void window.api.workflows.getRuns(workflowId).then((runs) => {
      const sorted = [...runs].sort((a, b) => b.startedAt - a.startedAt)
      const last = sorted.find((r) => r.status === 'completed')
      setOutputs(last ? extractOutputs(last) : null)
    })

    const unsub = window.api.workflows.onRunUpdated(({ workflowId: wid, run }) => {
      if (wid !== workflowId || run.status !== 'completed') {
        return
      }
      setOutputs(extractOutputs(run))
    })
    return unsub
  }, [workflowId])

  return outputs
}
