import {
  AbstractAuthModuleProvider,
  MedusaError
} from '@medusajs/framework/utils'
import {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityProviderService
} from '@medusajs/framework/types'
import { OAuth2Client } from 'google-auth-library'

type GoogleOneTapOptions = {
  clientId: string
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
}

class GoogleOneTapAuthService extends AbstractAuthModuleProvider {
  static DISPLAY_NAME = 'Google One Tap'
  static identifier = 'google-one-tap'

  protected options_: GoogleOneTapOptions
  private googleClient_: OAuth2Client

  constructor(_container: unknown, options: GoogleOneTapOptions) {
    // @ts-ignore Medusa injects the provider container at runtime.
    super(...arguments)
    this.options_ = options
    this.googleClient_ = new OAuth2Client(options.clientId)
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
      throw new MedusaError(
        MedusaError.Types.UNAUTHORIZED,
        'Google did not provide an account identifier.'
      )
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
    try {
      const ticket = await this.googleClient_.verifyIdToken({
        idToken: credential,
        audience: this.options_.clientId
      })
      const payload = ticket.getPayload()

      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        throw new MedusaError(
          MedusaError.Types.UNAUTHORIZED,
          'Google did not provide a verified account identity.'
        )
      }

      return {
        email: payload.email,
        email_verified: payload.email_verified,
        family_name: payload.family_name,
        given_name: payload.given_name,
        name: payload.name,
        picture: payload.picture,
        sub: payload.sub
      }
    } catch (error) {
      if (error instanceof MedusaError) {
        throw error
      }

      throw new MedusaError(
        MedusaError.Types.UNAUTHORIZED,
        'Google credential could not be verified.'
      )
    }
  }
}

export default GoogleOneTapAuthService
