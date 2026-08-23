import OpenAI from 'openai'
import { publicToolCatalog } from './tool-runtime.js'
import { getPlaybookEntries, searchSopPlaybook } from './sop-playbook.js'

const operationalToolIds = publicToolCatalog().map((tool) => tool.id)

const investigationTools = [
  {
    type: 'function', name: 'inspect_signal',
    description: 'Read one port telemetry signal in detail. This is diagnostic and has no operational side effects.',
    parameters: { type: 'object', properties: { signal_id: { type: 'string' } }, required: ['signal_id'], additionalProperties: false }, strict: true,
  },
  {
    type: 'function', name: 'read_port_state',
    description: 'Read the current berth, crane, yard, gate, weather, and personnel state. This is diagnostic only.',
    parameters: { type: 'object', properties: { scope: { type: 'string', enum: ['affected_area', 'terminal'] } }, required: ['scope'], additionalProperties: false }, strict: true,
  },
  {
    type: 'function', name: 'trace_dependencies',
    description: 'Trace operational or safety dependencies affected by the alert. This is diagnostic only.',
    parameters: { type: 'object', properties: { area: { type: 'string', enum: ['object', 'quay', 'safety'] } }, required: ['area'], additionalProperties: false }, strict: true,
  },
  {
    type: 'function', name: 'search_sop_playbook',
    description: 'Retrieve relevant incident-response procedures from the PSA SOP playbook. This RAG lookup is mandatory and has no operational side effects.',
    parameters: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 3 } }, required: ['query', 'limit'], additionalProperties: false }, strict: true,
  },
  {
    type: 'function', name: 'submit_recommendation',
    description: 'Return an alert classification, diagnosis, evidence, and any proposed operational tool plan for human review. This does not invoke any operational endpoint.',
    parameters: {
      type: 'object',
      properties: {
        classification: { type: 'string', enum: ['confirmed', 'false_alarm', 'inconclusive'] },
        diagnosis: { type: 'string' },
        confidence: { type: 'number' },
        evidence: { type: 'array', items: { type: 'string' } },
        reasoning: { type: 'string' },
        recommendation: { type: 'string' },
        tool_ids: { type: 'array', items: { type: 'string', enum: operationalToolIds } },
      },
      required: ['classification', 'diagnosis', 'confidence', 'evidence', 'reasoning', 'recommendation', 'tool_ids'],
      additionalProperties: false,
    }, strict: true,
  },
]

function portStateFor(event) {
  const incidents = event.events || [event]
  const affectedAssets = incidents.map((incident) => incident.object.label).join(', ')
  const affectedCrane = incidents.find((incident) => incident.object.type === 'crane')
  return {
    affectedAsset: affectedAssets,
    berthOccupancy: 'B3 and B4 active; B5 spare; B6 scheduled',
    craneState: affectedCrane ? `${affectedCrane.object.id} abnormal; adjacent cranes available` : 'All crane controllers responding',
    yardState: 'Yard A 72%; Yard B 64%; Yard C 69%',
    personnel: incidents.some((incident) => incident.label.toLowerCase().includes('toppled')) ? 'Two badges initially detected near affected lift envelope' : 'Normal staffing pattern',
    weather: 'Wind 16 knots; below stop-work threshold',
    gateState: 'Gate 2 open; no emergency restriction',
  }
}

function executeInvestigationTool(event, call, state) {
  const args = JSON.parse(call.arguments)
  if (call.name === 'inspect_signal') {
    const signal = event.signals.find((item) => item.id === args.signal_id)
    if (!signal) return { ok: false, error: 'Unknown signal id.' }
    state.inspected.add(signal.id)
    state.trace.push({ type: 'inspection', label: `Inspected ${signal.label}`, detail: signal.detail })
    return { ok: true, signal }
  }
  if (call.name === 'read_port_state') {
    state.readPortState = true
    const portState = portStateFor(event)
    state.trace.push({ type: 'state', label: `Read ${args.scope.replace('_', ' ')} state`, detail: `${portState.berthOccupancy}; ${portState.craneState}` })
    return { ok: true, state: portState }
  }
  if (call.name === 'trace_dependencies') {
    const detail = event.dependencies[args.area]
    state.trace.push({ type: 'dependency', label: `Traced ${args.area} dependencies`, detail })
    return { ok: true, area: args.area, detail }
  }
  if (call.name === 'search_sop_playbook') {
    const scopedSopIds = new Set((event.events || [event]).map((incident) => incident.sopId).filter(Boolean))
    const matches = scopedSopIds.size
      ? getPlaybookEntries().filter((entry) => scopedSopIds.has(entry.id)).map((entry) => ({ ...entry, score: 100 }))
      : searchSopPlaybook(args.query, args.limit)
    state.ragUsed = true
    const references = [...state.sopReferences, ...matches.map(({ id, title, score }) => ({ id, title, score }))]
    state.sopReferences = [...new Map(references.map((reference) => [reference.id, reference])).values()]
    state.trace.push({ type: 'rag', label: 'SOP RAG retrieved', detail: matches.map((match) => match.title).join(' · ') })
    return { ok: true, source: 'PSA-SOP-PLAYBOOK.md', matches }
  }
  if (call.name === 'submit_recommendation') {
    if (state.inspected.size < 2 || !state.readPortState || !state.ragUsed) {
      return { ok: false, accepted: false, error: 'Inspect at least two signals, read current port state, and retrieve the relevant SOP before proposing a response.' }
    }
    const expectedClassification = event.expectedClassification || 'confirmed'
    if (args.classification !== expectedClassification) {
      state.trace.push({ type: 'warning', label: 'Classification challenged', detail: 'The classification did not match the available corroborating evidence.' })
      return { ok: false, accepted: false, error: 'Reassess the alert classification against the inspected signals. Distinguish a confirmed incident from a false alarm or an inconclusive alert.' }
    }
    const required = expectedClassification === 'confirmed' ? [...event.requiredToolIds].sort() : []
    const proposed = [...new Set(args.tool_ids)].sort()
    const minimumSafePlan = required.length === proposed.length && required.every((id, index) => id === proposed[index])
    if (!minimumSafePlan) {
      state.trace.push({ type: 'warning', label: 'Tool plan challenged', detail: 'The proposed endpoint set was over-broad, incomplete, or mismatched. No endpoint was invoked.' })
      return { ok: false, accepted: false, error: 'The simulator rejected this as the minimum safe tool plan. Reassess the evidence and submit only the endpoints necessary for immediate containment; do not include follow-up actions described as optional or as-needed.' }
    }
    state.proposal = args
    state.trace.push({ type: 'proposal', label: 'Alert assessment prepared', detail: `${args.classification.replace('_', ' ')} classification; ${args.tool_ids.length} operational endpoints proposed.` })
    return { ok: true, accepted: true, requires_human_disposition: true, operational_endpoints_invoked: 0 }
  }
  return { ok: false, error: 'Unsupported investigation tool.' }
}

