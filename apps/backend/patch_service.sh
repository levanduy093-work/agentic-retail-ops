#!/bin/bash
awk '
/class AgentOperationsModuleService extends MedusaService/ {
    print
    print "  // [AGENTIC REFACTOR] Phương thức mới sử dụng AgentEngine"
    print "  async processCustomerMessageAgentic(input: { inbound_message_id: string }, @MedusaContext() sharedContext: Context = {}) {"
    print "    const inbound = await this.retrieveAgentMessage(input.inbound_message_id, {}, sharedContext);"
    print "    const conversation = await this.retrieveAgentConversation(inbound.conversation_id, {}, sharedContext);"
    print "    "
    print "    // Load history"
    print "    const contextMessages = await this.listAgentMessages("
    print "      { conversation_id: inbound.conversation_id }, "
    print "      { take: 10 }, "
    print "      sharedContext"
    print "    );"
    print "    "
    print "    const formattedMessages = contextMessages.map(m => ({"
    print "      role: m.direction === \"INBOUND\" ? \"user\" : \"assistant\","
    print "      content: m.body || \"\""
    print "    }));"
    print "    "
    print "    // Khởi tạo AgentEngine"
    print "    const { AgentEngine } = await import(\"./agent-engine\");"
    print "    const credentials = await this.getActiveAiProviderCredentials(\"generation\", conversation.tenant_id);"
    print "    if (!credentials.length) throw new Error(\"No AI Provider\");"
    print "    "
    print "    const engine = new AgentEngine("
    print "      this.__container__,"
    print "      { customer_id: (conversation.metadata as Record<string, unknown>)?.customer_id as string, tenant_id: conversation.tenant_id },"
    print "      credentials[0].api_key,"
    print "      credentials[0].model"
    print "    );"
    print "    "
    print "    const systemPrompt = \"Bạn là tư vấn viên thời trang thông minh. Hãy dùng công cụ tìm kiếm để tư vấn cho khách. Trả lời ngắn gọn, tự nhiên, và luôn kiểm tra thông tin.\";"
    print "    const answer = await engine.runCustomerSupportSession(systemPrompt, formattedMessages);"
    print "    "
    print "    return { body: answer, disposition: \"ANSWER\", grounded: true, citations: [], product_media: [] };"
    print "  }"
    next
}
1
' src/modules/agent-operations/service.ts > tmp_service.ts && mv tmp_service.ts src/modules/agent-operations/service.ts
