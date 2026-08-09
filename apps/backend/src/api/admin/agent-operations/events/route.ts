import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ingestInventoryLowEventWorkflow } from "../../../../workflows/agent-operations/ingest-inventory-low-event"
import { AdminIngestInventoryLowEventType } from "../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminIngestInventoryLowEventType>,
  res: MedusaResponse
) {
  const { result } = await ingestInventoryLowEventWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.status(result.duplicate ? 200 : 201).json(result)
}
