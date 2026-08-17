import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"

const CIPHER = "aes-256-gcm"
const KEY_VERSION = "v1"
const AAD = Buffer.from("shipping-carrier-secret:v1", "utf8")
const KEY_SALT = "shipping-carrier-secret-key:v1"

export type EncryptedShippingSecret = {
  encrypted_secret: string
  encryption_iv: string
  encryption_tag: string
  key_version: string
}

function masterSecret(environment: NodeJS.ProcessEnv) {
  return (
    environment.SHIPPING_CREDENTIAL_ENCRYPTION_KEY?.trim() ||
    environment.AGENT_CREDENTIAL_ENCRYPTION_KEY?.trim() ||
    environment.JWT_SECRET?.trim() ||
    ""
  )
}

function encryptionKey(environment: NodeJS.ProcessEnv) {
  const secret = masterSecret(environment)
  if (!secret) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Secure carrier credential storage is not configured."
    )
  }

  return scryptSync(secret, KEY_SALT, 32)
}

export function encryptShippingSecret(
  secret: string,
  environment: NodeJS.ProcessEnv = process.env
): EncryptedShippingSecret {
  if (!secret.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Carrier secret cannot be empty."
    )
  }

  const iv = randomBytes(12)
  const cipher = createCipheriv(CIPHER, encryptionKey(environment), iv)
  cipher.setAAD(AAD)
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ])

  return {
    encrypted_secret: encrypted.toString("base64"),
    encryption_iv: iv.toString("base64"),
    encryption_tag: cipher.getAuthTag().toString("base64"),
    key_version: KEY_VERSION,
  }
}

export function decryptShippingSecret(
  encrypted: EncryptedShippingSecret,
  environment: NodeJS.ProcessEnv = process.env
) {
  if (encrypted.key_version !== KEY_VERSION) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "The stored carrier secret uses an unsupported encryption version."
    )
  }

  try {
    const decipher = createDecipheriv(
      CIPHER,
      encryptionKey(environment),
      Buffer.from(encrypted.encryption_iv, "base64")
    )
    decipher.setAAD(AAD)
    decipher.setAuthTag(Buffer.from(encrypted.encryption_tag, "base64"))

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.encrypted_secret, "base64")),
      decipher.final(),
    ]).toString("utf8")
  } catch (error) {
    if (error instanceof MedusaError) throw error
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "The stored carrier secret could not be decrypted."
    )
  }
}
