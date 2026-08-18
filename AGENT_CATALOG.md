# Agent Catalog

## Status Definitions

- `planned`: Target capabilities defined only.
- `contracted`: Triggers, tools, policies, and scenarios finalized.
- `implemented-static`: Code and static tests exist, but end-to-end runtime evidence is incomplete.
- `runtime-verified`: Verified through real APIs, workers, and live databases.
- `production-ready`: Passed security, recovery, load, and operational gates.

Do not infer `database-verified` as `runtime-verified`. Worker execution, revalidation against the latest Medusa data, real-account RBAC, and Admin UI remain separate gates.

## Implementation Status

| Agent Capability | Status | Implemented Scope | Remaining Gates |
| --- | --- | --- | --- |
| Policy & Approval Agent | `implemented-static` | HIGH policy for inventory transfer proposals; `approval.request/decide` with typed contract, role gates, and Action Gateway; approvals include expiry, reason, and actor; RBAC module, 21 policies, and Operations Manager role bootstrapped idempotently | Assign role to real accounts and verify allow/deny via HTTP |
| Event Triage Agent | `implemented-static` | Ingests `inventory.low`; validates envelope; unique by `source + event_id`; creates one incident per event; duplicate returns existing record | Real subscribers/connectors, retry/concurrency testing, dead-lettering, and additional event types |
| Inventory Agent | `implemented-static` | Deterministic rules, typed read/command tools, Action Gateway revalidation, and safe conflict handling; runtime verifier used three real Medusa stock locations and inventory items, running two competing actions under Redis lock resulting in one `SUCCEEDED`, one `CONFLICT`, and zero overselling | Multi-process/worker contention testing, reservation interaction, and verification on production stock locations |
| Audit & Compliance Agent | `implemented-static` | Audit/outbox/tool tracing, leases, retry/backoff, dead-lettering; Redis Event Bus, Workflow Engine, and distributed locking connected at runtime | Extended subscriber idempotency, append-only enforcement, trace/replay details, and retention policies |
| Order Exception Agent | `runtime-verified` | Checkout `order.placed` and API/OMS flows automatically assign UTC SLAs; `order.read` retrieves live status; detector scans paginated orders every 5 minutes and locks each order via Redis; HTTP/RBAC verified; two competing workers still produce only one event/incident/action | Fine-tune operational SLAs and introduce an indexed SLA table or durable cursor for high volumes |
| Fulfillment Agent | `contracted` | Has fulfillment trigger, read/task tools, and foundation dependencies | SLA contract, fulfillment workflow, and real shipping carrier connectors |
| Customer Support Agent | `runtime-verified` | API/worker/PostgreSQL verified `support.requested` reads live orders, enforces ownership check before knowledge/model calls, invokes real Gemini, uses `APPROVED` knowledge, and creates draft responses with citations and tasks; staff browser verified claiming/editing/saving, returning to queue, escalating to management, and VI/EN switching; `IN_APP` simulator verified customer inquiries and staff sending approved responses with deduplication protection | Customer channel/identity mapping, consent management, webhook signatures, delivery receipts, and live customer outbound adapters |
| Knowledge Curator Agent | `implemented-static` | Knowledge repository with Google OAuth/Picker connector, versioned immutable documents, chunk/checksum/citation tracking, approval/retire lifecycle, and VI/EN Admin UI. LangChain.js + Qdrant running with Gemini `gemini-embedding-001`; live verifier demonstrated lexical search returns 0 results for fixture while semantic and hybrid find the exact match, followed by retiring/deleting vectors | VI/EN benchmarking, detection of missing/duplicate/conflicting content, and agent-proposed updates; human managers remain the final approvers |
| Returns & Refund Agent | `contracted` | Has policy/approval, task, audit, and evaluation foundation | Ownership models, evidence contracts, and dedicated Medusa workflows |
| Payment & Fraud Watcher | `contracted` | Has event/incident/task/escalation and `PROHIBITED` policy primitives | Payment provider mapping, fraud detection rules, and prohibited-action scenarios |
| Catalog Quality Agent | `contracted` | Has task, evaluation, and typed-tool contracts | Catalog rules, background scanner, and dedicated remediation tools |
| Pricing & Promotion Analyst | `contracted` | Has model run, prompt versioning, evaluation, and approval foundation | Metrics dataset, margin rules, and pricing ownership models |
| Workforce Coordinator Agent | `implemented-static` | `task.create`, `task.assign`, `task.escalate` run via Action Gateway, ACTIVE policies, leases, typed executors, tool-call/audit/outbox; PostgreSQL runtime verified success and safe conflict handling | `task.created/task.overdue` triggers, real shift rosters, SLA scheduler, real user HTTP/RBAC, and multi-worker contention |
| Integration Watchdog Agent | `contracted` | Has event/incident/task/outbox/channel foundation | Connector telemetry, health adapters, and automated recovery playbooks |
| Incident Commander Agent | `contracted` | Has incident, task, channel, audit, and policy foundation | Severity/SLA workflows, response checklists, and war-room adapters |
| Owner Briefing Agent | `contracted` | Has read models, knowledge citations, channels, and prompt contracts | Metrics aggregation, briefing scheduler, and mobile delivery adapters |
| Analytics Agent | `contracted` | Has governed prompt/model-run/evaluation contracts | Semantic metrics layer, query tools, and benchmark datasets |

