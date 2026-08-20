import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../../modules/agent-operations/service"
import { MessengerWebhookPayloadType } from "../../../../admin/agent-operations/validators"
import { ingestMessengerWebhookWorkflow } from "../../../../../workflows/agent-operations/ingest-messenger-webhook"
import type { FacebookMessengerChannelConfig } from "../../../../../modules/agent-operations/facebook"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const mode = req.query["hub.mode"] as string | undefined
  const token = req.query["hub.verify_token"] as string | undefined
  const challenge = req.query["hub.challenge"] as string | undefined

  if (mode !== "subscribe" || !challenge) {
    return res.status(400).send("Invalid verification request")
  }

  try {
    const service = req.scope.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const connection = await service.retrieveAgentChannelConnection(
      req.params.id
    )

    if (connection.channel !== "MESSENGER") {
      return res.status(404).send("Connection not found")
    }

    const config = connection.config as FacebookMessengerChannelConfig
    const expectedToken = config?.verify_token

    if (token && expectedToken && token === expectedToken) {
      return res.status(200).send(challenge)
    }

    return res.status(403).send("Verification token mismatch")
  } catch {
    return res.status(404).send("Connection not found")
  }
}

export async function POST(
  req: MedusaRequest<MessengerWebhookPayloadType>,
  res: MedusaResponse
) {
  const signature = String(req.headers["x-hub-signature-256"] ?? "")

  const { result } = await ingestMessengerWebhookWorkflow(req.scope).run({
    input: {
      body: req.validatedBody,
      connection_id: req.params.id,
      signature: signature || undefined,
      raw_body: (req as any).rawBody?.toString("utf8"),
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
