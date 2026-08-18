const { Client } = require('pg');
require('dotenv').config();
async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query("SELECT * FROM fulfillment ORDER BY created_at DESC LIMIT 10");
  console.log("Fulfillments:", res.rows);
  await client.end();
}
run();
