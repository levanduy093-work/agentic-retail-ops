import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { encryptConnectorSecret } from "../../../../../../modules/agent-operations/credential-vault"
import { configureAiProviderWorkflow } from "../../../../../../workflows/agent-operations/configure-ai-provider"
import { disconnectAiProviderWorkflow } from "../../../../../../workflows/agent-operations/disconnect-ai-provider"
import { AdminConfigureAiProviderType } from "../../../validators"

function parseProvider(value: string) {
  const provider = value.toUpperCase()
  if (provider !== "OPENAI" && provider !== "GEMINI") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Unsupported AI provider ${value}.`
    )
  }
  return provider
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminConfigureAiProviderType>,
  res: MedusaResponse
) {
  const { api_key: apiKey, ...configuration } = req.validatedBody
  const { result } = await configureAiProviderWorkflow(req.scope).run({
    input: {
      ...configuration,
      actor_id: req.auth_context.actor_id,
      encrypted_api_key: apiKey
        ? encryptConnectorSecret(apiKey)
        : undefined,
      provider: parseProvider(req.params.provider),
      secret_hint: apiKey?.slice(-4),
      tenant_id: "default",
    },
  })
  res.status(200).json(result)
}

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { result } = await disconnectAiProviderWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      provider: parseProvider(req.params.provider),
      tenant_id: "default",
    },
  })
  res.status(200).json(result)
}