Communication Gateway is a shared platform capability, not counted as an 18th agent. `IN_APP` is active in Admin; Telegram has outbound sending adapter, inbound webhook, identity allowlisting, secret token verification, delivery lease/retry/dead-lettering, and a runtime verifier with a mock Telegram API. Live bot connection remains `RUNTIME-PENDING` pending a bot token and a public HTTPS URL. Mobile/push/Zalo/Slack/Teams providers are not yet implemented.

## Completed Platform Foundation for Agent Development

- Machine-readable catalog registry covering all 17 agents: ID/version, mission, triggers, tools, risk ceiling, and foundation dependencies.
- Unified `AgentToolDefinition` tool runtime for input/output schema, permissions, risk, approvals, timeout, retry, idempotency, error handling, and audit fields. Executor verifies registry/version/schema/permission, rejects commands bypassing Action Gateway authority, and enforces both permissions and required roles. The active registry currently includes 16/24 catalog tools; beyond inventory, order read, response draft, platform read, and task tools, it includes `incident.create/update`, `approval.request/decide`, `knowledge.propose`, and `message.send`; public API coverage currently misses exactly 8 tools.
- Task orchestration with idempotency, assignees, deadlines, priorities, state machines, and audit logging; create/assign/escalate operations route through the generalized Action Gateway, ACTIVE policies, leases, and Medusa workflows. Supervisor actively creates escalation requests every minute for overdue tasks. Escalations record reason, actor, and timestamp.
- Policy definitions with versions, validity periods, and deterministic conditions (`eq`, `gte`, `lte`, `in`); RBAC policies registered via `definePolicies`.
- Minimal bootstrap role `customer_support_staff` with strict permissions: read orders/customers, read/update support tasks, and create/execute escalation requests. Onboarding script replaces the default `Super Admin` role assigned by Medusa CLI with this staff role.
- Knowledge lifecycle `DRAFT -> APPROVED -> RETIRED`, with checksums, citations, ownership, locale, scope, effective dates, and expiry. Content is segmented into stable search chunks; each chunk has its own checksum and locator. Agents can only use chunks from valid, approved documents.
- Semantic RAG using LangChain.js and open-source Qdrant. Qdrant serves purely as a derived vector index; PostgreSQL remains the source of truth. Approval automatically upserts chunks, retire automatically deletes vectors; semantic queries are filtered by tenant/scope/locale and re-verified against approved documents. When Qdrant or embedding providers fail or are disabled, `knowledge.search` automatically falls back to lexical search.
- OpenAI and Gemini can be used for embeddings or response drafting; DeepSeek is supported for reasoning and response generation (as official APIs do not offer embeddings). Store owners connect providers via Admin; API keys are encrypted in PostgreSQL and never returned to the browser. Workflows automatically reindex knowledge when changing embedding provider/model, and Qdrant maintains isolated collections per provider/model.
- Model Gateway with adapter contracts, redaction, token budgets, and mandatory structured outputs. OpenAI Responses adapter uses strict JSON Schema, timeouts, `store=false`, minimal input, and model-run ledgers; Gemini adapter uses JSON Schema; DeepSeek adapter uses Chat Completions JSON mode with similar server-side safeguards. Customer Support prompts are versioned configurations in PostgreSQL, visible and customizable via Admin with default fallback prompts; model runs record the exact prompt key/version used. If provider/key/model is missing, Customer Support keeps deterministic drafts instead of failing the queue.
- Evaluation harness recording scenarios/runs, expected/forbidden assertions, and scores. Baseline has seeded `SHIP-001`, `KNOW-001`, and `ORDER-001`.
- Channel registry and delivery ledger supporting `IN_APP`, web push, Telegram, Zalo, Slack, and Teams. Telegram stores only `env:...` secret references; adapter handles `sendMessage`, receipts, retries, and webhook `secret_token` without persisting bot tokens in the database.
- Medusa Admin `Agent Operations` page for viewing readiness, incidents, approvals, tasks, knowledge, evaluations, and catalog; approval decisions require a reason.
- Medusa Admin `Knowledge Hub` page for managing drafts, approvals, deprecations, viewing chunks, and testing queries in Vietnamese or English. Clear explanations specify when agents are permitted to use content.
- Medusa Admin `Customer Support` operational route separated from technical control planes. Staff see only customer inquiries, customer details, order statuses, draft responses, reference sources, and action buttons for claim/complete/escalate. All UI text supports Vietnamese and English.
- Production toggles for Redis Event Bus, Workflow Engine, and distributed locking; local development defaults safely to in-memory when environment flags are unset.