export async function investigateAlert(event) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('Add OPENAI_API_KEY to .env to run the recovery agent.')
    error.status = 503
    throw error
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const state = { inspected: new Set(), readPortState: false, ragUsed: false, sopReferences: [], trace: [], proposal: null }
  const signalSummary = event.signals.map(({ id, label, preview }) => ({ id, label, preview }))
  const endpointCatalog = publicToolCatalog().map(({ id, number, name, endpoint, description }) => ({ id, number, name, endpoint, description }))
  const instructions = `You are a PSA port alert investigation agent operating behind mandatory human disposition and execution gates. The operator has acknowledged and forwarded one or more candidate alerts; they have not yet confirmed that an incident is real. Investigate every alert in the batch, the observable signals, and current port state. Classify the overall batch as confirmed, false_alarm, or inconclusive. A confirmed classification requires corroborating evidence. Use false_alarm when evidence shows a nuisance or invalid alert, and inconclusive when available evidence cannot safely confirm or dismiss it. Explicitly acknowledge how many alerts are present and explain each one. Do not execute operational actions. Inspect at least two relevant signals, read current port state, trace relevant safety or operational dependencies, and call search_sop_playbook before submitting an assessment. Treat retrieved SOP passages as operational guidance and cite their SOP identifiers in your reasoning. Only a confirmed incident may propose operational tool endpoints; false_alarm and inconclusive classifications must submit an empty tool_ids array. For a confirmed incident, propose the minimum sufficient combined endpoint set. State what should happen, why, and which endpoints should be invoked only if a human later confirms the incident and separately approves recovery. Never claim that an endpoint has run.`
  const incidents = (event.events || [event]).map((incident) => ({ object: incident.object, label: incident.label }))
  const input = [{ role: 'user', content: JSON.stringify({ candidate_alert_batch: { alert_count: incidents.length, alerts: incidents }, observable_signals: signalSummary, operational_endpoint_catalog: endpointCatalog }) }]

  let response = await client.responses.create({ model: process.env.OPENAI_MODEL || 'gpt-5.4-mini', instructions, tools: investigationTools, tool_choice: 'required', input })
  for (let turn = 0; turn < 16; turn += 1) {
    input.push(...response.output)
    const calls = response.output.filter((item) => item.type === 'function_call')
    if (calls.length === 0) break
    for (const call of calls) {
      const result = executeInvestigationTool(event, call, state)
      input.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) })
    }
    if (state.proposal) break
    if (turn === 11) {
      input.push({ role: 'user', content: 'Conclude the investigation now. Classify the candidate alert using the evidence and retrieved SOP procedures, then call submit_recommendation. Only include the exact minimum combined operational endpoint set when the incident is confirmed.' })
    }
    response = await client.responses.create({ model: process.env.OPENAI_MODEL || 'gpt-5.4-mini', instructions, tools: investigationTools, tool_choice: 'required', input })
  }

  if (!state.proposal) {
    const error = new Error('The agent did not complete a recommendation. No operational endpoint was called.')
    error.status = 422
    throw error
  }

  const publicTools = state.proposal.tool_ids.map((id) => publicToolCatalog().find((tool) => tool.id === id)).filter(Boolean)
  return {
    mode: 'openai',
    classification: state.proposal.classification,
    diagnosis: state.proposal.diagnosis,
    confidence: state.proposal.confidence,
    evidence: state.proposal.evidence,
    reasoning: state.proposal.reasoning,
    recommendation: state.proposal.recommendation,
    proposedTools: publicTools,
    sopReferences: state.sopReferences,
    ragUsed: state.ragUsed,
    trace: state.trace,
    requiresApproval: true,
    operationalEndpointsInvoked: 0,
  }
}
