import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"

const CIPHER = "aes-256-gcm"
const KEY_VERSION = "v1"
const AAD = Buffer.from("payment-provider-secret:v1", "utf8")
const KEY_SALT = "payment-provider-secret-key:v1"

export type EncryptedPaymentSecret = {
  encrypted_secret: string
  encryption_iv: string
  encryption_tag: string
  key_version: string
}

function masterSecret(environment: NodeJS.ProcessEnv) {
  return (
    environment.PAYMENT_CREDENTIAL_ENCRYPTION_KEY?.trim() ||
    environment.SHIPPING_CREDENTIAL_ENCRYPTION_KEY?.trim() ||
    environment.AGENT_CREDENTIAL_ENCRYPTION_KEY?.trim() ||
    environment.JWT_SECRET?.trim() ||
    environment.COOKIE_SECRET?.trim() ||
    "medusa_default_secret_key_change_in_production"
  )
}

function encryptionKey(environment: NodeJS.ProcessEnv) {
  const secret = masterSecret(environment)
  if (!secret) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Secure payment credential storage is not configured."
    )
  }

  return scryptSync(secret, KEY_SALT, 32)
}

export function encryptPaymentSecret(
  secret: string,
  environment: NodeJS.ProcessEnv = process.env
): EncryptedPaymentSecret {
  if (!secret.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Payment secret cannot be empty."
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

export function decryptPaymentSecret(
  encrypted: EncryptedPaymentSecret,
  environment: NodeJS.ProcessEnv = process.env
): string {
  if (encrypted.key_version !== KEY_VERSION) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "The stored payment secret uses an unsupported encryption version."
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
      "The stored payment secret could not be decrypted."
    )
  }
}

export function buildSecretHint(secret?: string | null): string | null {
  if (!secret || typeof secret !== "string") {
    return null
  }
  const clean = secret.trim()
  if (clean.length <= 4) {
    return "••••"
  }
  return `••••••••${clean.slice(-4)}`
}
