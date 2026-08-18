const fs = require('fs');
const file = '/Users/levanduy/agentic-retail-ops/node_modules/.pnpm_patches/@medusajs/order@2.18.0/dist/utils/apply-order-changes.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace('shipping_method_id: associatedMethodId,', 'shipping_method_id: associatedMethodId,\n                    order_id: order.id,');
fs.writeFileSync(file, content);
console.log("Patched!");
