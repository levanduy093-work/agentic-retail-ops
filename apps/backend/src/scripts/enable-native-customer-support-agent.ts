import { ExecArgs } from "@medusajs/framework/types"
import { configureManagedPromptWorkflow } from "../workflows/agent-operations/configure-managed-prompt"

export default async function enableNativeCustomerSupportAgent({
  container,
}: ExecArgs) {
  const { result } = await configureManagedPromptWorkflow(container).run({
    input: {
      actor_id: "development-operator",
      settings: { native_tool_loop_mode: "ACTIVE" },
    },
  })

  console.log(
    JSON.stringify(
      {
        native_tool_loop_mode: result.settings.native_tool_loop_mode,
        status: "NATIVE_CUSTOMER_SUPPORT_AGENT_ACTIVE",
      },
      null,
      2
    )
  )
}
