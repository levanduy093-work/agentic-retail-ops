import { RiskLevel } from "./types"

export type AgentCatalogStatus =
  | "planned"
  | "contracted"
  | "implemented-static"
  | "runtime-verified"
  | "production-ready"

export type AgentCatalogEntry = {
  id: string
  version: string
  name: string
  mission: string
  triggers: string[]
  tools: string[]
  required_foundations: string[]
  maximum_risk: RiskLevel
  status: AgentCatalogStatus
}

export const AGENT_FOUNDATIONS = [
  "event-contracts",
  "incident-state-machine",
  "task-orchestration",
  "policy-and-approval",
  "typed-tool-gateway",
  "knowledge-and-citations",
  "model-gateway",
  "evaluation-harness",
  "audit-and-outbox",
  "communication-channels",
  "rbac",
] as const

export const AGENT_CATALOG: AgentCatalogEntry[] = [
  {
    id: "policy-approval-agent",
    version: "0.1.0",
    name: "Policy & Approval Agent",
    mission: "Apply deterministic policy and route risky actions for approval.",
    triggers: ["agent.recommendation.created", "approval.decision.requested"],
    tools: ["approval.request", "approval.decide"],
    required_foundations: ["policy-and-approval", "rbac", "audit-and-outbox"],
    maximum_risk: "HIGH",
    status: "implemented-static",
  },
  {
    id: "event-triage-agent",
    version: "0.1.0",
    name: "Event Triage Agent",
    mission: "Validate, deduplicate and route operational events.",
    triggers: ["inventory.low", "order.exception", "integration.failed"],
    tools: ["incident.create", "task.create"],
    required_foundations: ["event-contracts", "incident-state-machine"],
    maximum_risk: "LOW",
    status: "implemented-static",
  },
  {
    id: "inventory-agent",
    version: "0.1.0",
    name: "Inventory Agent",
    mission: "Detect inventory risk and propose safe stock actions.",
    triggers: ["inventory.low", "inventory.reservation_changed"],
    tools: ["inventory.get-position", "inventory.execute-transfer"],
    required_foundations: ["typed-tool-gateway", "policy-and-approval"],
    maximum_risk: "HIGH",
    status: "implemented-static",
  },
  {
    id: "audit-compliance-agent",
    version: "0.1.0",
    name: "Audit & Compliance Agent",
    mission: "Record and inspect agent decisions, actions and evidence.",
    triggers: ["agent.*"],
    tools: ["audit.search", "trace.replay"],
    required_foundations: ["audit-and-outbox", "rbac"],
    maximum_risk: "READ_ONLY",
    status: "implemented-static",
  },
  ...[
    ["order-exception-agent", "Order Exception Agent", "Detect and coordinate stuck orders.", ["order.exception"], ["order.read", "task.create"]],
    ["fulfillment-agent", "Fulfillment Agent", "Monitor fulfillment flow and delivery SLA.", ["fulfillment.status_changed"], ["fulfillment.read", "task.create"]],
    ["customer-support-agent", "Customer Support Agent", "Draft cited customer responses for human review.", ["support.requested"], ["order.read", "knowledge.search", "response.draft"]],
    ["knowledge-curator-agent", "Knowledge Curator Agent", "Find knowledge gaps and propose governed updates.", ["knowledge.gap_detected"], ["knowledge.search", "knowledge.propose"]],
    ["returns-refund-agent", "Returns & Refund Agent", "Collect evidence and propose return or refund outcomes.", ["return.requested"], ["order.read", "return.propose"]],
    ["payment-fraud-watcher", "Payment & Fraud Watcher", "Escalate suspicious payments without autonomous financial action.", ["payment.anomaly"], ["payment.read", "incident.create"]],
    ["catalog-quality-agent", "Catalog Quality Agent", "Detect catalog quality and synchronization defects.", ["product.updated"], ["catalog.read", "task.create"]],
    ["pricing-promotion-analyst", "Pricing & Promotion Analyst", "Analyze margin and promotion effectiveness.", ["promotion.changed"], ["pricing.read", "analytics.query"]],
    ["workforce-coordinator-agent", "Workforce Coordinator Agent", "Assign and escalate operational tasks by SLA.", ["task.created", "task.overdue"], ["task.assign", "task.escalate"]],
    ["integration-watchdog-agent", "Integration Watchdog Agent", "Detect connector, webhook and queue failures.", ["integration.failed"], ["integration.read", "task.create"]],
    ["incident-commander-agent", "Incident Commander Agent", "Coordinate owners, checklists and incident updates.", ["incident.escalated"], ["incident.update", "task.create", "message.send"]],
    ["owner-briefing-agent", "Owner Briefing Agent", "Deliver a cited operational risk briefing.", ["briefing.scheduled"], ["analytics.query", "knowledge.search", "message.send"]],
    ["analytics-agent", "Analytics Agent", "Produce governed operational insights from defined metrics.", ["analytics.requested"], ["analytics.query", "report.draft"]],
  ].map(([id, name, mission, triggers, tools]) => ({
    id: id as string,
    version: "0.1.0",
    name: name as string,
    mission: mission as string,
    triggers: triggers as string[],
    tools: tools as string[],
    required_foundations: [
      "task-orchestration",
      "policy-and-approval",
      "knowledge-and-citations",
      "model-gateway",
      "evaluation-harness",
      "audit-and-outbox",
      "communication-channels",
      "rbac",
    ],
    maximum_risk: "HIGH" as RiskLevel,
    status:
      id === "order-exception-agent"
        ? ("runtime-verified" as AgentCatalogStatus)
        : id === "workforce-coordinator-agent"
          ? ("implemented-static" as AgentCatalogStatus)
          : ("contracted" as AgentCatalogStatus),
  })),
]

export function getAgentCatalogReadiness() {
  return AGENT_CATALOG.map((agent) => ({
    ...agent,
    foundation_coverage: agent.required_foundations.map((foundation) => ({
      foundation,
      available: AGENT_FOUNDATIONS.includes(foundation as never),
    })),
  }))
}
