# Agent Platform Foundation

## 1. Purpose

This document defines the architectural foundation required before turning the roles listed in [`AGENT_CATALOG.md`](./AGENT_CATALOG.md) into functioning agents.

The objective is not to immediately launch 17 standalone AI processes. Rather, it is to build a unified operational foundation so that each agent capability can:

- Ingest the correct business events;
- Read authorized, provenance-backed data;
- Produce structured conclusions and recommendations;
- Request human approval when actions carry risk;
- Execute mutations exclusively through governed business APIs and workflows;
- Prevent duplicate processing and revalidate data prior to writes;
- Maintain a complete audit trail for human review, takeover, and evaluation.

## 2. Current State Clarifications

### Existing Capabilities

- Medusa backend is the system of record for catalog, customers, carts, orders, payments, fulfillments, inventory, promotions, and commerce configurations.
- Medusa Admin provides the business administration UI.
- Next.js storefront provides the customer shopping and account flows.
- PostgreSQL is the primary database.
- Backend has reference examples of route-invoked workflows (e.g., Google customer linking).
- `AGENT_CATALOG.md` outlines the 17 target agent capabilities.

### Added in Initial Vertical Slice

- Custom module `agent-operations` and migrations for events, incidents, runs, recommendations, approvals, audits, and outbox.
- Contract and validator for `inventory.low`.
- State machines, event deduplication, deterministic inventory recommendations, and approval decision idempotency.
- Admin APIs for events, incidents, and approvals.
- Medusa RBAC-compatible policy declarations for agent resources.
- Unit tests and module service/database runtime verification scripts.
- Scheduled outbox dispatcher with optimistic claiming, lease expiry, exponential backoff, dead-lettering, and message idempotency metadata.
- Typed tool registry including `inventory.get-position@1.0.0`, `inventory.execute-transfer@1.0.0`, `knowledge.search@1.0.0`, `audit.search@1.0.0`, `trace.replay@1.0.0`, `task.create@1.0.0`, `task.assign@1.0.0`, `task.escalate@1.0.0`, `incident.create@1.0.0`, `incident.update@1.0.0`, `approval.request@1.0.0`, `approval.decide@1.0.0`, `knowledge.propose@1.0.0`, and `message.send@1.0.0`.
- Shared `AgentToolDefinition` and executor validating input/output schemas, versions, permissions, risk/approval rules, timeout/retry/idempotency contracts, and rejecting commands bypassing the Action Gateway. Three platform read tools have live runtimes via module services and executors; nine platform/task commands route through request gateway, policies, and workers; active coverage is 15/24 catalog tools.
- Action request/tool-call persistence, Action Gateway workflow, and scheduled action worker with leases, retries, dead-lettering, and idempotency. Action envelopes support optional incident/recommendation/approval contexts; missing an ACTIVE policy causes fail-closed rejection without creating actions.
- Supervisor job running every minute: expires overdue approvals via workflows with audit/outbox logging, and emits idempotent `task.escalate` requests for past-deadline tasks; supervisor never directly writes commerce records.
- Inventory Action Gateway reads live `available_quantity` from Medusa under locks, revalidates approval/state/tool contracts, and adjusts both stock levels.
- Safe conflict handling transitions incidents from `EXECUTING` back to `OPTIONS_READY`; successful mutations include compensation logic and transition `MONITORING -> RESOLVED`.
- `IN_APP` Communication Gateway with conversation/message persistence, notification subscribers, and structured idempotent `APPROVAL_DECISION` commands.
- Admin APIs to read conversations/messages and submit commands; commands route through existing policies, approval workflows, and Action Gateway.

### Not Yet Implemented

