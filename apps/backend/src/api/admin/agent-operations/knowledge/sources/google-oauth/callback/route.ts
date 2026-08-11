import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { verifyGoogleKnowledgeOAuthState } from "../../../../../../../modules/agent-operations/google-knowledge-oauth"
import { connectGoogleKnowledgeWorkflow } from "../../../../../../../workflows/agent-operations/connect-google-knowledge"
import { AdminGoogleKnowledgeOAuthCallbackType } from "../../../../validators"

const OAUTH_NONCE_COOKIE = "agent_google_oauth_nonce"
const CALLBACK_PATH =
  "/admin/agent-operations/knowledge/sources/google-oauth/callback"

function readCookie(header: string | undefined, name: string) {
  const entry = header
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ""
}

export async function GET(
  req: AuthenticatedMedusaRequest & {
    validatedQuery: AdminGoogleKnowledgeOAuthCallbackType
  },
  res: MedusaResponse
) {
  const query = req.validatedQuery
  if (query.error || !query.code || !query.state) {
    return res.redirect("/app/knowledge-hub?google=cancelled")
  }
  const nonce = readCookie(req.headers.cookie, OAUTH_NONCE_COOKIE)
  const state = verifyGoogleKnowledgeOAuthState({
    actor_id: req.auth_context.actor_id,
    nonce,
    state: query.state,
  })
  await connectGoogleKnowledgeWorkflow(req.scope).run({
    input: {
      actor_id: req.auth_context.actor_id,
      code: query.code,
      tenant_id: state.tenant_id,
    },
  })
  res.clearCookie(OAUTH_NONCE_COOKIE, { path: CALLBACK_PATH })
  return res.redirect("/app/knowledge-hub?google=connected")
}
