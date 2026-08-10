import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ingestOrderExceptionEventWorkflow } from "../../../../workflows/agent-operations/ingest-order-exception-event"
import { AdminIngestOrderExceptionEventType } from "../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminIngestOrderExceptionEventType>,
  res: MedusaResponse
) {
  const { result } = await ingestOrderExceptionEventWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.status(result.duplicate ? 200 : 201).json(result)
}