- Agent planner/supervisor using LLMs to autonomously select tools; tools are currently invoked by deterministic workflows and workers.
- Trigger/SLA scheduler automatically dispatching `task.assign` and `task.escalate` from `task.created` or `task.overdue`.
- Multi-process production verification for Event Bus, distributed locking, and subscriber idempotency/replay tooling.
- Telegram adapter has webhook secrets, identity allowlists, and delivery receipt/retry logic, but lacks end-to-end acceptance testing with a live bot. Mobile/PWA, push notifications, and Zalo/Slack/Teams/Messenger provider adapters remain unbuilt.
- LLM translation of free-form chat into structured commands with evaluation harnesses.
- Automated ingestion connectors and vector retrieval for Knowledge; lifecycle, versioning, approvals, and chunk citations are implemented.
- Detailed UI for requesting/executing task tools and viewing direct gateway timelines.
- Dedicated scenario for Workforce Coordinator beyond runtime verification scripts.

Consequently, the first four capabilities remain at `implemented-static`. Safe conflict handling has local database/runtime proof, but happy-path inventory transfer across two live stock locations, real-user RBAC, and multi-process production Event Bus/locking remain necessary gates before certifying end-to-end `runtime-verified`.

## 3. Mandatory Architectural Boundaries

### 3.1 Medusa Remains the System of Record

Medusa owns and decides the definitive state for:

- Products, variants, prices, and promotions;
- Customers, carts, and orders;
- Payments, refunds, and returns;
- Fulfillments, reservations, stock locations, and sellable inventory.

Agents must not write directly to core Medusa database tables and must not recalculate values governed by Medusa (e.g., available inventory, total pricing, refund conditions, or promotion eligibility).

### 3.2 Agent Operations Owns Orchestration State

The Agent Operations module owns:

- Canonical events and event inboxes;
- Incidents and cases;
- Agent runs and execution steps;
- Evidence, recommendations, and confidence scores;
- Approvals, rejections, expirations, and escalations;
- Action requests, tool calls, and execution results;
- Human tasks;
- Audit trails and evaluation results.

### 3.3 All Mutations Must Follow a Single Route

```text
Agent
  -> Typed Tool
  -> Action Gateway
  -> Authentication / Authorization
  -> Policy / Risk / Approval Check
  -> Idempotency / State Revalidation
  -> Medusa Workflow or Application Service
  -> Transaction + Outbox
  -> Domain Event + Audit
```

Workers, LLMs, Admin UI, and external connectors are strictly prohibited from bypassing this boundary.

### 3.4 Deterministic Rules Hold Final Authority

LLMs may classify, summarize, and recommend. Deterministic code must enforce:

- Access permissions;
- Risk levels and approval requirements;
- Monetary amounts, inventory quantities, and thresholds;
- Validity criteria for refunds, returns, and promotions;
- Idempotency;
- Pre-mutation state verification;
- Authorized execution scopes.

## 4. Required Platform Foundations

### 4.1 Domain and Ownership Standardization

Establish an ownership matrix for every entity and command prior to implementing new agents. Each entry must declare:

- System of record;
- Read API;
- Permitted commands;
- Executing workflow;
- Authorized roles;
- Risk level;
- Approval requirement;
- Mandatory audit fields.

No two modules may share concurrent ownership of inventory, order, or payment state.

### 4.2 Canonical Event Contract

All events ingested into Agent Operations must follow a unified envelope:

```ts
type CanonicalEvent<TPayload> = {
  eventId: string
  eventType: string
  eventVersion: number
  occurredAt: string
  receivedAt: string
  source: string
  tenantId: string
  correlationId: string
  causationId?: string
  subjectType: string
  subjectId: string
  payload: TPayload
}
```

Requirements:

- Events are immutable upon persistence;
- Unique by source and source event ID;
- Consumer deduplication prior to triggering workflow runs;
- Explicit schema versions and migration strategies;
- Payloads validated against strict schemas;
- Sensitive data excluded from raw payloads and logs.

Initial standard domain events:

- `order.placed`
- `order.fulfillment_at_risk`
- `inventory.low`
- `inventory.reservation_changed`
- `payment.failed`
- `return.requested`
- `approval.decided`
- `action.executed`
- `action.failed`

### 4.3 Agent State and State Machine

Agent state must not reside solely in transient process memory. Each run must follow standard state transitions:

