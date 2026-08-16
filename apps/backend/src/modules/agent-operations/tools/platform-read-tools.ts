import { z } from "@medusajs/framework/zod"
import {
  buildKnowledgeCitation,
  checksumKnowledgeContent,
  isKnowledgeEligible,
} from "../knowledge"
import { defineAgentTool } from "../tool-contract"

const JsonRecord = z.record(z.string(), z.unknown())

export const KnowledgeSearchInput = z.strictObject({
  limit: z.number().int().min(1).max(20).default(5),
  locale: z.string().min(2).optional(),
  query: z.string().trim().min(2).max(500),
  scope: z.string().min(1).optional(),
  tenant_id: z.string().min(1).default("default"),
})

export const KnowledgeSearchResult = z.strictObject({
  citation_locator: z.string().min(1),
  chunk_id: z.string().min(1).optional(),
  chunk_index: z.number().int().nonnegative().optional(),
  document_id: z.string().min(1),
  document_key: z.string().min(1),
  effective_at: z.string().datetime(),
  excerpt: z.string(),
  quote_checksum: z.string().min(1),
  score: z.number().nonnegative(),
  title: z.string().min(1),
  version: z.string().min(1),
})

export const KnowledgeSearchOutput = z.strictObject({
  results: z.array(KnowledgeSearchResult),
  total_candidates: z.number().int().nonnegative(),
})

export const AuditSearchInput = z
  .strictObject({
    actor_id: z.string().min(1).optional(),
    correlation_id: z.string().min(1).optional(),
    event_type: z.string().min(1).optional(),
    incident_id: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(50),
    resource_id: z.string().min(1).optional(),
    resource_type: z.string().min(1).optional(),
  })
  .refine(
    (input) =>
      Boolean(
        input.actor_id ||
          input.correlation_id ||
          input.event_type ||
          input.incident_id ||
          input.resource_id ||
          input.resource_type
      ),
    { message: "At least one audit filter is required." }
  )

export const AuditEventResult = z.strictObject({
  action: z.string().min(1),
  actor_id: z.string().min(1),
  actor_type: z.string().min(1),
  correlation_id: z.string().min(1),
  data: JsonRecord.nullable(),
  event_id: z.string().min(1),
  event_type: z.string().min(1),
  incident_id: z.string().nullable(),
  recorded_at: z.string().datetime(),
  resource_id: z.string().min(1),
  resource_type: z.string().min(1),
})

export const AuditSearchOutput = z.strictObject({
  events: z.array(AuditEventResult),
  returned_count: z.number().int().nonnegative(),
})

export const TraceReplayInput = z
  .strictObject({
    correlation_id: z.string().min(1).optional(),
    incident_id: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(500).default(200),
  })
  .refine(
    (input) => Boolean(input.correlation_id) !== Boolean(input.incident_id),
    { message: "Provide exactly one of correlation_id or incident_id." }
  )

export const TraceTimelineEntry = z.strictObject({
  category: z.enum([
    "ACTION",
    "AUDIT",
    "EVENT",
    "OUTBOX",
    "RUN",
    "TOOL_CALL",
  ]),
  data: JsonRecord.nullable(),
  entry_id: z.string().min(1),
  name: z.string().min(1),
  occurred_at: z.string().datetime(),
  status: z.string().nullable(),
})

export const TraceReplayOutput = z.strictObject({
  correlation_id: z.string().nullable(),
  incident_ids: z.array(z.string().min(1)),
  returned_count: z.number().int().nonnegative(),
  timeline: z.array(TraceTimelineEntry),
  truncated: z.boolean(),
})

export type KnowledgeSearchInput = z.infer<typeof KnowledgeSearchInput>
export type KnowledgeSearchOutput = z.infer<typeof KnowledgeSearchOutput>
export type AuditSearchInput = z.infer<typeof AuditSearchInput>
export type AuditSearchOutput = z.infer<typeof AuditSearchOutput>
export type TraceReplayInput = z.infer<typeof TraceReplayInput>
export type TraceReplayOutput = z.infer<typeof TraceReplayOutput>
export type TraceTimelineEntry = z.infer<typeof TraceTimelineEntry>

