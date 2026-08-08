const { Client } = require('pg');

async function updateRefundReasons() {
  const client = new Client({
    connectionString: 'postgres://postgres:@localhost:5432/medusa-dtc-starter',
  });
  await client.connect();
  
  // Refund Reasons
  await client.query(`UPDATE refund_reason SET label = 'Lỗi vận chuyển', description = 'Hoàn tiền do thất lạc, chậm trễ hoặc giao nhầm' WHERE label = 'Shipping Issue';`);
  await client.query(`UPDATE refund_reason SET label = 'Điều chỉnh CSKH', description = 'Hoàn tiền như một khoản bồi thường cho sự cố' WHERE label = 'Customer Care Adjustment';`);
  await client.query(`UPDATE refund_reason SET label = 'Lỗi giá', description = 'Hoàn tiền để khắc phục lỗi giá hoặc sai chiết khấu' WHERE label = 'Pricing Error';`);
  
  console.log("Updated refund reasons");
  await client.end();
}
updateRefundReasons().catch(console.error);
