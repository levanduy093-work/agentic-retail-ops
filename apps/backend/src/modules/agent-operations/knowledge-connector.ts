import { isIP } from "node:net"
import { promises as dns } from "node:dns"
import { MedusaError } from "@medusajs/framework/utils"
import { checksumKnowledgeContent } from "./knowledge"
import {
  fetchGoogleDriveKnowledgeSource,
  GoogleKnowledgeSourceType,
  validateGoogleKnowledgeSourceUrl,
} from "./google-drive-knowledge-connector"

const MAX_DOCUMENT_BYTES = 1_000_000
const MAX_REDIRECTS = 3
const FETCH_TIMEOUT_MS = 10_000

type AddressResolver = (
  hostname: string
) => Promise<Array<{ address: string; family: number }>>

export type KnowledgeConnectorFetchResult = {
  checksum: string
  content: string
  content_type: string
  etag: string | null
  final_url: string
}

export type KnowledgeSourceType =
  | GoogleKnowledgeSourceType
  | "HTTPS_TEXT"

export async function validateKnowledgeSource(
  sourceUrl: string,
  sourceType: KnowledgeSourceType
) {
  if (sourceType !== "HTTPS_TEXT") {
    return validateGoogleKnowledgeSourceUrl(sourceUrl, sourceType).canonical_url
  }
  return (await validateKnowledgeSourceUrl(sourceUrl)).toString()
}

function parseAllowedHosts(environment: NodeJS.ProcessEnv) {
  return (environment.KNOWLEDGE_CONNECTOR_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
}

function isAllowedHost(hostname: string, allowedHosts: string[]) {
  const normalized = hostname.toLowerCase()
  return allowedHosts.some(
    (allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`)
  )
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  )
}

function isPrivateAddress(address: string) {
  const family = isIP(address)
  if (family === 4) return isPrivateIpv4(address)
  if (family !== 6) return true

  const normalized = address.toLowerCase()
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  )
}

export async function validateKnowledgeSourceUrl(
  value: string,
  options: {
    environment?: NodeJS.ProcessEnv
    resolveAddresses?: AddressResolver
  } = {}
) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Knowledge source URL is invalid."
    )
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Knowledge sources must use HTTPS without credentials or a custom port."
    )
  }

  const environment = options.environment ?? process.env
  const allowedHosts = parseAllowedHosts(environment)
  if (!allowedHosts.length || !isAllowedHost(url.hostname, allowedHosts)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Knowledge source host is not in KNOWLEDGE_CONNECTOR_ALLOWED_HOSTS."
    )
  }

  if (isIP(url.hostname) && isPrivateAddress(url.hostname)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Private network knowledge sources are not allowed."
    )
  }

  const resolveAddresses =
    options.resolveAddresses ??
    (async (hostname: string) => dns.lookup(hostname, { all: true }))
  const addresses = await resolveAddresses(url.hostname)
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Knowledge source resolves to a private or unsupported network address."
    )
  }

  return url
}

export async function fetchKnowledgeSource(
  sourceUrl: string,
  options: {
    environment?: NodeJS.ProcessEnv
    fetchImpl?: typeof fetch
    googleAuthorizationHeader?: string
    resolveAddresses?: AddressResolver
    sourceType?: KnowledgeSourceType
  } = {}
): Promise<KnowledgeConnectorFetchResult> {
  if (options.sourceType && options.sourceType !== "HTTPS_TEXT") {
    return fetchGoogleDriveKnowledgeSource(sourceUrl, options.sourceType, {
      authorizationHeader: options.googleAuthorizationHeader,
      fetchImpl: options.fetchImpl,
    })
  }
  const fetchImpl = options.fetchImpl ?? fetch
  let url = await validateKnowledgeSourceUrl(sourceUrl, options)

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetchImpl(url, {
        headers: { Accept: "text/markdown,text/plain;q=0.9" },
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
      })
    } catch {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Knowledge source could not be reached."
      )
    } finally {
      clearTimeout(timeout)
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location")
      if (!location || redirect === MAX_REDIRECTS) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Knowledge source has too many or invalid redirects."
        )
      }
      url = await validateKnowledgeSourceUrl(new URL(location, url).toString(), options)
      continue
    }

    if (!response.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Knowledge source returned HTTP ${response.status}.`
      )
    }
    const contentType = response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase()
    if (!contentType || !["text/markdown", "text/plain"].includes(contentType)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Knowledge source must return text/plain or text/markdown."
      )
    }
    const declaredLength = Number(response.headers.get("content-length") ?? 0)
    if (declaredLength > MAX_DOCUMENT_BYTES) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Knowledge source is larger than 1 MB."
      )
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Knowledge source is larger than 1 MB."
      )
    }
    const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim()
    if (content.length < 20) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Knowledge source does not contain enough text."
      )
    }

    return {
      checksum: checksumKnowledgeContent(content),
      content,
      content_type: contentType,
      etag: response.headers.get("etag"),
      final_url: url.toString(),
    }
  }

  throw new MedusaError(
    MedusaError.Types.UNEXPECTED_STATE,
    "Knowledge source fetch did not complete."
  )
}
