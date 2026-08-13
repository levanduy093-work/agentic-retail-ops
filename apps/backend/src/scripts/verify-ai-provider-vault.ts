import assert from "node:assert/strict"
import { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { encryptConnectorSecret } from "../modules/agent-operations/credential-vault"

export default async function verifyAiProviderVault({ container }: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const tenantId = `ai-provider-vault-verifier-${Date.now()}`
  const apiKey = `verification-key-${Date.now()}`

  try {
    await service.configureAiProvider({
      actor_id: "ai-provider-vault-verifier",
      encrypted_api_key: encryptConnectorSecret(apiKey),
      embedding_dimensions: null,
      embedding_enabled: true,
      embedding_model: "gemini-embedding-001",
      generation_enabled: true,
      generation_model: "gemini-2.5-flash",
      provider: "GEMINI",
      secret_hint: apiKey.slice(-4),
      tenant_id: tenantId,
    })

    const credentials = await service.listAgentAiProviderCredentials({
      provider: "GEMINI",
      tenant_id: tenantId,
    })
    assert.equal(credentials.length, 1)
    assert.notEqual(credentials[0].encrypted_secret, apiKey)
    assert.equal(credentials[0].secret_hint, apiKey.slice(-4))

    const status = await service.getAiProviderStatuses(tenantId)
    const gemini = status.find((provider) => provider.provider === "GEMINI")
    assert.equal(gemini?.configured, true)
    assert.equal("encrypted_secret" in (gemini ?? {}), false)

    const runtime = await service.getActiveAiProviderCredential(
      "embedding",
      tenantId
    )
    assert.equal(runtime?.api_key, apiKey)
    assert.equal(runtime?.provider, "gemini")

    await service.configureAiProvider({
      actor_id: "ai-provider-vault-verifier",
      encrypted_api_key: encryptConnectorSecret(`openai-${apiKey}`),
      embedding_dimensions: null,
      embedding_enabled: false,
      embedding_model: "text-embedding-3-small",
      generation_enabled: true,
      generation_model: "gpt-4.1-mini",
      provider: "OPENAI",
      secret_hint: apiKey.slice(-4),
      tenant_id: tenantId,
    })
    const switched = await service.getAiProviderStatuses(tenantId)
    assert.equal(
      switched.find((provider) => provider.provider === "GEMINI")
        ?.embedding_enabled,
      true
    )
    assert.equal(
      switched.find((provider) => provider.provider === "GEMINI")
        ?.generation_enabled,
      true
    )
    assert.equal(
      switched.find((provider) => provider.provider === "OPENAI")
        ?.generation_enabled,
      true
    )

    await service.configureAiProvider({
      actor_id: "ai-provider-vault-verifier",
      encrypted_api_key: encryptConnectorSecret(`deepseek-${apiKey}`),
      embedding_enabled: false,
      embedding_model: "unsupported",
      generation_enabled: true,
      generation_model: "deepseek-chat",
      provider: "DEEPSEEK",
      secret_hint: apiKey.slice(-4),
      tenant_id: tenantId,
    })
    const generationCredentials = await service.getActiveAiProviderCredentials(
      "generation",
      tenantId
    )
    assert.deepEqual(
      generationCredentials.map((credential) => credential.provider),
      ["deepseek", "gemini", "openai"]
    )

    console.log(
      JSON.stringify(
        {
          api_key_returned_by_status_api: false,
          encrypted_at_rest: true,
          provider: "GEMINI",
          provider_failover_priority_verified: true,
          runtime_decryption_verified: true,
        },
        null,
        2
      )
    )
  } finally {
    for (const provider of ["DEEPSEEK", "GEMINI", "OPENAI"] as const) {
      await service.disconnectAiProvider({
        actor_id: "ai-provider-vault-verifier",
        provider,
        tenant_id: tenantId,
      })
    }
  }
}
