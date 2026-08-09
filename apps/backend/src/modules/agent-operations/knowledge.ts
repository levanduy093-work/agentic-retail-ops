import { createHash } from "node:crypto"

export type KnowledgeDocumentLike = {
  approved_at?: Date | string | null
  citation_locator: string
  content: string
  effective_at: Date | string
  expires_at?: Date | string | null
  status: string
}

export function checksumKnowledgeContent(content: string) {
  return createHash("sha256").update(content.trim(), "utf8").digest("hex")
}

export function isKnowledgeEligible(
  document: KnowledgeDocumentLike,
  now = new Date()
) {
  const effectiveAt = new Date(document.effective_at)
  const expiresAt = document.expires_at
    ? new Date(document.expires_at)
    : null

  return Boolean(
    document.status === "APPROVED" &&
      document.approved_at &&
      document.citation_locator.trim() &&
      effectiveAt <= now &&
      (!expiresAt || expiresAt > now)
  )
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
