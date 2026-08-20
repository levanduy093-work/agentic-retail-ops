import fs from 'fs';

let code = fs.readFileSync('src/modules/agent-operations/service.ts', 'utf8');

const target = `    return { body: answer, disposition: "ANSWER", grounded: true, citations: [], product_media: [], delivery_id: undefined, response_message_id: undefined, support_task_id: undefined } as any;`;

const replacement = `
    const now = new Date();
    const responseIdempotencyKey = \`message:agent:\${input.inbound_message_id}\`;
    
    // Check if we already responded to this message to prevent duplicates
    const existingResponses = await this.listAgentMessages({ idempotency_key: responseIdempotencyKey }, { take: 1 }, sharedContext);
    if (existingResponses.length > 0) {
       return { duplicate: true, response_message_id: existingResponses[0].id };
    }

    const response = await this.createAgentMessages(
      {
        body: answer,
        channel: conversation.channel,
        conversation_id: conversation.id,
        direction: "OUTBOUND",
        idempotency_key: responseIdempotencyKey,
        message_type: "TEXT",
        occurred_at: now,
        sender_id: "customer-knowledge-agent",
        sender_type: "agent",
        status: "AVAILABLE",
        structured_content: {
          grounded: true,
          disposition: "ANSWER",
          inbound_message_id: inbound.id,
          product_ids: [],
          citations: []
        },
      },
      sharedContext
    );

    const delivery = await this.createAgentDeliveries(
      {
        attempt_count: 0,
        available_at: now,
        channel: conversation.channel,
        connection_id: inbound.connection_id || "default", 
        idempotency_key: \`message:\${response.id}:delivery\`,
        message_id: response.id,
        status: "PENDING",
      },
      sharedContext
    );

    await this.updateAgentConversations(
      { id: conversation.id, last_message_at: now },
      sharedContext
    );

    this.broadcastMessageCreated(response);
    this.broadcastConversationUpdated({
      channel: conversation.channel,
      id: conversation.id,
      last_message_at: now,
      title: conversation.title,
    });

    return { 
      body: answer, 
      disposition: "ANSWER", 
      grounded: true, 
      citations: [], 
      product_media: [],
      delivery_id: delivery.id,
      response_message_id: response.id,
      support_task_id: null
    } as any;
`;

code = code.replace(target, replacement);
fs.writeFileSync('src/modules/agent-operations/service.ts', code);
console.log("Saved.");
