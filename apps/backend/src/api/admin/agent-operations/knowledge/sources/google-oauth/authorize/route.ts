import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { createGoogleKnowledgeAuthorization } from "../../../../../../../modules/agent-operations/google-knowledge-oauth"

const OAUTH_NONCE_COOKIE = "agent_google_oauth_nonce"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const authorization = createGoogleKnowledgeAuthorization({
    actor_id: req.auth_context.actor_id,
    tenant_id: "default",
  })
  res.cookie(OAUTH_NONCE_COOKIE, authorization.nonce, {
    httpOnly: true,
    maxAge: 10 * 60 * 1000,
    path:
      "/admin/agent-operations/knowledge/sources/google-oauth/callback",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
  res.status(200).json({ authorization_url: authorization.authorization_url })
}