```text
RECEIVED
  -> INVESTIGATING
  -> OPTIONS_READY
  -> AWAITING_APPROVAL
  -> EXECUTING
  -> MONITORING
  -> RESOLVED
```

Terminal branches:

```text
REJECTED | CANCELLED | FAILED | ESCALATED
```

Every transition must log actor, timestamp, reason, input references, correlation ID, and previous state. Invalid transitions must be rejected.

### 4.4 Typed Tool Registry

Every tool definition must declare:

- Name and version;
- Business purpose;
- Input and output schemas;
- Classification as read or command;
- Required permissions;
- Risk level;
- Approval rules;
- Timeout, retry, and idempotency behavior;
- Error taxonomy;
- Audit fields;
- Test contracts.

Implemented in `tool-contract.ts` and executed via `tool-executor.ts`. API coverage metrics must distinguish between active registered tools and catalog declarations. Platform read tools use `read-tool-runtime.ts`; knowledge search retrieves only valid `APPROVED` documents, audit search mandates query filters, and trace replay chronologically collates events, runs, actions, tool calls, audits, and outbox logs.

Initial core tool groups:

```text
order.get
order.list-at-risk
inventory.get-position
inventory.get-availability
inventory.propose-transfer
inventory.execute-transfer
approval.request
approval.get-decision
task.create
notification.create-draft
```

The name `execute-*` does not grant autonomous execution; the Action Gateway must independently verify policies, approvals, and fresh state.

### 4.5 Policy and Approval

Construct a policy matrix mapping `action type x risk x actor x amount/quantity`.

Standard risk levels:

- `READ_ONLY`: Read-only queries and analysis;
- `LOW`: Fully automatable if permitted by policy;
- `MEDIUM`: May require confirmation or sampling review;
- `HIGH`: Mandatory approval by designated role;
- `PROHIBITED`: Disallowed for agent invocation.

Approval records must include:

- Request ID and immutable action proposal;
- Requester identity and agent run ID;
- Risk level and policy version;
- Required approver role;
- Status (`pending`, `approved`, `rejected`, `expired`, `cancelled`);
- Decision actor, reason, and timestamp;
- Expiration time;
- Evidence snapshot/reference;
- Execution status and result reference.

Approvals only grant permission to attempt execution. Workers must revalidate inventory, orders, prices, SLAs, or payment states immediately prior to mutation. If state has changed, a safe conflict must be returned without applying outdated approvals.

### 4.6 Idempotency, Transactions, and Outbox

Every mutation command must carry an idempotency key. Matching keys with identical inputs must produce a single business result; matching keys with conflicting inputs must be rejected.

Within a single transaction, atomically persist:

1. Domain state changes;
2. Execution result;
3. Audit record;
4. Outbox event.

Outbox workers must track:

- Delivery status;
- Attempt count;
- Availability timestamp;
- Lock owner and lock expiry;
- Last error details;
- Dead-letter and escalation policies.

Retries must never create duplicate refunds, stock transfers, notifications, or tasks.

### 4.7 Audit and Observability

Audit logs must be append-only and answer:

- Who or which agent performed the action;
- Which tool, version, model, and prompt were used;
- What underlying data and documents were referenced;
- Which policy was evaluated;
- Who approved the action;
- How inputs and outputs were redacted;
- Final mutation outcome (success or failure);
- Correlation IDs to trace the full flow.

Core operational metrics:

- Event-to-case latency;
- Time-to-recommendation;
- Approval wait time;
- Execution success and conflict rates;
- Duplicate suppression counts;
- Tool error and retry rates;
- Human override rates;
- False positive/negative rates per scenario;
- Token usage and cost tracking for LLMs.

### 4.8 Human Operations UI

Leverage Medusa Admin before building separate consoles. Initial screens:

- `Incident Queue`: Case list, priorities, SLAs, and owners;
- `Incident Detail`: Timelines, evidence, recommendations, and tasks;
- `Approval Inbox`: Approve/reject flows with mandatory reasons and impact previews;
- `Agent Trace`: Events, tool calls, model outputs, policies, and execution results;
- `Task Board`: Human action items and escalations.

