import { MedusaError } from "@medusajs/framework/utils"

const ENV_SECRET_REFERENCE = /^env:([A-Z][A-Z0-9_]*)$/
const VAULT_SECRET_REFERENCE = /^vault:([a-zA-Z0-9_-]+)$/

export function isVaultSecretReference(secretReference: string | null | undefined): boolean {
  return Boolean(secretReference && VAULT_SECRET_REFERENCE.test(secretReference))
}

export function parseVaultSecretReference(secretReference: string | null | undefined): string | null {
  const match = secretReference?.match(VAULT_SECRET_REFERENCE)
  return match ? match[1] : null
}

export function resolveSecretReference(
  secretReference: string | null | undefined,
  environment: NodeJS.ProcessEnv = process.env
) {
  if (!secretReference) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Channel secret_ref is required."
    )
  }

  const match = secretReference.match(ENV_SECRET_REFERENCE)
  if (match) {
    const value = environment[match[1]]?.trim()
    if (!value) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `The environment secret ${match[1]} is not configured.`
      )
    }
    return value
  }

  const vaultMatch = secretReference.match(VAULT_SECRET_REFERENCE)
  if (vaultMatch) {
    return secretReference
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "Channel secret_ref must use the env:VARIABLE_NAME or vault:ID format."
  )
}

