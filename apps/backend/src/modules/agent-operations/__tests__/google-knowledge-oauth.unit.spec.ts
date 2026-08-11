import {
  createGoogleKnowledgeAuthorization,
  getGoogleKnowledgeOAuthPlatformStatus,
  verifyGoogleKnowledgeOAuthState,
} from "../google-knowledge-oauth"

const environment = {
  AGENT_CREDENTIAL_ENCRYPTION_KEY:
    "unit-test-connector-encryption-key-with-enough-entropy",
  GOOGLE_KNOWLEDGE_CLOUD_PROJECT_NUMBER: "123456789",
  GOOGLE_KNOWLEDGE_OAUTH_CLIENT_ID: "client.apps.googleusercontent.com",
  GOOGLE_KNOWLEDGE_OAUTH_CLIENT_SECRET: "client-secret",
  GOOGLE_KNOWLEDGE_OAUTH_REDIRECT_URI:
    "http://localhost:9000/admin/agent-operations/knowledge/sources/google-oauth/callback",
  GOOGLE_KNOWLEDGE_PICKER_API_KEY: "picker-api-key",
} as NodeJS.ProcessEnv

describe("Google knowledge OAuth", () => {
  it("creates a signed, browser-bound authorization state", () => {
    const authorization = createGoogleKnowledgeAuthorization(
      { actor_id: "user_1", tenant_id: "store_1" },
      environment,
      1_000
    )

    expect(authorization.authorization_url).toContain("drive.file")
    expect(
      verifyGoogleKnowledgeOAuthState(
        {
          actor_id: "user_1",
          nonce: authorization.nonce,
          state: authorization.state,
        },
        environment,
        2_000
      )
    ).toMatchObject({ actor_id: "user_1", tenant_id: "store_1" })
  })

  it("rejects state reuse from another browser or user", () => {
    const authorization = createGoogleKnowledgeAuthorization(
      { actor_id: "user_1" },
      environment,
      1_000
    )

    expect(() =>
      verifyGoogleKnowledgeOAuthState(
        {
          actor_id: "user_2",
          nonce: authorization.nonce,
          state: authorization.state,
        },
        environment,
        2_000
      )
    ).toThrow("another session")
  })

  it("rejects expired authorization state", () => {
    const authorization = createGoogleKnowledgeAuthorization(
      { actor_id: "user_1" },
      environment,
      1_000
    )

    expect(() =>
      verifyGoogleKnowledgeOAuthState(
        {
          actor_id: "user_1",
          nonce: authorization.nonce,
          state: authorization.state,
        },
        environment,
        1_000 + 11 * 60 * 1_000
      )
    ).toThrow("expired")
  })

  it("only reports the platform ready when every OAuth and Picker value exists", () => {
    expect(getGoogleKnowledgeOAuthPlatformStatus(environment).platform_ready).toBe(
      true
    )
    expect(
      getGoogleKnowledgeOAuthPlatformStatus({
        ...environment,
        GOOGLE_KNOWLEDGE_PICKER_API_KEY: "",
      }).platform_ready
    ).toBe(false)
  })

  it("reuses the existing sign-in OAuth client when dedicated values are empty", () => {
    const sharedClientEnvironment = {
      ...environment,
      GOOGLE_CLIENT_ID: "shared-client.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "shared-client-secret",
      GOOGLE_KNOWLEDGE_OAUTH_CLIENT_ID: "",
      GOOGLE_KNOWLEDGE_OAUTH_CLIENT_SECRET: "",
    }

    expect(
      getGoogleKnowledgeOAuthPlatformStatus(sharedClientEnvironment).platform_ready
    ).toBe(true)
    expect(
      createGoogleKnowledgeAuthorization(
        { actor_id: "user_1" },
        sharedClientEnvironment,
        1_000
      ).authorization_url
    ).toContain("shared-client.apps.googleusercontent.com")
  })
})
