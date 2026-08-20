import { MedusaContainer } from "@medusajs/framework/types";
import { AGENT_OPERATIONS_MODULE } from "./src/modules/agent-operations";

export default async function myScript({ container }: { container: MedusaContainer }) {
  const service = container.resolve(AGENT_OPERATIONS_MODULE);
  const convos = await service.listAgentConversations({ channel: "MESSENGER" });
  for (const conv of convos) {
    if (conv.title && conv.title.match(/^Facebook — \d+$/)) {
      const psid = conv.title.split(" — ")[1];
      const connId = conv.metadata.connection_id;
      const conn = await service.retrieveAgentChannelConnection(connId);
      const token = await service.resolveChannelBotToken(conn);
      
      const res = await fetch(`https://graph.facebook.com/${psid}?fields=name&access_token=${token}`);
      if (res.ok) {
        const data = await res.json();
        if (data.name) {
          await service.updateAgentConversations({
            id: conv.id,
            title: `Facebook — ${data.name}`
          });
          console.log(`Updated ${psid} to ${data.name}`);
        }
      }
    }
  }
}