export type KnowledgeDocumentSearchSource = {
  approved_at?: Date | string | null
  citation_locator: string
  content: string
  document_key: string
  effective_at: Date | string
  expires_at?: Date | string | null
  id: string
  status: string
  title: string
  version: string
}

export type KnowledgeChunkSearchSource = {
  checksum: string
  chunk_index: number
  citation_locator: string
  content: string
  document_id: string
  id: string
}

export type AuditEventSearchSource = {
  action: string
  actor_id: string
  actor_type: string
  correlation_id: string
  data?: Record<string, unknown> | null
  event_type: string
  id: string
  incident_id?: string | null
  recorded_at: Date | string
  resource_id: string
  resource_type: string
}

export const KNOWLEDGE_SEARCH_TOOL = defineAgentTool({
  approval_required: false,
  audit_fields: [
    "query",
    "tenant_id",
    "scope",
    "locale",
    "document_id",
    "citation_locator",
    "quote_checksum",
  ],
  description: "Search currently effective, approved knowledge with citations.",
  error_codes: ["INVALID_TOOL_INPUT", "KNOWLEDGE_READ_FAILED"],
  idempotency: "NOT_REQUIRED",
  input_schema: KnowledgeSearchInput,
  kind: "READ",
  name: "knowledge.search",
  output_schema: KnowledgeSearchOutput,
  permission: "agent_knowledge:read",
  required_role: null,
  retry: {
    backoff: "EXPONENTIAL",
    base_delay_ms: 250,
    max_attempts: 2,
    max_delay_ms: 1_000,
  },
  risk_level: "READ_ONLY",
  timeout_ms: 5_000,
  version: "1.0.0",
})

export const AUDIT_SEARCH_TOOL = defineAgentTool({
  approval_required: false,
  audit_fields: [
    "correlation_id",
    "incident_id",
    "event_type",
    "resource_type",
    "resource_id",
    "actor_id",
  ],
  description: "Search immutable agent audit events using bounded filters.",
  error_codes: ["AUDIT_READ_FAILED", "INVALID_TOOL_INPUT"],
  idempotency: "NOT_REQUIRED",
  input_schema: AuditSearchInput,
  kind: "READ",
  name: "audit.search",
  output_schema: AuditSearchOutput,
  permission: "agent_audit:read",
  required_role: "operations_manager",
  retry: {
    backoff: "EXPONENTIAL",
    base_delay_ms: 250,
    max_attempts: 2,
    max_delay_ms: 1_000,
  },
  risk_level: "READ_ONLY",
  timeout_ms: 5_000,
  version: "1.0.0",
})

export const TRACE_REPLAY_TOOL = defineAgentTool({
  approval_required: false,
  audit_fields: ["correlation_id", "incident_id", "returned_count"],
  description:
    "Reconstruct an ordered execution timeline from agent operational records.",
  error_codes: ["INVALID_TOOL_INPUT", "TRACE_READ_FAILED"],
  idempotency: "NOT_REQUIRED",
  input_schema: TraceReplayInput,
  kind: "READ",
  name: "trace.replay",
  output_schema: TraceReplayOutput,
  permission: "agent_audit:read",
  required_role: "operations_manager",
  retry: {
    backoff: "EXPONENTIAL",
    base_delay_ms: 250,
    max_attempts: 2,
    max_delay_ms: 1_000,
  },
  risk_level: "READ_ONLY",
  timeout_ms: 10_000,
  version: "1.0.0",
})

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/giu, "d")
    .toLocaleLowerCase("vi")
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
}

function extractNgrams(tokens: string[], n: number) {
  const ngrams: string[] = []
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(" "))
  }
  return ngrams
}