## Implemented Vertical Slices

### Event Triage Agent

- ID/version: `event-triage-agent@0.1.0`.
- Currently supported trigger: `inventory.low` version 1.
- Required input: event envelope, inventory item, location, available/required quantity, and snapshot of alternative locations.
- Output: one `agent_event` and at most one `agent_incident` per `source + event_id`.
- State flow: `RECEIVED -> INVESTIGATING` before handing off to inventory rules.
- Prohibited: direct writes to Medusa inventory/order tables or bypassing schema validation.

### Inventory Agent

- ID/version: `inventory-agent@0.1.0`.
- Current rule: calculates `shortfall = max(required - available, 0)`.
- If inventory is sufficient: produces `NO_ACTION`, risk `READ_ONLY`, incident `RESOLVED`.
- If an alternative warehouse covers shortfall: selects location with highest available quantity, produces `INVENTORY_TRANSFER`, risk `HIGH`, awaits approval.
- If no warehouse covers shortfall: produces `ESCALATE`, risk `MEDIUM`, no mutation.
- Typed tool `inventory.get-position@1.0.0` reads live inventory from Inventory Module.
- Command `inventory.execute-transfer@1.0.0` executes only via Action Gateway after approval; source/target are adjusted within the same Inventory Module call.
- Both read and command tools run through the shared executor; command contract provides timeout/retry/idempotency and cannot be invoked in `DIRECT` mode.
- Prohibited: treating event snapshots as execution authority or skipping revalidation.

### Order Exception Agent

- ID/version: `order-exception-agent@0.1.0`.
- Trigger: `order.exception@1` with three types: `PAYMENT_STUCK`, `FULFILLMENT_OVERDUE`, `MANUAL_REVIEW`.
- `order.read@1.0.0` calls Medusa `getOrderDetailWorkflow` and fetches the latest order/payment/fulfillment status before deciding.
- Deterministic rules close incident as `RESOLVED` if signal is stale; if still valid, produces recommendation and requests `task.create` via Action Gateway.
- Task only requests operator investigation; contract prohibits auto-canceling orders, capturing funds, issuing refunds, or modifying fulfillments.
- Events, actions, and tasks are idempotent; recommendation records live order version as evidence; audit/outbox logs the decision.
- `ORDER-001` verifies live read and task creation while prohibiting order/refund mutations.
- `detect-order-exceptions` job runs every 5 minutes and only processes orders with metadata `agent_payment_due_at` or `agent_fulfillment_due_at`; does not infer SLAs.
- Hook `createOrderWorkflow.orderCreated` covers API/OMS flows; subscriber `order.placed` calls idempotent workflow to cover Medusa checkout. Draft orders are skipped; items not requiring shipping do not receive fulfillment SLAs.
- Default policy: 120 minutes for payment and 2,880 minutes for fulfillment; valid OMS deadlines are preserved, invalid deadlines are replaced by defaults. Payment status `authorized` is not falsely flagged as payment stuck.
- Each scan batch reads up to 5 pages x 100 orders by default; page size and total pages are configurable with hard limits to protect the database.
- Overdue payments take precedence over fulfillment; event IDs are constructed from order ID, exception type, and SLA due time, preventing duplicate incidents/actions/tasks on re-scan.
- Each failing order is isolated; detector re-reads via typed tool, and ingestion workflow revalidates before creating tasks. Processing for an order runs under distributed lock `agent-order-sla:<order_id>`.

