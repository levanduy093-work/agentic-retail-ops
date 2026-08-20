import { AdminSendDirectSupportMessage, AdminToggleConversationAi } from "../../../api/admin/agent-operations/validators"

describe("Direct Support Chat and AI Control Validators", () => {
  it("validates direct support message inputs", () => {
    const valid = AdminSendDirectSupportMessage.parse({
      body: "Chào bạn, mình là nhân viên cửa hàng đang hỗ trợ bạn.",
      client_message_id: "client-msg-123",
    })
    expect(valid.body).toBe("Chào bạn, mình là nhân viên cửa hàng đang hỗ trợ bạn.")
    expect(valid.client_message_id).toBe("client-msg-123")
  })

  it("rejects empty direct support message body", () => {
    expect(() =>
      AdminSendDirectSupportMessage.parse({
        body: "   ",
      })
    ).toThrow()
  })

  it("validates toggle conversation AI payload", () => {
    const pausePayload = AdminToggleConversationAi.parse({ paused: true })
    expect(pausePayload.paused).toBe(true)

    const resumePayload = AdminToggleConversationAi.parse({ paused: false })
    expect(resumePayload.paused).toBe(false)
  })
})
