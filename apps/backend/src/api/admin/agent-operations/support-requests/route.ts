import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ingestSupportRequestWorkflow } from "../../../../workflows/agent-operations/ingest-support-request"
import { AdminIngestSupportRequestType } from "../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<AdminIngestSupportRequestType>,
  res: MedusaResponse
) {
  const { result } = await ingestSupportRequestWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.status(result.duplicate ? 200 : 201).json(result)
}
