import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import {
  buildCustomerConversationContext,
  startsExplicitNewProductTopic,
} from "../modules/agent-operations/conversation-memory"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"

export default async function verifyCustomerContextBoundaries({
  container,
}: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const runId = `verify-context-boundaries-${Date.now()}`
  const customerId = `qa-customer:${runId}`
  const conversationId = `qa-conversation:${runId}`

  try {
    await service.recordExplicitCustomerPreferences({
      conversation_id: conversationId,
      customer_id: customerId,
      message: "Mình cần áo khoác size M khoảng 600 nghìn.",
      message_id: `${runId}:first`,
      tenant_id: "default",
    })
    await service.recordExplicitCustomerPreferences({
      conversation_id: conversationId,
      customer_id: customerId,
      message: "Vẫn size M nhé.",
      message_id: `${runId}:confirmed`,
      tenant_id: "default",
    })

    const preferences = await service.listAgentCustomerPreferences({
      customer_id: customerId,
      tenant_id: "default",
    })
    assert.equal(preferences.length, 1)
    assert.equal(preferences[0].value, "M")
    assert.equal(preferences[0].status, "CONFIRMED")
    assert.ok(new Date(preferences[0].expires_at).getTime() > Date.now())

    const currentOnly = buildCustomerConversationContext({
      current_summary: "Khách đang xem áo thun mới.",
    })
    assert.match(currentOnly, /áo thun/iu)
    assert.doesNotMatch(currentOnly, /áo khoác|size M/iu)
    assert.equal(
      startsExplicitNewProductTopic("Tôi muốn mua áo thun mới."),
      true
    )

    const referencedProfile = buildCustomerConversationContext({
      current_summary: "Khách nói vẫn size M.",
      profile_preferences: ["Size M (đã xác nhận, hết hạn 16/2/2027)"],
    })
    assert.match(referencedProfile, /Customer profile preferences/u)
    assert.match(referencedProfile, /Size M/u)

    console.log(
      JSON.stringify({
        confirmed_preference: preferences[0].value,
        current_conversation_only: true,
        explicit_reference_only: true,
        new_topic_isolated: true,
        passed: true,
      })
    )
  } finally {
    const preferences = await service.listAgentCustomerPreferences({
      customer_id: customerId,
      tenant_id: "default",
    })
    if (preferences.length) {
      await service.deleteAgentCustomerPreferences(
        preferences.map((preference) => preference.id)
      )
    }
  }
}
