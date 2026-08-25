import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { investigateAlert } from './agent.js'
import { buildEvent } from './events.js'
import { currentToolActivity, executeToolPlan, invokeOperationalTool, publicToolCatalog, subscribeToolActivity } from './tool-runtime.js'
import { getPlaybookEntries, getPlaybookStatus } from './sop-playbook.js'

const app = express()
const port = Number(process.env.API_PORT || 8787)
const host = process.env.API_HOST || '127.0.0.1'
const here = path.dirname(fileURLToPath(import.meta.url))
const pendingProposals = new Map()

app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, agentMode: process.env.OPENAI_API_KEY ? 'openai' : 'demo', model: process.env.OPENAI_MODEL || 'gpt-5.4-mini' })
})

app.get('/api/playbook/status', (_request, response) => {
  response.json({ ok: true, ...getPlaybookStatus() })
})

app.get('/api/playbook', (_request, response) => {
  response.json({ ok: true, entries: getPlaybookEntries(), tools: publicToolCatalog() })
})

app.get('/api/tools/activity', (_request, response) => {
  response.json({ ok: true, activities: currentToolActivity() })
})

app.get('/api/tool-events', (request, response) => {
  response.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  response.flushHeaders()
  response.write(`event: snapshot\ndata: ${JSON.stringify(currentToolActivity())}\n\n`)
  const unsubscribe = subscribeToolActivity((activity) => {
    response.write(`event: tool-activity\ndata: ${JSON.stringify(activity)}\n\n`)
  })
  const heartbeat = setInterval(() => response.write(': keep-alive\n\n'), 15000)
  request.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
  })
})

for (const tool of publicToolCatalog()) {
  const route = tool.endpoint.replace(/^POST\s+/, '')
  app.post(route, async (request, response) => {
    if (request.body?.approved !== true) {
      return response.status(400).json({ error: 'Explicit approved: true is required for a direct operational tool call.' })
    }
    try {
      const execution = await invokeOperationalTool(tool.id, { source: 'external', context: request.body?.context || null })
      return response.json({ ok: true, execution })
    } catch (error) {
      return response.status(error?.status || 500).json({ error: error?.message || 'Operational tool call failed.' })
    }
  })
}

app.post('/api/agent/investigate', async (request, response) => {
  const requestedIncidents = Array.isArray(request.body?.incidents)
    ? request.body.incidents
    : [{ object: request.body?.object, action: request.body?.action }]
  if (requestedIncidents.length === 0 || requestedIncidents.some(({ object, action }) => !object?.type || !object?.id || !object?.label || typeof action !== 'string')) {
    return response.status(400).json({ error: 'At least one valid port object and event action are required.' })
  }
  const events = requestedIncidents.map(({ object, action }) => buildEvent(object, action))
  if (events.some((event) => !event)) return response.status(400).json({ error: 'Unsupported simulator event.' })
  const batchClassification = events.some((event) => event.expectedClassification === 'confirmed')
    ? 'confirmed'
    : events.some((event) => event.expectedClassification === 'inconclusive') ? 'inconclusive' : 'false_alarm'
  const event = events.length === 1 ? events[0] : {
    label: `${events.length} concurrent port incidents`,
    object: { type: 'batch', id: `batch-${events.length}`, label: `${events.length} affected port assets` },
    events,
    expectedClassification: batchClassification,
    requiredToolIds: [...new Set(events.flatMap((item) => item.requiredToolIds))],
    signals: events.flatMap((item, eventIndex) => item.signals.map((signal) => ({
      ...signal,
      id: `incident_${eventIndex + 1}_${signal.id}`,
      label: `${item.object.label} · ${signal.label}`,
    }))),
    dependencies: {
      object: events.map((item) => item.dependencies.object).join(' '),
      quay: events.map((item) => item.dependencies.quay).join(' '),
      safety: events.map((item) => item.dependencies.safety).join(' '),
    },
    outcomeMetrics: null,
  }
  try {
    const result = await investigateAlert(event)
    const proposalId = randomUUID()
    pendingProposals.set(proposalId, { event, result, disposition: null, createdAt: Date.now() })
    return response.json({ proposalId, event: { label: event.label, incidents: events.map((item) => ({ label: item.label, affectedObject: item.object })), signals: event.signals.map(({ id, label, preview }) => ({ id, label, preview })) }, ...result })
  } catch (error) {
    console.error('Agent request failed:', error)
    return response.status(error?.status || 500).json({ error: error?.message || 'The agent request failed.' })
  }
})

app.post('/api/agent/disposition', (request, response) => {
  const { proposalId, disposition } = request.body || {}
  if (!['confirmed', 'false_alarm', 'inconclusive'].includes(disposition)) {
    return response.status(400).json({ error: 'Disposition must be confirmed, false_alarm, or inconclusive.' })
  }
  const pending = pendingProposals.get(proposalId)
  if (!pending) return response.status(404).json({ error: 'The alert assessment was not found or has expired.' })

  pending.disposition = disposition
  pending.dispositionAt = new Date().toISOString()
  const recoveryReady = disposition === 'confirmed' && pending.result.proposedTools.length > 0
  if (disposition !== 'confirmed' || !recoveryReady) pendingProposals.delete(proposalId)
  return response.json({
    ok: true,
    disposition,
    recoveryReady,
    requiresFurtherInspection: disposition === 'inconclusive' || (disposition === 'confirmed' && !recoveryReady),
    operationalEndpointsInvoked: 0,
  })
})

app.post('/api/agent/execute', async (request, response) => {
  const { proposalId, approved } = request.body || {}
  if (!approved) return response.status(400).json({ error: 'Explicit human approval is required before operational tools can run.' })
  const pending = pendingProposals.get(proposalId)
  if (!pending) return response.status(404).json({ error: 'The approved proposal was not found or has expired.' })
  if (pending.disposition !== 'confirmed') return response.status(409).json({ error: 'A human must confirm the incident before recovery can be approved.' })
  if (pending.result.classification !== 'confirmed' || pending.result.proposedTools.length === 0) {
    return response.status(409).json({ error: 'The confirmed incident does not have an executable recovery plan. Request further investigation.' })
  }

  try {
    const toolIds = pending.result.proposedTools.map((tool) => tool.id)
    const execution = await executeToolPlan(pending.event, toolIds)
    pendingProposals.delete(proposalId)
    return response.json({
      ...execution,
      diagnosis: pending.result.diagnosis,
      recommendation: pending.result.recommendation,
      metrics: execution.resolved ? pending.event.outcomeMetrics : null,
      approvedAt: new Date().toISOString(),
    })
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'Approved tool execution failed.' })
  }
})

app.use(express.static(path.join(here, '..', 'dist')))
app.get('*path', (_request, response) => response.sendFile(path.join(here, '..', 'dist', 'index.html')))

app.listen(port, host, () => {
  console.log(`PSA agent API listening on http://${host}:${port}`)
})
