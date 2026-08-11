import { MedusaError } from "@medusajs/framework/utils"
import { checksumKnowledgeContent } from "./knowledge"

const GOOGLE_API_BASE = "https://www.googleapis.com/drive/v3/files"
const MAX_DOCUMENT_BYTES = 1_000_000
const FETCH_TIMEOUT_MS = 10_000

export type GoogleKnowledgeSourceType =
  | "GOOGLE_DOC"
  | "GOOGLE_DRIVE"
  | "GOOGLE_SHEET"

type GoogleDriveFileMetadata = {
  capabilities?: { canDownload?: boolean }
  id: string
  md5Checksum?: string
  mimeType: string
  modifiedTime?: string
  name: string
  size?: string
}

export function parseGoogleDriveFileUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Google document link is invalid."
    )
  }

  if (url.protocol !== "https:") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Google document links must use HTTPS."
    )
  }

  const host = url.hostname.toLowerCase()
  const pathParts = url.pathname.split("/").filter(Boolean)
  let fileId: string | null = null
  let linkType: GoogleKnowledgeSourceType = "GOOGLE_DRIVE"

  if (host === "docs.google.com" && pathParts[1] === "d") {
    if (pathParts[0] === "document") linkType = "GOOGLE_DOC"
    else if (pathParts[0] === "spreadsheets") linkType = "GOOGLE_SHEET"
    else {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Only Google Docs and Google Sheets links are supported."
      )
    }
    fileId = pathParts[2] ?? null
  } else if (host === "drive.google.com") {
    if (pathParts[0] === "file" && pathParts[1] === "d") {
      fileId = pathParts[2] ?? null
    } else {
      fileId = url.searchParams.get("id")
    }
  }

  if (!fileId || !/^[a-zA-Z0-9_-]{10,200}$/.test(fileId)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Paste a Google Docs, Google Sheets, or Google Drive file link."
    )
  }

  return {
    canonical_url: `https://drive.google.com/file/d/${fileId}`,
    file_id: fileId,
    link_type: linkType,
  }
}

export function validateGoogleKnowledgeSourceUrl(
  value: string,
  sourceType: GoogleKnowledgeSourceType
) {
  const parsed = parseGoogleDriveFileUrl(value)
  if (
    sourceType !== "GOOGLE_DRIVE" &&
    parsed.link_type !== sourceType
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      sourceType === "GOOGLE_DOC"
        ? "Choose Google Docs for a Docs link."
        : "Choose Google Sheets for a Sheets link."
    )
  }
  const canonicalUrl =
    sourceType === "GOOGLE_DOC"
      ? `https://docs.google.com/document/d/${parsed.file_id}`
      : sourceType === "GOOGLE_SHEET"
        ? `https://docs.google.com/spreadsheets/d/${parsed.file_id}`
        : parsed.canonical_url
  return { ...parsed, canonical_url: canonicalUrl }
}

async function fetchWithTimeout(
  url: string,
  authorization: string,
  fetchImpl: typeof fetch
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetchImpl(url, {
      headers: { Authorization: authorization },
      method: "GET",
      signal: controller.signal,
    })
  } catch {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Google Drive could not be reached."
    )
  } finally {
    clearTimeout(timeout)
  }
}

function contentRequestFor(metadata: GoogleDriveFileMetadata) {
  const fileUrl = `${GOOGLE_API_BASE}/${encodeURIComponent(metadata.id)}`
  if (metadata.mimeType === "application/vnd.google-apps.document") {
    return {
      content_type: "text/plain",
      url: `${fileUrl}/export?mimeType=${encodeURIComponent("text/plain")}`,
    }
  }
  if (metadata.mimeType === "application/vnd.google-apps.spreadsheet") {
    return {
      content_type: "text/csv",
      url: `${fileUrl}/export?mimeType=${encodeURIComponent("text/csv")}`,
    }
  }
  if (
    ["text/plain", "text/markdown", "text/csv", "application/csv"].includes(
      metadata.mimeType
    )
  ) {
    return {
      content_type: metadata.mimeType,
      url: `${fileUrl}?alt=media&supportsAllDrives=true`,
    }
  }
  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "This Drive file type is not supported. Use Google Docs, Google Sheets, TXT, Markdown, or CSV."
  )
}

export async function fetchGoogleDriveKnowledgeSource(
  sourceUrl: string,
  sourceType: GoogleKnowledgeSourceType,
  options: {
    authorizationHeader?: string
    fetchImpl?: typeof fetch
  } = {}
) {
  const parsed = validateGoogleKnowledgeSourceUrl(sourceUrl, sourceType)
  const fetchImpl = options.fetchImpl ?? fetch
  const authorization = options.authorizationHeader
  if (!authorization) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Connect a Google account before using Google documents."
    )
  }
  const fields = encodeURIComponent(
    "id,name,mimeType,modifiedTime,md5Checksum,size,capabilities(canDownload)"
  )
  const metadataResponse = await fetchWithTimeout(
    `${GOOGLE_API_BASE}/${encodeURIComponent(parsed.file_id)}?fields=${fields}&supportsAllDrives=true`,
    authorization,
    fetchImpl
  )
  if (!metadataResponse.ok) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      metadataResponse.status === 404
        ? "Google file was not found. Share it with the configured service account."
        : `Google Drive returned HTTP ${metadataResponse.status}.`
    )
  }

  const metadata = (await metadataResponse.json()) as GoogleDriveFileMetadata
  if (metadata.capabilities?.canDownload === false) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "The Google file owner has disabled downloading."
    )
  }
  if (sourceType === "GOOGLE_DOC" && metadata.mimeType !== "application/vnd.google-apps.document") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The selected file is not a Google Docs document."
    )
  }
  if (sourceType === "GOOGLE_SHEET" && metadata.mimeType !== "application/vnd.google-apps.spreadsheet") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The selected file is not a Google Sheets spreadsheet."
    )
  }

  const request = contentRequestFor(metadata)
  const contentResponse = await fetchWithTimeout(
    request.url,
    authorization,
    fetchImpl
  )
  if (!contentResponse.ok) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Google file export returned HTTP ${contentResponse.status}.`
    )
  }
  const declaredLength = Number(contentResponse.headers.get("content-length") ?? 0)
  if (declaredLength > MAX_DOCUMENT_BYTES) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Google document is larger than 1 MB."
    )
  }
  const bytes = new Uint8Array(await contentResponse.arrayBuffer())
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Google document is larger than 1 MB."
    )
  }
  const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim()
  if (content.length < 20) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Google document does not contain enough text."
    )
  }

  return {
    checksum: checksumKnowledgeContent(content),
    content,
    content_type: request.content_type,
    etag: metadata.modifiedTime ?? metadata.md5Checksum ?? null,
    final_url: sourceUrl,
  }
}
