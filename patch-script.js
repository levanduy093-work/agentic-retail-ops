const fs = require('fs');
const file = 'node_modules/.pnpm/@medusajs+order@2.18.0_patch_hash=fww7fu6vhnwcan2guug3dkoe7e_@medusajs+framework@2.18.0_@medu_kkn7dts5v2jj646bts37n6amqy/node_modules/@medusajs/order/dist/utils/apply-order-changes.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace('shipping_method_id: associatedMethodId,', 'shipping_method_id: associatedMethodId,\n                    order_id: order.id,');
fs.writeFileSync(file, content);
console.log("Patched!");