### Customer Support Agent

- ID/version: `customer-support-agent@0.1.0`.
- Initial trigger: `support.requested@1`, currently supporting `ORDER_STATUS` inquiries in Vietnamese or English.
- `order.read@1.0.0` fetches order/payment/fulfillment status directly from Medusa. Customer ID in request must match the order owner, or the workflow fails closed before logging events or incidents.
- `knowledge.search@1.0.0` only retrieves chunks from approved, valid `customer_support` documents matching locale; citation retains document, chunk, locator, checksum, and version for staff verification.
- `response.draft@1.0.0` generates deterministic draft responses from live order and knowledge. When model provider is enabled, the model only rewrites the `body` from live order data and approved excerpts; citation/grounding/review flags are fixed by code. If the model fails or knowledge is missing, deterministic fallback continues.
- All drafts have `requires_human_review=true`. Agent creates recommendation `REVIEW_SUPPORT_RESPONSE` and requests `task.create` via Action Gateway with type `SUPPORT_RESPONSE_REVIEW`.
- Standard ingestion workflow only creates drafts and tasks, never sending messages automatically. Internal testing mode can create `IN_APP` conversations; only staff who claimed the task, verified content, and confirmed sending can trigger `message.send` via Action Gateway. Actions carry idempotency keys preventing duplicate sends.
- Simulator is protected by Admin login and dedicated RBAC permission `agent_support_simulator:create`; separate environment flags are removed. Messages remain strictly in the internal database without invoking email, Telegram, Zalo, or live customer channels.
- Admin route `customer-support` uses SDK session and query cache; staff can claim tasks, edit drafts, complete with `message_sent=false`, or escalate to management via `task.escalate` in Action Gateway. The screen hides technical event IDs, correlation IDs, tool calls, model runs, and raw JSON.
- Staff currently drafting can choose "Return to queue for another agent". Workflow locks by task, verifies active assignee, unassigns, and returns task to `TODO`; all returns are audited. UI requires confirmation and warns unsaved edits will be discarded.

### Policy & Approval Agent

- ID/version: `policy-approval-agent@0.1.0`.
- Current policy: `inventory.transfer.requires-operations-manager@1.0.0`.
- Approvals expire after 24 hours by default.
- `APPROVED` transitions incident from `AWAITING_APPROVAL` to `EXECUTING` and logs `approval.decided` to audit/outbox.
- `REJECTED` transitions incident to `REJECTED`.
- Expired approvals transition to `EXPIRED` and trigger escalation.
- Resubmitting identical decisions returns duplicate; conflicting decisions on finalized approvals are rejected.
- `APPROVED` creates exactly one `agent_action_request`; action worker claims via lease.
- Action Gateway verifies approval validity, recommendation, incident state, and tool version immediately prior to executing commands.
- Stale or missing inventory returns `CONFLICT`, logs trace, and reverts incident to `OPTIONS_READY`; no partial mutations are created.

### Audit & Compliance Agent

- ID/version: `audit-compliance-agent@0.1.0`.
- Audit logs recommendations, approval decisions, and action outcomes.
- Tool trace separately records read tools and command tools with inputs/outputs/errors.
- Outbox logs `agent.approval.requested`, `approval.decided`, `agent.action.requested`, and action outcomes with unique idempotency keys.
- Scheduled dispatcher runs every minute, claiming up to 25 events via lease.
- Successful delivery transitions to `DELIVERED`; failures use exponential backoff, transitioning to `DEAD` after 5 attempts.
- Emitted messages carry `agent_outbox.event_id` and `idempotency_key` to prevent duplicate consumer processing.
- `DELIVERED` status confirms Medusa Event Bus receipt, but does not certify completion of downstream subscribers or commerce mutations.

### Communication Gateway

