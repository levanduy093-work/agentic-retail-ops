import { model } from "@medusajs/framework/utils"

const AgentCustomerPreference = model
  .define("agent_customer_preference", {
    id: model.id({ prefix: "agpref" }).primaryKey(),
    tenant_id: model.text().default("default"),
    customer_id: model.text(),
    preference_type: model.enum(["SIZE", "STYLE", "MEASUREMENTS"]),
    value: model.text(),
    status: model.enum(["CUSTOMER_STATED", "CONFIRMED"]),
    source_conversation_id: model.text(),
    source_message_id: model.text(),
    last_confirmed_at: model.dateTime(),
    expires_at: model.dateTime(),
  })
  .indexes([
    {
      name: "IDX_agent_customer_preference_customer_type",
      on: ["tenant_id", "customer_id", "preference_type"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_agent_customer_preference_expiry",
      on: ["tenant_id", "expires_at"],
      where: "deleted_at IS NULL",
    },
  ])

export default AgentCustomerPreference