UI clicks are not treated as the sole source of truth; all decisions route through Admin APIs and workflows with audit logging.

### 4.9 Knowledge Foundation

Deploy RAG only after tool, policy, and approval layers are stable. Knowledge records must include:

- Document ID, version, and owner;
- Status (`DRAFT`, `APPROVED`, `RETIRED`);
- Effective and expiration timestamps;
- Scope, tenant, and locale;
- Source provenance and checksums;
- Citation locator;
- Access policies.

Agents may only reference valid, `APPROVED` documents for business decisions. Missing evidence must trigger questions or escalations, never assumptions.

Baseline includes `agent_knowledge_chunk`: documents are segmented into stable chunks upon creation, each with its own checksum and locator. Queries filter by tenant/scope/locale and valid approved status. Admin provides Knowledge Hub (VI/EN) to manage drafts, approvals, deprecations, and test queries; reindex script generates chunks for pre-migration documents.

### 4.10 Security and Tenant Boundaries

Prior to enabling agent commands, ensure:

- Dedicated service identities for workers;
- Least-privilege permissions per tool;
- Scoping by tenant, store, sales channel, and location;
- Secret references rather than raw tokens;
- PII redaction across prompts, traces, and logs;
- Rate limits and execution budgets;
- Emergency kill switches by agent, action type, and tenant;
- Prevention of arbitrary tool names or unbounded queries generated from user prompts.

## 5. Proposed Source Structure

Maintain a modular monolith for the control plane, separating background execution workers:

```text
apps/
  backend/
    src/
      modules/
        agent-operations/
        approval/
        audit/
        policy/
      workflows/
        agent-operations/
        action-gateway/
      subscribers/
        agent-events/
      api/
        admin/
          agent-operations/
      admin/
        routes/
          agent-operations/
        widgets/
  agent-worker/
    src/
      consumers/
      executors/
      scheduler/
      runtime/
packages/
  agent-contracts/
  agent-domain/
  agent-evaluation/
```

Dependency guidelines:

- `agent-domain` contains pure types, deterministic rules, and state transitions;
- `agent-contracts` contains event/tool/API schemas, without DB clients;
- backend owns module services, workflows, and database transactions;
- workers call typed APIs and the Action Gateway exclusively;
- Admin UI communicates only via Admin APIs;
- LLM adapters must not import repositories or Medusa services directly for mutations.

Updating `packages/**` requires modifying `pnpm-workspace.yaml`. New tasks must declare proper `outputs` in `turbo.json`.

## 6. Upgrading `AGENT_CATALOG.md`

Each agent specification must conform to this schema:

```yaml
id: inventory-agent
name: Inventory Agent
version: 0.1.0
status: planned
business_owner: Operations
technical_owner: Agent Platform
mission: Detect inventory risk and prepare safe resolution options
triggers: []
reads: []
tools: []
prohibited_actions: []
risk_level: medium
approval_rules: []
state_machine: []
human_handoff: []
sla: {}
metrics: []
scenarios: []
dependencies: []
```

Every agent contract must clarify:

1. What business outcome is the agent responsible for?
2. Which events or schedules trigger it?
3. Which entities is it permitted to read?
4. Which tools can it invoke?
5. What actions are strictly prohibited?
6. Which actions require approval, and from which roles?
7. When must the agent halt and hand off to a human?
8. What state is persisted?
9. What are its operational SLAs and success metrics?
10. Which test scenarios validate correct and safe execution?

Allowed `status` values:

- `planned`: Initial design only;
- `contracted`: Events, tools, policies, and scenarios approved;
- `implemented-static`: Code and static unit tests in place;
- `runtime-verified`: Validated across live APIs, workers, and databases;
- `production-ready`: Cleared security, load, recovery, and operational gates.

## 7. Agent Implementation Order

Do not build all 17 agents simultaneously. Focus first on an integrated vertical slice:

1. **Event Triage**: Ingest events and create incidents.
2. **Inventory or Order Exception**: Investigate and produce recommendations.
3. **Policy & Approval**: Determine approval requirements and manage decisions.
4. **Audit & Compliance**: Record and verify end-to-end execution traces.

