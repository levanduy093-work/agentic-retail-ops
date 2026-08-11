import {
  decryptConnectorSecret,
  encryptConnectorSecret,
  getCredentialVaultStatus,
} from "../credential-vault"

const environment = {
  AGENT_CREDENTIAL_ENCRYPTION_KEY:
    "unit-test-connector-encryption-key-with-enough-entropy",
} as NodeJS.ProcessEnv

describe("connector credential vault", () => {
  it("encrypts and decrypts a refresh token without storing plaintext", () => {
    const encrypted = encryptConnectorSecret("refresh-token-value", environment)

    expect(encrypted.encrypted_secret).not.toContain("refresh-token-value")
    expect(decryptConnectorSecret(encrypted, environment)).toBe(
      "refresh-token-value"
    )
  })

  it("rejects decryption with a different master key", () => {
    const encrypted = encryptConnectorSecret("refresh-token-value", environment)

    expect(() =>
      decryptConnectorSecret(encrypted, {
        AGENT_CREDENTIAL_ENCRYPTION_KEY: "different-encryption-key",
      } as NodeJS.ProcessEnv)
    ).toThrow("could not be decrypted")
  })

  it("reports whether the dedicated connector key is configured", () => {
    expect(getCredentialVaultStatus(environment)).toEqual({
      ready: true,
      uses_dedicated_key: true,
    })
    expect(
      getCredentialVaultStatus({ JWT_SECRET: "local-jwt-secret" } as NodeJS.ProcessEnv)
    ).toEqual({ ready: true, uses_dedicated_key: false })
  })
})
