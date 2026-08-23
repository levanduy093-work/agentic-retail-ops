import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../../modules/agent-operations/service"
import { TikTokWebhookPayloadType } from "../../../../admin/agent-operations/validators"
import { ingestTikTokWebhookWorkflow } from "../../../../../workflows/agent-operations/ingest-tiktok-webhook"
import type { TikTokChannelConfig } from "../../../../../modules/agent-operations/tiktok"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const challenge =
    (req.query.challenge as string) ||
    (req.query.hub_challenge as string) ||
    (req.query["hub.challenge"] as string)

  const token =
    (req.query.token as string) ||
    (req.query.verify_token as string) ||
    (req.query["hub.verify_token"] as string)

  if (challenge) {
    try {
      const service = req.scope.resolve<AgentOperationsModuleService>(
        AGENT_OPERATIONS_MODULE
      )
      const connection = await service.retrieveAgentChannelConnection(
        req.params.id
      )

      if (connection.channel !== "TIKTOK") {
        return res.status(404).send("Connection not found")
      }

      const config = connection.config as TikTokChannelConfig
      let expectedSecret = ""
      try {
        expectedSecret = await service.resolveChannelWebhookSecret(connection)
      } catch {
        expectedSecret = ""
      }

      if (token && expectedSecret && token !== expectedSecret) {
        return res.status(403).send("Verification token mismatch")
      }

      return res.status(200).send(challenge)
    } catch {
      return res.status(200).send(challenge)
    }
  }

  return res.status(200).json({ ok: true })
}

export async function POST(
  req: MedusaRequest<TikTokWebhookPayloadType>,
  res: MedusaResponse
) {
  const signature = String(
    req.headers["x-tiktok-signature"] ??
      req.headers["x-signature"] ??
      req.headers["x-hub-signature-256"] ??
      ""
  )

  const { result } = await ingestTikTokWebhookWorkflow(req.scope).run({
    input: {
      body: req.validatedBody,
      connection_id: req.params.id,
      raw_body: (req as any).rawBody?.toString("utf8"),
      signature: signature || undefined,
    },
  })

  if (!result.accepted && result.reason === "INVALID_SECRET") {
    return res.status(401).json({ accepted: false, error: "Invalid signature" })
  }
  if (!result.accepted) {
    return res.status(404).json({ accepted: false })
  }

  return res.status(200).json(result)
}
