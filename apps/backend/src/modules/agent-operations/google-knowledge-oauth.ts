import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"
import { OAuth2Client } from "google-auth-library"
import { MedusaError } from "@medusajs/framework/utils"
import { getCredentialVaultStatus } from "./credential-vault"

export const GOOGLE_DRIVE_FILE_SCOPE =
  "https://www.googleapis.com/auth/drive.file"
export const GOOGLE_KNOWLEDGE_SCOPES = [
  "openid",
  "email",
  GOOGLE_DRIVE_FILE_SCOPE,
] as const

const STATE_TTL_MS = 10 * 60 * 1000

type OAuthState = {
  actor_id: string
  expires_at: number
  nonce: string
  tenant_id: string
}

function oauthConfiguration(environment: NodeJS.ProcessEnv) {
  return {
    api_key: environment.GOOGLE_KNOWLEDGE_PICKER_API_KEY?.trim() ?? "",
    app_id: environment.GOOGLE_KNOWLEDGE_CLOUD_PROJECT_NUMBER?.trim() ?? "",
    client_id:
      environment.GOOGLE_KNOWLEDGE_OAUTH_CLIENT_ID?.trim() ||
      environment.GOOGLE_CLIENT_ID?.trim() ||
      "",
    client_secret:
      environment.GOOGLE_KNOWLEDGE_OAUTH_CLIENT_SECRET?.trim() ||
      environment.GOOGLE_CLIENT_SECRET?.trim() ||
      "",
    redirect_uri:
      environment.GOOGLE_KNOWLEDGE_OAUTH_REDIRECT_URI?.trim() ?? "",
  }
}

function stateSecret(environment: NodeJS.ProcessEnv) {
  const secret =
    environment.AGENT_CREDENTIAL_ENCRYPTION_KEY?.trim() ||
    environment.JWT_SECRET?.trim()
  if (!secret) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Google connector security is not configured."
    )
  }
  return secret
}

function assertOAuthConfiguration(environment: NodeJS.ProcessEnv) {
  const configuration = oauthConfiguration(environment)
  if (
    !configuration.api_key ||
    !configuration.app_id ||
    !configuration.client_id ||
    !configuration.client_secret ||
    !configuration.redirect_uri ||
    !getCredentialVaultStatus(environment).ready
  ) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Google OAuth connector platform configuration is incomplete."
    )
  }
  return configuration
}

function createOAuthClient(environment: NodeJS.ProcessEnv) {
  const configuration = assertOAuthConfiguration(environment)
  return new OAuth2Client(
    configuration.client_id,
    configuration.client_secret,
    configuration.redirect_uri
  )
}

function signStatePayload(payload: string, environment: NodeJS.ProcessEnv) {
  return createHmac("sha256", stateSecret(environment))
    .update(payload)
    .digest("base64url")
}

export function getGoogleKnowledgeOAuthPlatformStatus(
  environment: NodeJS.ProcessEnv = process.env
) {
  const configuration = oauthConfiguration(environment)
  const vault = getCredentialVaultStatus(environment)
  return {
    platform_ready: Boolean(
      configuration.api_key &&
        configuration.app_id &&
        configuration.client_id &&
        configuration.client_secret &&
        configuration.redirect_uri &&
        vault.ready
    ),
    uses_dedicated_encryption_key: vault.uses_dedicated_key,
  }
}

export function createGoogleKnowledgeAuthorization(
  input: { actor_id: string; tenant_id?: string },
  environment: NodeJS.ProcessEnv = process.env,
  now = Date.now()
) {
  const client = createOAuthClient(environment)
  const nonce = randomBytes(24).toString("base64url")
  const statePayload: OAuthState = {
    actor_id: input.actor_id,
    expires_at: now + STATE_TTL_MS,
    nonce,
    tenant_id: input.tenant_id ?? "default",
  }
  const payload = Buffer.from(JSON.stringify(statePayload), "utf8").toString(
    "base64url"
  )
  const state = `${payload}.${signStatePayload(payload, environment)}`
  const authorizationUrl = client.generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent select_account",
    scope: [...GOOGLE_KNOWLEDGE_SCOPES],
    state,
  })

  return { authorization_url: authorizationUrl, nonce, state }
}

export function verifyGoogleKnowledgeOAuthState(
  input: { actor_id: string; nonce: string; state: string },
  environment: NodeJS.ProcessEnv = process.env,
  now = Date.now()
) {
  const [payload, suppliedSignature, extra] = input.state.split(".")
  if (!payload || !suppliedSignature || extra) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Google authorization state is invalid."
    )
  }
  const expectedSignature = signStatePayload(payload, environment)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Google authorization state is invalid."
    )
  }

  let state: OAuthState
  try {
    state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Google authorization state is invalid."
    )
  }
  if (
    state.actor_id !== input.actor_id ||
    state.nonce !== input.nonce ||
    state.expires_at < now
  ) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Google authorization has expired or belongs to another session."
    )
  }
  return state
}

export async function exchangeGoogleKnowledgeAuthorizationCode(
  code: string,
  environment: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
) {
  const client = createOAuthClient(environment)
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token || !tokens.access_token) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Google did not return offline access. Reconnect and approve access."
    )
  }
  const response = await fetchImpl(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }
  )
  if (!response.ok) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "The connected Google account could not be identified."
    )
  }
  const profile = (await response.json()) as { email?: string }
  if (!profile.email) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "The connected Google account did not provide an email address."
    )
  }
  return {
    account_email: profile.email,
    refresh_token: tokens.refresh_token,
    scopes: [...GOOGLE_KNOWLEDGE_SCOPES],
  }
}

export async function createGoogleKnowledgeAccessToken(
  refreshToken: string,
  environment: NodeJS.ProcessEnv = process.env
) {
  const client = createOAuthClient(environment)
  client.setCredentials({ refresh_token: refreshToken })
  const token = await client.getAccessToken()
  if (!token.token) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Google access has expired. Reconnect the Google account."
    )
  }
  const configuration = assertOAuthConfiguration(environment)
  return {
    access_token: token.token,
    app_id: configuration.app_id,
    client_id: configuration.client_id,
    picker_api_key: configuration.api_key,
  }
}

export async function revokeGoogleKnowledgeAccess(
  refreshToken: string,
  environment: NodeJS.ProcessEnv = process.env
) {
  const client = createOAuthClient(environment)
  await client.revokeToken(refreshToken)
}