const retailTopicKeywords: Record<string, string[]> = {
  delivery: [
    "giao hang",
    "van chuyen",
    "phi giao",
    "phi van chuyen",
    "thoi gian giao",
    "thoi gian van chuyen",
    "shipping",
    "delivery",
  ],
  order_status: [
    "tra cuu don",
    "kiem tra don",
    "trang thai don",
    "don cua toi",
    "theo doi don",
    "tracking",
    "ma don",
  ],
  payment: [
    "thanh toan",
    "chuyen khoan",
    "banking",
    "cod",
    "tien mat",
    "the tin dung",
    "vietqr",
    "visa",
    "mastercard",
    "xuat hoa don",
    "hoa don vat",
  ],
  return: [
    "doi tra",
    "tra hang",
    "hoan tien",
    "doi size",
    "doi mau",
    "hang loi",
    "bi loi",
    "loi nsx",
    "loi nha san xuat",
    "phi ship doi tra",
    "phi ship hang loi",
    "phi doi tra",
    "phi tra hang",
    "loi rach",
    "bi rach",
    "bi hong",
    "hang rach",
    "hang hong",
    "tra tien",
    "refund",
    "return",
  ],
  warranty: ["bao hanh", "bao tri", "sua chua", "warranty"],
  promotion: [
    "khuyen mai",
    "tich diem",
    "thanh vien",
    "voucher",
    "giam gia",
    "uu dai",
    "ma giam gia",
    "chiet khau",
    "qua tang",
    "sinh nhat",
    "hang thanh vien",
  ],
  escalation: [
    "khiếu nại",
    "khieu nai",
    "phan nan",
    "thai do",
    "giong dieu",
    "escalation",
    "gap quan ly",
    "tong dai",
    "cskh",
    "xu ly khieu nai",
  ],
  store_profile: [
    "gio mo cua",
    "gio lam viec",
    "dia chi",
    "hotline",
    "ho so cua hang",
    "lien he",
    "shop mo cua",
    "tu may gio",
  ],
  size_guide: [
    "chon size",
    "bang size",
    "tu van size",
    "size ao",
    "size quan",
    "chieu cao",
    "can nang",
    "cach chon size",
  ],
  privacy: [
    "bao mat",
    "quyen rieng tu",
    "du lieu",
    "thong tin ca nhan",
    "bao mat du lieu",
  ],
}

function detectTextTopics(text: string): Set<string> {
  const normalized = ` ${normalizeSearchText(text)} `
  const matched = new Set<string>()
  for (const [topic, patterns] of Object.entries(retailTopicKeywords)) {
    if (patterns.some((pattern) => normalized.includes(` ${pattern} `))) {
      matched.add(topic)
    }
  }
  return matched
}

function createExcerpt(content: string, normalizedQuery: string) {
  if (content.length <= 1_200) {
    return content.trim()
  }

  const normalizedContent = normalizeSearchText(content)
  const tokens = normalizedQuery
    .split(/\s+/)
    .filter((token) => token.length >= 3)

  let matchIndex = -1
  const bigrams = extractNgrams(tokens, 2)
  for (const bigram of bigrams) {
    const idx = normalizedContent.indexOf(bigram)
    if (idx !== -1) {
      matchIndex = idx
      break
    }
  }
  if (matchIndex === -1) {
    for (const token of tokens) {
      const idx = normalizedContent.indexOf(token)
      if (idx !== -1) {
        matchIndex = idx
        break
      }
    }
  }

  const start = matchIndex === -1 || matchIndex <= 150 ? 0 : matchIndex - 60
  const excerpt = content.slice(start, start + 1_200).trim()

  return start > 0 ? `...${excerpt}` : excerpt
}

