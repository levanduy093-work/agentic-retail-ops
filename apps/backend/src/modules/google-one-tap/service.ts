import {
  AbstractAuthModuleProvider,
  MedusaError
} from '@medusajs/framework/utils'
import {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityProviderService
} from '@medusajs/framework/types'
import { createPublicKey, verify, type JsonWebKey } from 'crypto'

type GoogleOneTapOptions = {
  clientId: string
}

type GoogleTokenHeader = {
  alg?: string
  kid?: string
}

type GoogleTokenPayload = {
  email?: string
  email_verified?: boolean
  exp?: number
  family_name?: string
  given_name?: string
  iss?: string
  name?: string
  picture?: string
  sub?: string
  aud?: string | string[]
}

type GoogleJwk = JsonWebKey & {
  kid?: string
}

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_ISSUERS = new Set([
  'accounts.google.com',
  'https://accounts.google.com'
])
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000

let jwksCache: GoogleJwk[] | null = null
let jwksCacheExpiresAt = 0

const decodeBase64UrlJson = <T>(value: string): T =>
  JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T

class GoogleOneTapAuthService extends AbstractAuthModuleProvider {
  static DISPLAY_NAME = 'Google One Tap'
  static identifier = 'google-one-tap'

  protected options_: GoogleOneTapOptions

  constructor(_container: unknown, options: GoogleOneTapOptions) {
    // @ts-ignore Medusa injects the provider container at runtime.
    super(...arguments)
    this.options_ = options
  }

  static validateOptions(options: GoogleOneTapOptions) {
    if (!options.clientId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'Google One Tap requires a client ID'
      )
    }
  }

  async register(): Promise<AuthenticationResponse> {
    return {
      success: false,
      error: 'Google One Tap only supports authentication.'
    }
  }

  async authenticate(
    data: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const credential = data.body?.credential

    if (typeof credential !== 'string') {
      return { success: false, error: 'Google credential is required.' }
    }

    try {
      const profile = await this.verifyCredential(credential)
      const authIdentity = await this.getOrCreateIdentity(
        profile,
        authIdentityProviderService
      )

      return { success: true, authIdentity }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Google credential could not be verified.'
      }
    }
  }

  async validateCallback(
    data: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    return this.authenticate(data, authIdentityProviderService)
  }

  private async getOrCreateIdentity(
    profile: GoogleTokenPayload,
    authIdentityProviderService: AuthIdentityProviderService
  ) {
    const entityId = profile.sub

    if (!entityId) {
      throw new Error('Google did not provide an account identifier.')
    }

    const userMetadata = {
      email: profile.email,
      family_name: profile.family_name,
      given_name: profile.given_name,
      name: profile.name,
      picture: profile.picture
    }

    try {
      return await authIdentityProviderService.retrieve({
        entity_id: entityId
      })
    } catch (error) {
      if (
        !(error instanceof MedusaError) ||
        error.type !== MedusaError.Types.NOT_FOUND
      ) {
        throw error
      }

      return authIdentityProviderService.create({
        entity_id: entityId,
        user_metadata: userMetadata
      })
    }
  }

  private async verifyCredential(
    credential: string
  ): Promise<GoogleTokenPayload> {
    const [encodedHeader, encodedPayload, encodedSignature, ...rest] =
      credential.split('.')

    if (
      !encodedHeader ||
      !encodedPayload ||
      !encodedSignature ||
      rest.length > 0
    ) {
      throw new Error('Google credential has an invalid format.')
    }

    const header = decodeBase64UrlJson<GoogleTokenHeader>(encodedHeader)
    const payload = decodeBase64UrlJson<GoogleTokenPayload>(encodedPayload)

    if (header.alg !== 'RS256' || !header.kid) {
      throw new Error('Google credential uses an unsupported signing key.')
    }

    const key = await this.getGoogleSigningKey(header.kid)
    const signatureIsValid = verify(
      'RSA-SHA256',
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      createPublicKey({ key: key as JsonWebKey, format: 'jwk' }),
      Buffer.from(encodedSignature, 'base64url')
    )

    if (!signatureIsValid) {
      throw new Error('Google credential signature is invalid.')
    }

    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud]

    if (!audience.includes(this.options_.clientId)) {
      throw new Error('Google credential was issued for another application.')
    }

    if (!payload.iss || !GOOGLE_ISSUERS.has(payload.iss)) {
      throw new Error('Google credential has an invalid issuer.')
    }

    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      throw new Error('Google credential has expired.')
    }

    if (!payload.sub || !payload.email || payload.email_verified !== true) {
      throw new Error('Google did not provide a verified account identity.')
    }

    return payload
  }

  private async getGoogleSigningKey(kid: string): Promise<GoogleJwk> {
    const now = Date.now()

    if (!jwksCache || jwksCacheExpiresAt <= now) {
      const response = await fetch(GOOGLE_JWKS_URL)

      if (!response.ok) {
        throw new Error('Google signing keys are currently unavailable.')
      }

      const body = (await response.json()) as { keys?: GoogleJwk[] }

      if (!body.keys?.length) {
        throw new Error('Google signing keys are currently unavailable.')
      }

      jwksCache = body.keys
      jwksCacheExpiresAt = now + JWKS_CACHE_TTL_MS
    }

    const key = jwksCache.find((candidate) => candidate.kid === kid)

    if (!key) {
      jwksCache = null
      jwksCacheExpiresAt = 0
      throw new Error('Google signing key could not be found.')
    }

    return key
  }
}

export default GoogleOneTapAuthService