- `IN_APP` serves Admin; Telegram creates dedicated `OPERATOR_CHAT` conversations per connection and `chat_id` mapped to Medusa users.
- Subscriber `agent.approval.requested` creates idempotent notifications from outbox.
- Admin commands currently support `APPROVAL_DECISION` with `client_message_id` deduplication.
- Conversation topic must match `approval_id`; mismatched topics are rejected.
- Commands invoke existing approval workflows; no direct commerce mutations or business table writes.
- Command results are recorded as outbound `COMMAND_RESULT` and audit events.
- Telegram webhook accepts only private text, verifies `X-Telegram-Bot-Api-Secret-Token`, ignores non-allowlisted chats, and suppresses duplicate updates. Free-form text is stored for processing without auto-executing commands.
- Outbound Telegram messages are created strictly by `message.send` via Action Gateway. Worker claims delivery by lease, calls Bot API, and stores external message ID; retry uses exponential backoff, moving to `DEAD` upon exceeding retry limits.
- Script `agent:configure-telegram` calls `getMe`, registers `setWebhook`, and enables the connection only upon success. If Telegram rejects, connection remains `DISABLED`.
- Free-form LLM chat interpretation, push notifications, and Zalo/Slack/Teams/Messenger adapters are not yet implemented.

## Available APIs and Persistence

Admin API:

- `POST /admin/agent-operations/events`
- `POST /admin/agent-operations/order-exceptions`
- `POST /admin/agent-operations/support-requests`
- `GET /admin/agent-operations/incidents`
- `GET /admin/agent-operations/incidents/:id`
- `GET /admin/agent-operations/approvals`
- `POST /admin/agent-operations/approvals/:id/decision`
- `GET /admin/agent-operations/actions`
- `POST /admin/agent-operations/actions/requests` (creates commands via Action Gateway)
- `GET /admin/agent-operations/actions/:id`
- `POST /admin/agent-operations/actions/:id/execute`
- `GET /admin/agent-operations/tools` (returns serializable metadata and catalog/registry coverage)
- `GET /admin/agent-operations/conversations`
- `GET /admin/agent-operations/conversations/:id`
- `POST /admin/agent-operations/conversations/:id/messages`
- `GET /admin/agent-operations/catalog`
- `GET /admin/agent-operations/platform/readiness`
- `POST /admin/agent-operations/platform/bootstrap`
- `GET|POST /admin/agent-operations/tasks`
- `POST /admin/agent-operations/tasks/:id/transition`
- `GET|POST /admin/agent-operations/knowledge`
- `GET /admin/agent-operations/knowledge/:id` (returns document and chunks)
- `POST /admin/agent-operations/knowledge/search` (tests querying approved sources)
- `POST /admin/agent-operations/knowledge/:id/approve`
- `POST /admin/agent-operations/knowledge/:id/retire`
- `GET /admin/agent-operations/evaluations/scenarios`
- `GET|POST /admin/agent-operations/evaluations/runs`
- Read APIs for policies, prompts, model runs, and channel connections.

Persistence:

- `agent_event`
- `agent_incident`
- `agent_run`
- `agent_recommendation`
- `agent_approval`
- `agent_audit_event`
- `agent_outbox_event`
- `agent_action_request`
- `agent_tool_call`
- `agent_conversation`
- `agent_message`
- `agent_task`
- `agent_policy_definition`
- `agent_knowledge_document`
- `agent_knowledge_chunk`
- `agent_prompt_template`
- `agent_model_run`
- `agent_evaluation_scenario`
- `agent_evaluation_run`
- `agent_channel_connection`
- `agent_delivery`

## Current Evidence

Verification Date: 2026-08-11.

