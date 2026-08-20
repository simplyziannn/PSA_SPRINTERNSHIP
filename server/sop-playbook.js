import { readFileSync } from 'node:fs'

const playbookText = readFileSync(new URL('../docs/PSA-SOP-PLAYBOOK.md', import.meta.url), 'utf8')

function tokenize(value) {
  return new Set(value.toLowerCase().match(/[a-z0-9_]+/g) || [])
}

const chunks = playbookText
  .split(/\n(?=## SOP-)/)
  .filter((chunk) => chunk.startsWith('## SOP-'))
  .map((chunk) => {
    const [heading, ...body] = chunk.trim().split('\n')
    const id = heading.match(/SOP-\d+/)?.[0] || 'SOP'
    const title = heading.replace(/^##\s*/, '')
    return { id, title, content: body.join('\n').trim(), tokens: tokenize(chunk) }
  })

function publicChunk(chunk) {
  const triggers = chunk.content.match(/Triggers:\s*([^\n]+)/)?.[1] || ''
  const toolIds = [...chunk.content.matchAll(/`(tool_\d+_[a-z_]+)`/g)].map((match) => match[1])
  return {
    id: chunk.id,
    title: chunk.title.replace(`${chunk.id} `, ''),
    triggers: triggers.split(',').map((trigger) => trigger.trim()).filter(Boolean),
    toolIds: [...new Set(toolIds)],
    content: chunk.content,
  }
}

export function searchSopPlaybook(query, limit = 2) {
  const queryTokens = tokenize(query)
  const ranked = chunks
    .map((chunk) => {
      let score = 0
      for (const token of queryTokens) {
        if (chunk.tokens.has(token)) score += token.startsWith('tool_') ? 5 : token.length > 5 ? 3 : 1
      }
      return { ...chunk, score }
    })
    .sort((a, b) => b.score - a.score)

  const relevanceFloor = Math.max(1, ranked[0]?.score * 0.55)
  return ranked
    .filter((chunk) => chunk.score >= relevanceFloor)
    .slice(0, Math.max(1, Math.min(limit, 3)))
    .map(({ tokens, ...chunk }) => chunk)
}

export function getPlaybookStatus() {
  return { document: 'PSA-SOP-PLAYBOOK.md', chunks: chunks.length, mode: 'local lexical RAG' }
}

export function getPlaybookEntries() {
  return chunks.map(publicChunk)
}
