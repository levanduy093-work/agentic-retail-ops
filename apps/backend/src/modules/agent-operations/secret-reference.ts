import { MedusaError } from "@medusajs/framework/utils"

const ENV_SECRET_REFERENCE = /^env:([A-Z][A-Z0-9_]*)$/

export function resolveSecretReference(
  secretReference: string | null | undefined,
  environment: NodeJS.ProcessEnv = process.env
) {
  const match = secretReference?.match(ENV_SECRET_REFERENCE)
  if (!match) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Channel secret_ref must use the env:VARIABLE_NAME format."
    )
  }

  const value = environment[match[1]]?.trim()
  if (!value) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `The environment secret ${match[1]} is not configured.`
    )
  }

  return value
}
