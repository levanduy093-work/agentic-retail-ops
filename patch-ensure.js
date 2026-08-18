const fs = require('fs');
const file = 'apps/backend/src/workflows/shipping-hub/ensure-ghn-order-fulfillment.ts';
let content = fs.readFileSync(file, 'utf8');

const target = `const existing = typedOrder.fulfillments?.find(
          (fulfillment) => fulfillment?.provider_id === "ghn" || fulfillment?.provider_id === "fulfillment_ghn" || fulfillment?.provider_id === "ghn_ghn"
        )`;

const replacement = `const { data: orderFulfillments } = await query.graph({
          entity: "order",
          fields: ["fulfillments.id", "fulfillments.provider_id"],
          filters: { id: input.order_id }
        })
        const fulfillments = orderFulfillments[0]?.fulfillments ?? []
        const existing = fulfillments.find(
          (fulfillment: any) => fulfillment?.provider_id === "ghn" || fulfillment?.provider_id === "fulfillment_ghn" || fulfillment?.provider_id === "ghn_ghn"
        )`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content);