- Migration `Migration20260809174339` executed successfully on local PostgreSQL.
- Migration `Migration20260809180247` added lease expiry and executed successfully.
- Migration `Migration20260809190225` created action request/tool call tables and executed successfully on local PostgreSQL.
- Migration `Migration20260809194213` created conversation/message tables and executed successfully on local PostgreSQL.
- Migration `Migration20260810073306` generalized action context and added task escalation; executed successfully with backfill for legacy inventory actions.
- Migration `Migration20260810132610` saved authorized roles snapshot on action requests and executed successfully on local PostgreSQL.
- 134/134 unit tests pass for analyzer, detector, response draft, state machines, validators, tool contract, executor, registry coverage, tools, policy, knowledge, model boundary, evaluation, action/outbox, and communication.
- ESLint target for all agent source code passes.
- Medusa runtime scenario via module service/database verified: duplicate events suppressed; duplicate approval decisions use only one action request; Action Gateway reads live inventory and missing levels create safe conflicts; incidents revert to `OPTIONS_READY`; produces 2 tool calls, 5 audit events, and 4 outbox events.
- Runtime communication scenario verified Event Bus invokes subscribers correctly; notifications appear in conversations; Admin commands create approvals/actions; resubmissions with identical `client_message_id` do not create duplicate messages/actions; conversation displays sequence `NOTIFICATION -> COMMAND -> COMMAND_RESULT`.
- Runtime outbox scenario verified two messages reach `DELIVERED`, expired leases are reclaimed, competing workers cannot claim active leases, and exhausted attempts transition to `DEAD`.
- Unauthenticated requests to Admin event APIs return `401 Unauthorized`.
- TypeScript check, Medusa lint, and full workspace build all pass.
- PostgreSQL bootstrap seeded `ORDER-001`. Runtime verifier created test order using Medusa workflows and successfully executed event → live read → recommendation → Action Gateway → task on PostgreSQL; duplicate events suppressed and order retained status/version/canceled state.
- HTTP/RBAC verifier used two temporary User records and short-lived JWTs: users with `operations_manager` role receive 201 and executing actions receive 202/`SUCCEEDED`; users without role receive 403; unauthenticated requests receive 401; blocked branches create 0 events, and temporary users are cleaned up in `finally`.
- RBAC is enabled by default in `medusa-config.ts`; `.env.template` declares `MEDUSA_FF_RBAC=true`, preventing routes from running unenforced.
- Detector runtime created an order with overdue payment SLA: initial scan created exactly one incident/action/task; second scan returned duplicate with zero errors; order retained status/version/canceled state.
- Redis race verifier ran two concurrent Medusa processes against the same order set; both connected to `locking-redis`, encountered 0 scan errors, and target orders received exactly one event, incident, and action request.
- SLA assignment verifier confirmed both order creation hooks and checkout events record policy `order-sla-default@1.0.0`; generated deadlines processed by detector create task `ORDER_PAYMENT_REVIEW`, action `SUCCEEDED`, and zero order mutations.
- Customer Support verifier created real customer/order/knowledge records, approved knowledge, and ran `support.requested -> order.read -> knowledge.search -> response.draft -> task.create`. Result produced exactly 1 event, incident, recommendation, action, task, and tool call; duplicate events suppressed; customers not owning the order were rejected prior to model boundary (producing 0 events and 0 model runs); order unchanged; 0 conversations and 0 `message.send` actions created.
- Migration `Migration20260811052521` created `agent_knowledge_chunk` table successfully. Reindex script converted 14 existing documents into 14 sourced chunks.
- Knowledge Hub verifier verified on PostgreSQL: drafts do not appear in searches, approved versions return exact `#chunk-*` locators and checksums, and retired documents are immediately excluded from results. Customer Support verifier re-ran successfully with chunk-based search, grounded drafts, and mandatory human review.
- OpenAI Responses adapter unit tests verify strict JSON Schema, `store=false`, structured output parsing, and credential protection. API keys, providers, and models are fetched exclusively from credential vault configured by managers in Admin; no secret fallback via `.env`. Live model paths are verified only after connecting real providers and running business acceptance tests.
- Knowledge Source Connector currently accepts documents explicitly selected by users from Google Drive. Google Docs, Google Sheets, and TXT/Markdown/CSV files are recognized automatically; content changes create `DRAFT` only, never auto-publishing to agents.
- Website scraping connector was removed from APIs, workflows, Admin, and deployment configs. Migration `Migration20260811122426` removed legacy source types while preserving previously created knowledge documents.
- Google knowledge adapter supports Google Docs, Google Sheets, and TXT/Markdown/CSV files via OAuth connector and Google Picker. Store owners log in and select individual files; `drive.file` scope restricts access to selected files only. Refresh tokens are encrypted, callbacks protected against CSRF via expiring state/nonce, and disconnection revokes permissions and deletes credentials. Migration `Migration20260811080525` executed; real Google API calls remain `RUNTIME-PENDING` pending production OAuth app setup.
- LangChain.js `QdrantVectorStore` and Qdrant `1.19.0` integrated. Runtime verifier upserted two chunks, proving metadata filtering isolates tenants and vectors are deleted when documents are retired. Live verifier called Gemini `gemini-embedding-001`, indexed 17 documents/17 chunks, and verified fixture returned 0 lexical results but 1 semantic and hybrid result; fixture was subsequently retired and vectors deleted.
- Customer Support live verifier called Gemini `gemini-3.5-flash-lite`, returning structured drafts with two citations and mandatory human review. Mismatched ownership branch created 0 model runs, preventing order data from passing the authorization gate.
- Inventory contention verifier created three locations and one inventory item using Medusa workflows, approved two actions both requesting transfer of 10 units from a source with 15 units, and executed concurrently under Redis lock. Result: one `SUCCEEDED`, one `CONFLICT`, source balance 5 units, and destinations 0/10; all fixtures cleaned up via official workflows.
- Customer Support staff-flow verifier used two temporary User records and short-lived JWTs: users with required role receive 201, users without role receive 403, unauthenticated requests receive 401; blocked branches create 0 events. Worker created real tasks; staff processed `TODO -> CLAIMED -> IN_PROGRESS -> COMPLETED`, saving approved responses with `message_sent=false`; `task.escalate` branch escalated to `operations_manager` team with HIGH priority. Verifier retained one customer, one order, and two VI/EN TODO tasks for demo data, cleaning up temporary users.
- Customer Support UI lint/build succeeded with Medusa Admin; compiled both `vi` and `en` resources. Browser tests with real `customer_support_staff` account verified claiming tasks, editing/saving answers, returning to queue, escalating to management, and switching VI/EN. Test revealed UI was incorrectly using `incident_id` as `correlation_id`; task API was updated to return real correlation, and Action Gateway escalation succeeded after the fix.
- Support simulator verifier executed real APIs with `customer_support_staff` role: created an `INBOUND` customer message, completed the task, and confirmed an `OUTBOUND` message. Sending unapproved drafts or sending from different staff was blocked; duplicate requests did not create duplicate messages/actions. Output persisted strictly to `IN_APP` channel without external delivery.
- Migration `Migration20260809200756` created 9 new foundation tables; official Medusa RBAC migration executed successfully.
- Bootstrap is idempotent; `operations_manager` role has exactly 21 active policies synced automatically from `definePolicies`.
- Runtime platform verified task transition `TODO -> CLAIMED -> IN_PROGRESS -> COMPLETED`, knowledge transition `DRAFT -> APPROVED`, `SHIP-001` status `PASSED`, and duplicate evaluation suppression.
- Runtime task gateway verified duplicate requests are suppressed; requests without policies fail closed without creating actions; create/assign/escalate operations return `SUCCEEDED`; stale expected states return `CONFLICT`; each action produces exactly one tool call.
- Runtime platform verified `knowledge.propose` creates `DRAFT` documents via Action Gateway before being approved to `APPROVED` by user workflows.
- Supervisor periodically transitions expired approvals to `EXPIRED`, moves pending incidents to `ESCALATED`, and creates escalation tasks via Action Gateway; error records are isolated to avoid blocking the entire batch.
- Redis container healthy; Redis Event Bus, Workflow Engine, and Distributed Locking connect successfully when production switch is enabled.
- Production server on test port serves `/app` with HTTP 200; catalog API without session correctly returns HTTP 401.

