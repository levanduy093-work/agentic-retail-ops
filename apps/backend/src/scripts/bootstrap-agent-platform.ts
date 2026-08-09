import { ExecArgs } from "@medusajs/framework/types"
import { bootstrapAgentPlatformWorkflow } from "../workflows/agent-operations/bootstrap-agent-platform"

export default async function bootstrapAgentPlatform({ container }: ExecArgs) {
  const { result } = await bootstrapAgentPlatformWorkflow(container).run({
    input: { actor_id: "system-bootstrap" },
  })

  console.log(JSON.stringify(result, null, 2))
}