function scoreKnowledgeDocument(
  document: KnowledgeDocumentSearchSource,
  normalizedQuery: string
) {
  const queryTokens = normalizedQuery
    .split(/\s+/)
    .filter((token) => token.length >= 2)
  if (!queryTokens.length) return 0

  const title = normalizeSearchText(document.title)
  const key = normalizeSearchText(document.document_key)
  const content = normalizeSearchText(document.content)
  const titleTokens = new Set(title.split(/\s+/))
  const keyTokens = new Set(key.split(/\s+/))
  const contentTokens = new Set(content.split(/\s+/))

  let score = 0

  const queryTopics = detectTextTopics(normalizedQuery)
  const docTitleTopics = detectTextTopics(`${title} ${key}`)
  const docContentTopics = detectTextTopics(content)
  if (queryTopics.size > 0) {
    const hasMatchingTitleTopic = [...queryTopics].some((t) =>
      docTitleTopics.has(t)
    )
    if (hasMatchingTitleTopic) {
      score += 16
    } else {
      const hasMatchingContentTopic = [...queryTopics].some((t) =>
        docContentTopics.has(t)
      )
      if (hasMatchingContentTopic) {
        score += 8
      }
    }
  }

  if (title.includes(normalizedQuery)) score += 16
  if (key.includes(normalizedQuery)) score += 12
  if (content.includes(normalizedQuery)) score += 6

  const trigrams = extractNgrams(queryTokens, 3)
  for (const trigram of trigrams) {
    if (title.includes(trigram)) score += 8
    if (key.includes(trigram)) score += 6
    if (content.includes(trigram)) score += 3
  }

  const bigrams = extractNgrams(queryTokens, 2)
  for (const bigram of bigrams) {
    if (title.includes(bigram)) score += 6
    if (key.includes(bigram)) score += 4
    if (content.includes(bigram)) score += 2
  }

  const uniqueTokens = [...new Set(queryTokens)]
  for (const token of uniqueTokens) {
    if (titleTokens.has(token)) score += 0.6
    if (keyTokens.has(token)) score += 0.4
    if (contentTokens.has(token)) score += 0.5
  }

  return score
}

export function searchKnowledgeDocuments(
  input: KnowledgeSearchInput,
  documents: KnowledgeDocumentSearchSource[],
  now = new Date()
): KnowledgeSearchOutput {
  const parsed = KnowledgeSearchInput.parse(input)
  const normalizedQuery = normalizeSearchText(parsed.query)
  const eligible = documents.filter((document) =>
    isKnowledgeEligible(document, now)
  )
  const results = eligible
    .map((document) => ({
      citation: buildKnowledgeCitation(document),
      document,
      score: scoreKnowledgeDocument(document, normalizedQuery),
    }))
    .filter(
      (candidate): candidate is typeof candidate & {
        citation: NonNullable<typeof candidate.citation>
      } => candidate.score > 0 && candidate.citation !== null
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        new Date(right.document.effective_at).getTime() -
          new Date(left.document.effective_at).getTime()
    )
    .slice(0, parsed.limit)
    .map(({ citation, document, score }) => ({
      citation_locator: citation.locator,
      document_id: document.id,
      document_key: document.document_key,
      effective_at: new Date(document.effective_at).toISOString(),
      excerpt: createExcerpt(document.content, normalizedQuery),
      quote_checksum: citation.quote_checksum,
      score,
      title: document.title,
      version: document.version,
    }))

  return { results, total_candidates: eligible.length }
}

export function searchKnowledgeChunks(
  input: KnowledgeSearchInput,
  documents: KnowledgeDocumentSearchSource[],
  chunks: KnowledgeChunkSearchSource[],
  now = new Date()
): KnowledgeSearchOutput {
  return searchKnowledgeChunksHybrid(input, documents, chunks, new Map(), now)
}

