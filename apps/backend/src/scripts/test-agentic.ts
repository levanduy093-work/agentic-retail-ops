import { MedusaContainer } from "@medusajs/framework/types";
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations";
import AgentOperationsModuleService from "../modules/agent-operations/service";

export default async function myScript({ container }: { container: MedusaContainer }) {
  const service = container.resolve<AgentOperationsModuleService>(AGENT_OPERATIONS_MODULE);
  
  // Find the latest inbound message
  const messages = await service.listAgentMessages({ direction: "INBOUND" }, { take: 1, order: { occurred_at: "DESC" } });
  if (!messages.length) {
    console.log("No inbound messages found");
    return;
  }
  
  const msg = messages[0];
  console.log(`Found message: ${msg.body} (ID: ${msg.id})`);
  
  try {
    const result = await service.processCustomerMessageAgentic({ inbound_message_id: msg.id });
    console.log("Result:", result);
  } catch (err) {
    console.error("ERROR running Agentic:", err);
  }
}
