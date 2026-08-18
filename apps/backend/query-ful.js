const { Client } = require('pg');
require('dotenv').config();
async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query("SELECT id, provider_id, deleted_at FROM fulfillment");
  console.log("Fulfillments in DB:", res.rows);
  await client.end();
}
run();
