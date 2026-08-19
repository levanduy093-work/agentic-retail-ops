import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { decryptConnectorSecret } from "../modules/agent-operations/credential-vault"
import type { ZaloStoredCredentialPayload } from "../modules/agent-operations/zalo"

export default async function refreshZaloOaTokensJob(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )

  const credentials = await service.listAgentChannelCredentials({
    channel: "ZALO",
  })

  let refreshed = 0
  let failed = 0

  for (const cred of credentials) {
    try {
      const raw = decryptConnectorSecret({
        encrypted_secret: cred.encrypted_secret,
        encryption_iv: cred.encryption_iv,
        encryption_tag: cred.encryption_tag,
        key_version: cred.key_version,
      })

      let payload: ZaloStoredCredentialPayload | null = null
      try {
        payload = JSON.parse(raw)
      } catch {
        payload = null
      }

      if (!payload?.refresh_token || !payload.app_id || !payload.secret_key) {
        continue
      }

      // If token expires in less than 6 hours (or expired), refresh it proactively
      const sixHoursMs = 6 * 60 * 60 * 1000
      const isExpiringSoon =
        !payload.expires_at || payload.expires_at - Date.now() < sixHoursMs

      if (isExpiringSoon) {
        await service.refreshZaloOaAccessToken(
          cred.account_ref,
          cred.tenant_id
        )
        refreshed += 1
      }
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : "Unknown error"
      logger.error(
        `Failed to refresh Zalo OA token for credential ${cred.id}: ${message}`
      )
    }
  }

  if (refreshed > 0 || failed > 0) {
    logger.info(
      `Zalo OA token refresh job completed: ${refreshed} refreshed, ${failed} failed.`
    )
  }
}

export const config = {
  name: "refresh-zalo-oa-tokens",
  schedule: "0 */4 * * *",
}