export function searchKnowledgeChunksHybrid(
  input: KnowledgeSearchInput,
  documents: KnowledgeDocumentSearchSource[],
  chunks: KnowledgeChunkSearchSource[],
  semanticScores: ReadonlyMap<string, number>,
  now = new Date()
): KnowledgeSearchOutput {
  const parsed = KnowledgeSearchInput.parse(input)
  const normalizedQuery = normalizeSearchText(parsed.query)
  const eligibleDocuments = new Map(
    documents
      .filter((document) => isKnowledgeEligible(document, now))
      .map((document) => [document.id, document])
  )
  const candidates = chunks.filter((chunk) =>
    eligibleDocuments.has(chunk.document_id)
  )
  const ranked = candidates
    .map((chunk) => {
      const document = eligibleDocuments.get(chunk.document_id)!
      const lexicalScore = scoreKnowledgeDocument(
        { ...document, content: chunk.content },
        normalizedQuery
      )
      const semanticScore = semanticScores.get(chunk.id)
      const score =
        semanticScore === undefined
          ? lexicalScore
          : Math.min(1, lexicalScore / 16) * 0.35 +
            Math.max(0, Math.min(1, semanticScore)) * 0.65
      return {
        chunk,
        document,
        lexicalScore,
        score,
        semanticScore,
      }
    })
    .filter(
      (candidate) =>
        candidate.lexicalScore > 0 ||
        (candidate.semanticScore !== undefined &&
          candidate.semanticScore >= 0.2)
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        new Date(right.document.effective_at).getTime() -
          new Date(left.document.effective_at).getTime() ||
        left.chunk.chunk_index - right.chunk.chunk_index
    )
  const selected: typeof ranked = []
  const chunkChecksums = new Set<string>()
  const documentCounts = new Map<string, number>()
  for (const candidate of ranked) {
    if (selected.length >= parsed.limit) break
    if (chunkChecksums.has(candidate.chunk.checksum)) continue
    const documentCount = documentCounts.get(candidate.document.id) ?? 0
    if (documentCount >= 2) continue
    selected.push(candidate)
    chunkChecksums.add(candidate.chunk.checksum)
    documentCounts.set(candidate.document.id, documentCount + 1)
  }

  const results = selected
    .map(({ chunk, document, score }) => ({
      citation_locator: chunk.citation_locator,
      chunk_id: chunk.id,
      chunk_index: chunk.chunk_index,
      document_id: document.id,
      document_key: document.document_key,
      effective_at: new Date(document.effective_at).toISOString(),
      excerpt: createExcerpt(chunk.content, normalizedQuery),
      quote_checksum:
        chunk.checksum || checksumKnowledgeContent(chunk.content),
      score,
      title: document.title,
      version: document.version,
    }))

  return { results, total_candidates: candidates.length }
}

export function formatAuditSearchResult(
  events: AuditEventSearchSource[]
): AuditSearchOutput {
  const normalized = events.map((event) => ({
    action: event.action,
    actor_id: event.actor_id,
    actor_type: event.actor_type,
    correlation_id: event.correlation_id,
    data: event.data ?? null,
    event_id: event.id,
    event_type: event.event_type,
    incident_id: event.incident_id ?? null,
    recorded_at: new Date(event.recorded_at).toISOString(),
    resource_id: event.resource_id,
    resource_type: event.resource_type,
  }))

  return { events: normalized, returned_count: normalized.length }
}

export function buildTraceReplayOutput(input: {
  correlation_id?: string
  incident_ids: string[]
  limit: number
  timeline: TraceTimelineEntry[]
}): TraceReplayOutput {
  const ordered = [...input.timeline].sort(
    (left, right) =>
      new Date(left.occurred_at).getTime() -
        new Date(right.occurred_at).getTime() ||
      left.entry_id.localeCompare(right.entry_id)
  )
  const timeline = ordered.slice(0, input.limit)

  return {
    correlation_id: input.correlation_id ?? null,
    incident_ids: [...new Set(input.incident_ids)].sort(),
    returned_count: timeline.length,
    timeline,
    truncated: ordered.length > timeline.length,
  }
}
