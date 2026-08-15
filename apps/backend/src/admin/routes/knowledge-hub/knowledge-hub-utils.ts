export type KnowledgeDocumentIdentity = {
  citation_locator: string
  document_key: string
  owner_id: string
  scope: string
}

export type KnowledgeSourceIdentity = {
  id: string
  last_document_id: string | null
}

export function isKnowledgeVerificationArtifact(
  document: KnowledgeDocumentIdentity
) {
  return Boolean(
    document.owner_id.endsWith("-verifier") ||
      document.document_key.startsWith("verify-") ||
      document.scope.endsWith("_verification") ||
      /(?:^|\/)verification(?:\/|$)/iu.test(document.citation_locator)
  )
}

export function findKnowledgeDocumentSource<
  TSource extends KnowledgeSourceIdentity,
>(
  document: Pick<KnowledgeDocumentIdentity, "document_key"> & { id: string },
  sources: TSource[]
) {
  return sources.find(
    (source) =>
      source.last_document_id === document.id ||
      document.document_key === `source-${source.id}`
  )
}