## Next Gates

1. Add customer channels with identity mapping, consent, delivery receipts, and staff confirmation before sending; do not enable autonomous agent sending.
2. Assign `operations_manager` role to real Admin accounts and test allow/deny policies via HTTP.
3. Run inventory contention tests using two distinct processes/workers, add reservation interactions, and re-verify against production stock locations.
4. Add trace/replay details, append-only/retention policies, and subscriber idempotency for each production connector.
5. Configure real Telegram bot and public HTTPS for acceptance testing; add connection management UI. Build push/Zalo/Slack/Teams/Messenger before introducing free-form LLM chat comprehension.
6. Benchmark Gemini generation/embedding against VI/EN `KNOW-001` test suite, set budgets, rate limits, and conduct security reviews prior to production rollout.
7. Google OAuth/Picker connected; requires real users selecting Docs/Sheets for import acceptance. Then add synchronization schedules, diff reviews, gap/conflict detection, and worker-based retry/dead recovery. Notion/PDF require dedicated adapters under the same connector contract.
8. Calibrate SLA minute thresholds based on real operational data; migrate detector to indexed SLA tables or durable cursors when exceeding configured batch limits.
9. Following the customer support vertical slice, implement Fulfillment Agent based on SLA contracts and real shipping connectors; avoid placeholder tools.

