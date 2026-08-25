import { randomUUID } from 'node:crypto'

export const toolCatalog = {
  tool_01_stop_lifts: {
    number: '01', name: 'Stop adjacent lifts', endpoint: 'POST /tools/stop-lifts',
    description: 'Pauses crane lifts inside the affected operating envelope.',
    output: 'QC lift interlock engaged; adjacent moves paused.',
  },
  tool_02_isolate_asset: {
    number: '02', name: 'Isolate affected asset', endpoint: 'POST /tools/isolate-asset',
    description: 'Removes unsafe equipment from the active work plan.',
    output: 'Asset isolated and work queue protected.',
  },
  tool_03_dispatch_maintenance: {
    number: '03', name: 'Dispatch maintenance', endpoint: 'POST /tools/dispatch-maintenance',
    description: 'Creates a priority engineering work order.',
    output: 'Maintenance team dispatched with diagnostic context.',
  },
  tool_04_exclusion_zone: {
    number: '04', name: 'Establish exclusion zone', endpoint: 'POST /tools/establish-exclusion-zone',
    description: 'Clears personnel and locks the hazardous quay area.',
    output: 'Safety perimeter active; personnel count inside zone is zero.',
  },
  tool_05_transfer_power: {
    number: '05', name: 'Transfer redundant power', endpoint: 'POST /tools/transfer-power',
    description: 'Moves an affected asset or feeder to its redundant supply.',
    output: 'Redundant supply online and electrical readings stable.',
  },
  tool_06_resequence_berth: {
    number: '06', name: 'Resequence berth window', endpoint: 'POST /tools/resequence-berth',
    description: 'Updates vessel and berth allocation around an ETA conflict.',
    output: 'Berth window resequenced with no downstream overlap.',
  },
  tool_07_update_tugs: {
    number: '07', name: 'Update tug allocation', endpoint: 'POST /tools/update-tugs',
    description: 'Reserves tug capacity against the revised arrival window.',
    output: 'Replacement tug window confirmed.',
  },
  tool_08_open_overflow: {
    number: '08', name: 'Open overflow block', endpoint: 'POST /tools/open-overflow-stack',
    description: 'Allocates compatible spare yard capacity.',
    output: 'Overflow slots reserved and accepting moves.',
  },
  tool_09_rebalance_resources: {
    number: '09', name: 'Rebalance work queues', endpoint: 'POST /tools/rebalance-resources',
    description: 'Redistributes crane, RTG, and internal truck work.',
    output: 'Resource plan rebalanced and queues republished.',
  },
  tool_10_inspection: {
    number: '10', name: 'Dispatch cargo inspection', endpoint: 'POST /tools/dispatch-inspection',
    description: 'Sends the appropriate cargo and dangerous-goods team.',
    output: 'Controlled inspection request accepted.',
  },
  tool_11_monitor_reefer: {
    number: '11', name: 'Start reefer watch', endpoint: 'POST /tools/monitor-reefers',
    description: 'Starts enhanced temperature monitoring after power recovery.',
    output: 'Five-minute reefer telemetry watch active.',
  },
  tool_12_manual_gate: {
    number: '12', name: 'Enable assisted gate mode', endpoint: 'POST /tools/enable-assisted-gate',
    description: 'Routes failed OCR reads to assisted validation.',
    output: 'Affected lanes operating in assisted validation mode.',
  },
}

const activitySubscribers = new Set()
const latestActivityByTool = new Map()

function broadcastToolActivity(activity) {
  for (const subscriber of activitySubscribers) subscriber(activity)
}

function publishToolActivity(activity) {
  latestActivityByTool.set(activity.id, activity)
  broadcastToolActivity(activity)
}

export function subscribeToolActivity(subscriber) {
  activitySubscribers.add(subscriber)
  return () => activitySubscribers.delete(subscriber)
}

export function currentToolActivity() {
  return [...latestActivityByTool.values()]
}

export function resetToolActivity(reason = 'manual') {
  latestActivityByTool.clear()
  const reset = { type: 'reset', reason, resetAt: new Date().toISOString() }
  broadcastToolActivity(reset)
  return reset
}

export async function invokeOperationalTool(id, { source = 'external', context = null } = {}) {
  const tool = toolCatalog[id]
  if (!tool) {
    const error = new Error('Unknown operational tool endpoint.')
    error.status = 404
    throw error
  }

  const invocationId = randomUUID()
  const startedAt = new Date().toISOString()
  publishToolActivity({ invocationId, id, number: tool.number, name: tool.name, endpoint: tool.endpoint, source, context, status: 'invoking', startedAt })
  await new Promise((resolve) => setTimeout(resolve, 650))
  const execution = { invocationId, id, ...tool, source, context, status: 'completed', startedAt, invokedAt: new Date().toISOString() }
  publishToolActivity(execution)
  return execution
}

export function publicToolCatalog() {
  return Object.entries(toolCatalog).map(([id, tool]) => ({ id, ...tool, output: undefined }))
}

export async function executeToolPlan(event, proposedToolIds) {
  const required = [...event.requiredToolIds].sort()
  const proposed = [...new Set(proposedToolIds)].sort()
  const matches = required.length === proposed.length && required.every((id, index) => id === proposed[index])

  if (!matches) {
    return {
      resolved: false,
      executions: proposed.map((id) => ({ id, ...toolCatalog[id], status: 'rejected', output: 'Safety validator rejected this tool combination; no endpoint was invoked.' })),
    }
  }

  const executions = await Promise.all(event.requiredToolIds.map((id) => invokeOperationalTool(id, {
    source: 'agent',
    context: { affectedAsset: event.object?.label || 'Port incident', incident: event.label },
  })))
  return { resolved: executions.length === event.requiredToolIds.length, executions }
}