Once stable, expand incrementally:

1. Fulfillment and Returns & Refund;
2. Catalog Quality and Pricing & Promotion;
3. Customer Support and Knowledge Curator;
4. Integration Watchdog and Incident Commander;
5. Workforce Coordinator, Owner Briefing, and Analytics.

These names represent business capabilities. They can share a common supervisor, worker, policy engine, and Action Gateway rather than requiring 17 distinct microservices.

## 8. Proposed First Vertical Slice

### Scenario: Order at Risk of Inventory Stockout

1. Inventory/order event arrives in the event inbox.
2. Event Triage generates a single incident, deduplicating resubmitted events.
3. Agent reads order, reservation, and stock availability via typed read tools.
4. Deterministic rules compute shortfall and valid resolution options.
5. Agent produces recommendations backed by evidence and impact assessments.
6. Policy classifies inventory transfer as a high-risk action.
7. Operations Manager reviews and approves/rejects in Admin.
8. Worker receives `approval.decided`.
9. Action Gateway verifies permissions, idempotency, and fresh state.
10. Medusa workflow executes or returns a safe conflict.
11. Outbox emits execution results; incident transitions to `MONITORING -> RESOLVED`.
12. All events, tool calls, approvals, mutations, and errors appear in Agent Trace.

Test fixtures must include at least two stock locations, asymmetric inventory balances, live order/reservation records, and clear expected outcomes.

## 9. Foundation Milestones

### M0 — Contracts and Ownership

- Finalize entity ownership, event envelopes, tool contracts, and risk matrices.
- Select initial vertical slice and write ground-truth test scenarios.
- No LLM integration.

### M1 — Persistence and Control Plane

- Create migrations and modules for event inboxes, incidents, runs, recommendations, approvals, tool calls, audits, and outbox.
- Implement state transitions, deduplication, and idempotency tests.

### M2 — Action Gateway and Workers

- Implement read tools, approval flows, and an initial command tool.
- Worker with leases, retries, dead-lettering, and safe conflict handling.
- Run end-to-end tests using deterministic rules.

### M3 — Human Operations Console

- Deploy Incident Queue, Incident Detail, Approval Inbox, and Agent Trace in Admin.
- Enforce roles, permissions, and audit logging with real user accounts.

### M4 — Governed LLM Integration

- Restrict LLMs to structured schema-compliant recommendations.
- Add prompt version tracking, PII redaction, token budgets, and evaluation harnesses.
- Benchmark deterministic-only vs. LLM-assisted outcomes on identical scenarios.

### M5 — Agent Catalog Expansion

- Promote subsequent agents to `contracted` only when events, tools, policies, scenarios, and human owners are ready.
- Treat external connectors as supplementary capabilities without compromising core commerce logic.

## 10. Definition of Ready for an Agent

An agent may only begin implementation when it has:

- A designated business owner;
- Explicit mission and out-of-scope boundaries;
- Trigger and event schemas;
- Entity ownership mappings;
- Typed read and command tool specifications;
- Risk and approval matrices;
- State machine definition;
- Human handoff and escalation triggers;
- Test scenarios defining initial state, triggers, expected actions, and forbidden actions;
- Defined success, safety, and latency metrics.

## 11. Definition of Done for an Agent

An agent is certified runtime verified only when:

- Duplicate events do not create redundant runs or actions;
- Invalid state transitions are rejected;
- Unauthorized tool calls are blocked;
- High-risk actions cannot execute without valid approval;
- Expired approvals or mutated state trigger safe conflicts;
- Retries produce zero duplicate side effects;
- Audit logs trace from initial trigger to final mutation;
- Humans can reject, cancel, retry, or take over cases;
- Happy and failure paths execute successfully across real APIs, workers, and databases;
- No sensitive credentials or PII appear in prompts or logs.

## 12. Immediate Priorities

The shared platform foundation is `implemented-static` and persistence/bootstrap is `runtime-verified` on local PostgreSQL. Focus shifts to building individual agent vertical slices:

