const baseUrl = (process.argv[2] || process.env.TOOL_API_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '')

async function readJson(response) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) throw new Error(`Expected JSON from ${response.url}. Restart npm run dev so the current backend is running.`)
  return response.json()
}

const catalogResponse = await fetch(`${baseUrl}/api/playbook`)
if (!catalogResponse.ok) throw new Error(`Could not load the tool catalog (${catalogResponse.status}).`)
const catalog = await readJson(catalogResponse)

console.log(`Calling ${catalog.tools.length} operational endpoints at ${baseUrl}`)
for (const tool of catalog.tools) {
  const route = tool.endpoint.replace(/^POST\s+/, '')
  process.stdout.write(`Tool ${tool.number} ${route} ... `)
  const response = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved: true, context: { purpose: 'live endpoint lighting demo' } }),
  })
  const payload = await readJson(response)
  if (!response.ok) throw new Error(payload.error || `Tool ${tool.number} failed with ${response.status}.`)
  console.log(`${payload.execution.status} at ${payload.execution.invokedAt}`)
}
console.log('All operational endpoints completed. Check the live activity board and audit timeline.')
