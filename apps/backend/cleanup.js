const { Client } = require("pg")

const client = new Client({
  connectionString: "postgres://postgres:@localhost:5432/medusa-dtc-starter",
})

async function run() {
  await client.connect()
  const res = await client.query(`
    DELETE FROM auth_identity
    WHERE provider = 'google-one-tap'
      AND app_metadata->>'customer_id' NOT IN (SELECT id FROM customer);
  `)
  console.log(`Deleted ${res.rowCount} orphaned auth_identities.`)
  await client.end()
}

run().catch(console.error)
