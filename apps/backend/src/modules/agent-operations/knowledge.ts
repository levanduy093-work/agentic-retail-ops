import { createHash } from "node:crypto"

export type KnowledgeDocumentLike = {
  approved_at?: Date | string | null
  citation_locator: string
  content: string
  effective_at: Date | string
  expires_at?: Date | string | null
  status: string
}

export type KnowledgeChunk = {
  checksum: string
  chunk_index: number
  citation_locator: string
  content: string
  word_count: number
}

const DEFAULT_MAX_CHUNK_CHARACTERS = 1_200
const DEFAULT_OVERLAP_CHARACTERS = 160

export function checksumKnowledgeContent(content: string) {
  return createHash("sha256").update(content.trim(), "utf8").digest("hex")
}

function findChunkBoundary(content: string, start: number, desiredEnd: number) {
  if (desiredEnd >= content.length) return content.length

  const minimumEnd = start + Math.floor((desiredEnd - start) * 0.6)
  const candidates = ["\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " "]

  for (const separator of candidates) {
    const index = content.lastIndexOf(separator, desiredEnd)
    if (index >= minimumEnd) return index + separator.length
  }

  return desiredEnd
}

export function chunkKnowledgeContent(
  content: string,
  citationLocator: string,
  options: { max_characters?: number; overlap_characters?: number } = {}
): KnowledgeChunk[] {
  const normalized = content.replace(/\r\n/g, "\n").trim()
  if (!normalized) return []

  const maxCharacters = Math.max(
    300,
    options.max_characters ?? DEFAULT_MAX_CHUNK_CHARACTERS
  )
  const overlapCharacters = Math.min(
    Math.max(0, options.overlap_characters ?? DEFAULT_OVERLAP_CHARACTERS),
    Math.floor(maxCharacters / 3)
  )
  const chunks: KnowledgeChunk[] = []
  let start = 0

  while (start < normalized.length) {
    const end = findChunkBoundary(
      normalized,
      start,
      Math.min(start + maxCharacters, normalized.length)
    )
    const chunk = normalized.slice(start, end).trim()

    if (chunk) {
      const chunkIndex = chunks.length
      chunks.push({
        checksum: checksumKnowledgeContent(chunk),
        chunk_index: chunkIndex,
        citation_locator: `${citationLocator}#chunk-${chunkIndex + 1}`,
        content: chunk,
        word_count: chunk.split(/\s+/).filter(Boolean).length,
      })
    }

    if (end >= normalized.length) break
    const nextStart = Math.max(start + 1, end - overlapCharacters)
    const nextBoundary = normalized.indexOf(" ", nextStart)
    start =
      nextBoundary !== -1 && nextBoundary < end ? nextBoundary + 1 : nextStart
  }

  return chunks
}

export function isKnowledgeEligible(
  document: KnowledgeDocumentLike,
  now = new Date()
) {
  const effectiveAt = new Date(document.effective_at)
  const expiresAt = document.expires_at ? new Date(document.expires_at) : null

  return Boolean(
    document.status === "APPROVED" &&
    document.approved_at &&
    document.citation_locator.trim() &&
    effectiveAt <= now &&
    (!expiresAt || expiresAt > now)
  )
}

export function isKnowledgeReadyForVectorPreparation(
  document: KnowledgeDocumentLike,
  now = new Date()
) {
  return document.status === "DRAFT" || isKnowledgeEligible(document, now)
}

export function buildKnowledgeCitation(document: KnowledgeDocumentLike) {
  if (!isKnowledgeEligible(document)) {
    return null
  }

  return {
    locator: document.citation_locator,
    quote_checksum: checksumKnowledgeContent(document.content),
  }
}
