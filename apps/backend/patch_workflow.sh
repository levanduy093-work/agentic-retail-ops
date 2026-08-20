#!/bin/bash
awk '
/service.processCustomerKnowledgeQuestion\(\{/ {
    print "        service.processCustomerMessageAgentic({ inbound_message_id: inbound.id })"
    skip = 1
    next
}
skip && /\}\)/ {
    skip = 0
    next
}
!skip {
    print
}
' src/workflows/agent-operations/answer-customer-knowledge-question.ts > tmp.ts && mv tmp.ts src/workflows/agent-operations/answer-customer-knowledge-question.ts