1. Assign `operations_manager` role to production accounts; HTTP verification with temporary users confirmed 201 allow, 403 deny, and 401 unauthenticated.
2. Run happy-path inventory transfers with two real stock locations and verify competing actions on the same item under Redis locking.
3. Standardize where checkout/OMS sets `agent_payment_due_at` and `agent_fulfillment_due_at`; the 5-minute SLA detector runs live without writing directly to order tables.
4. Build Customer Support Agent using approved knowledge, citations, and `KNOW-001`; outputs remain draft responses awaiting human approval.
5. Select secret managers, model providers, and mobile/chat adapters following benchmark and security reviews; never store secrets in database tables or Admin clients.

## 13. Platform Baseline Code as of 2026-08-10

- 17 agents registered in machine-readable TypeScript catalog.
- 21 RBAC policies synced by Medusa from `definePolicies` and assigned to `operations_manager` role via idempotent bootstrap.
- Persistence and workflows for tasks, policy definitions, knowledge, prompts, model runs, evaluations, channel connections, and deliveries.
- Deterministic policy engine, task state machine, knowledge eligibility rules, citation checksum verification, model redaction/budget/schema gates, and assertion evaluators.
- Active registry with 15/24 tools. Six platform commands (`incident.create/update`, `approval.request/decide`, `knowledge.propose`, `message.send`) and three task commands connected to Action Gateway.
- Action requests record `authorized_roles` snapshots; executor enforces permissions and required roles during request and execution.
- Migration `Migration20260810132610` executed on local PostgreSQL; runtime verified `knowledge.propose` through gateway succeeds, task commands operate correctly, stale state returns `CONFLICT`, and requests lacking policies create no actions. Unit tests at 77/77. Order Exception runtime verifier created test orders via Medusa workflows, validating live reads, HTTP/RBAC, Action Gateway, tasks, audit/outbox, deduplication, and zero order mutations. This agent is certified `runtime-verified`; the 5-minute SLA detector confirmed first-create/second-dedupe, with production cursor/indexing remaining.
- Admin Operations Console and readiness APIs distinguish `code_ready` from `deployment_ready`.
- Redis Event Bus, Workflow Engine, and distributed locking connect at runtime when enabled; local development defaults safely to in-memory.
- OpenAI Responses adapter features structured outputs, timeouts, redactions, idempotent model-run ledgers, and deterministic fallbacks; providers remain disabled until keys/models are configured. Live external delivery providers remain disabled by design.

## 14. Knowledge Source Connector as of 2026-08-11

- Knowledge source models, Admin APIs, connection/sync workflows, and VI/EN Knowledge Hub UI.
- Knowledge sources restricted to Google OAuth and Google Picker: users explicitly select Google Docs, Google Sheets, or TXT/Markdown/CSV files from Google Drive. Arbitrary website scraping and related allowlists were removed to minimize attack surfaces and avoid operational complexity.
- Content changes generate `DRAFT` knowledge documents; managers must approve before agents can discover them. Checksums prevent duplicate drafts when source content is unchanged.
- Migration `Migration20260811060537` and runtime verifiers executed on local PostgreSQL. Migration `Migration20260811064334` expanded support for Google Docs, Sheets, and TXT/Markdown/CSV files on Drive. Migration `Migration20260811122426` removed legacy website source types from active schemas. Two related verifier documents remain `RETIRED`, preventing agent access.
- Google adapter uses per-store OAuth connectors. Store owners connect, authenticate with Google, and select files via Google Picker; `drive.file` scope restricts access strictly to chosen files. Refresh tokens are AES-256-GCM encrypted in `agent_connector_credential`, callbacks verify signed state/nonce/expiration, and connect/disconnect flows are audited.
- Migration `Migration20260811080525` executed; build, lint, and 128 unit tests pass. Live Google API acceptance remains `RUNTIME-PENDING` pending production OAuth client, Picker API key, and project configuration. Notion/PDF, background sync schedules, and diff reviews remain future work.
