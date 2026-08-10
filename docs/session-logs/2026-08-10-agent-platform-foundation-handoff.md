# Agent Platform Foundation — Session Handoff

Ngày chốt baseline: **2026-08-10**.

## 1. Mục đích của tài liệu

Đây là tài liệu bắt đầu nhanh cho session tiếp theo khi xây một trong 17 agent
trong `AGENT_CATALOG.md`. Nó trả lời bốn câu hỏi:

1. Nền chung nào đã có thật trong source và database?
2. Hệ thống được thiết kế chạy theo luồng nào?
3. Thêm agent mới phải đặt code ở đâu và đi qua gate nào?
4. Những gì vẫn chỉ là deployment gate hoặc chưa triển khai?

Không dùng tài liệu này để suy diễn rằng cả 17 agent đã được code. Hiện bốn
vertical capability đầu tiên là `implemented-static`; các agent còn lại mới ở
`contracted`, tức đã có hợp đồng và nền chung để bắt đầu xây.

## 2. Thứ tự đọc bắt buộc

1. `AGENTS.md`.
2. Tài liệu này.
3. `AGENT_CATALOG.md`.
4. `AGENT_FOUNDATION.md`.
5. Source của agent đang định thay đổi, không chỉ đọc tài liệu.
6. Skill Medusa tương ứng trước khi code backend hoặc Admin.

Khi tài liệu và source khác nhau, kiểm tra migration, test và runtime trước khi
kết luận. Luôn tách `implemented-static`, `runtime-verified` và
`production-ready`.

## 3. Kiến trúc vận hành

```text
Domain event / connector
  -> Event contract + dedupe
  -> Incident + state machine
  -> Agent run
  -> Deterministic analysis hoặc governed model draft
  -> Recommendation
  -> Policy engine
  -> Approval nếu có rủi ro
  -> Idempotent action request
  -> Worker claim + distributed lock
  -> Typed Action Gateway tool
  -> Authorization + live revalidation
  -> Medusa application/module service mutation
  -> Audit + transactional outbox
  -> Event Bus / Communication Gateway
  -> Admin hoặc channel adapter
```

Quyền ghi dữ liệu commerce luôn thuộc Medusa module/workflow. Agent không được
ghi thẳng bảng order, inventory, payment hoặc return. Snapshot trong event chỉ
là bằng chứng phân tích, không phải quyền thực thi.

LLM, khi được bật sau này, chỉ đứng ở nhánh tạo draft/structured recommendation:

```text
Approved knowledge + citation
  -> Versioned prompt
  -> Redaction + budget + output schema
  -> Provider adapter
  -> Model run trace
  -> Evaluation scenario
  -> Human/policy gate
```

## 4. Nền móng đã có

| Foundation | Source chính | Trạng thái |
| --- | --- | --- |
| Catalog cho 17 agent | `catalog-registry.ts` | Có ID/version, mission, trigger, tools, risk và dependency |
| Event/incident/run | models và `service.ts` | Có dedupe, correlation, state machine |
| Recommendation/approval | models, approval workflow | Có expiry, reason, actor, duplicate-safe decision |
| Action Gateway | action request, tool call, worker, `request-agent-action.ts` | Context incident/recommendation/approval tùy chọn; fail-closed nếu thiếu policy ACTIVE; có lease, retry, dead-letter, idempotency và live revalidation |
| Typed tool runtime | `tool-contract.ts`, `tool-executor.ts`, `tool-registry.ts`, `read-tool-runtime.ts` | 3 platform read tool và 3 task command chạy qua executor; request và execution authority tách riêng; coverage hiện 8/24 |
| Task orchestration | `agent-task`, task workflows | Có priority, assignee, due date, idempotency và state machine |
| Policy engine | policy definition, `policy-engine.ts` | Có version/effectivity và `eq/gte/lte/in`; inventory flow đã sử dụng active policy |
| RBAC | `src/policies/agent-operations.ts` | Medusa sync 20 policy; bootstrap gắn vào `operations_manager` |
| Knowledge | knowledge model/workflows/helpers | Draft/approved/retired, checksum, citation, owner, scope, locale, expiry |
| Model boundary | prompt/model-run models, `model-gateway.ts` | Redaction, token/schema gate; provider mặc định disabled |
| Evaluation | scenario/run models và workflow | Expected/forbidden assertions; seed SHIP-001, KNOW-001 |
| Audit/outbox | audit/outbox models và dispatcher | Có trace, lease, retry/backoff và dead-letter |
| Communication | conversation/message/channel/delivery | IN_APP hoạt động; external adapter contract mặc định từ chối |
| Admin console | `src/admin/routes/agent-operations/page.tsx` | Readiness, incident, approval, task, knowledge, evaluation, catalog |
| Production infrastructure | `medusa-config.ts`, Compose | Switch cho Redis Event Bus, Workflow Engine và distributed locking |

## 5. Persistence hiện tại

Control plane dùng custom Medusa module `agentOperations`.

Nhóm vận hành đã có:

- `agent_event`, `agent_incident`, `agent_run`;
- `agent_recommendation`, `agent_approval`;
- `agent_action_request`, `agent_tool_call`;
- `agent_audit_event`, `agent_outbox_event`;
- `agent_conversation`, `agent_message`.

Nhóm foundation mới:

- `agent_task`;
- `agent_policy_definition`;
- `agent_knowledge_document`;
- `agent_prompt_template`, `agent_model_run`;
- `agent_evaluation_scenario`, `agent_evaluation_run`;
- `agent_channel_connection`, `agent_delivery`.

Migration mới nhất của foundation là
`Migration20260809200756.ts`. Không sửa migration đã chạy; thay đổi model phải
sinh migration mới bằng skill/CLI Medusa.

## 6. Source map

```text
apps/backend/src/
  modules/agent-operations/
    catalog-registry.ts        # machine-readable catalog
    tool-contract.ts           # typed tool contract dùng chung
    tool-executor.ts           # registry/version/schema/permission/gateway gate
    tool-registry.ts           # tool chạy thật và coverage so với catalog
    tools/                     # domain tool schemas và deterministic helpers
    policy-engine.ts           # deterministic policy evaluation
    task-state-machine.ts      # task transitions
    knowledge.ts               # checksum, effectivity, citation
    model-gateway.ts           # provider boundary, redaction, schema/budget
    evaluation.ts              # assertion evaluator
    channel-gateway.ts         # IN_APP + disabled external adapters
    rbac-policies.ts           # policy definitions shared with loader
    service.ts                 # transactional control-plane operations
    models/                    # persistence definitions
    migrations/                # generated migrations
    __tests__/                 # unit contracts
  workflows/agent-operations/  # every mutation entrypoint
  api/admin/agent-operations/  # authenticated Admin APIs
  policies/agent-operations.ts # definePolicies registration
  jobs/                        # action/outbox workers
  subscribers/                 # Event Bus consumers
  admin/routes/agent-operations/page.tsx
  scripts/
    bootstrap-agent-platform.ts
    verify-agent-foundation.ts
    verify-agent-platform.ts
```

## 7. Bootstrap, environment và kiểm chứng

Package manager là `pnpm@10.11.1` theo root `package.json`.

```bash
cd apps/backend
pnpm exec medusa db:migrate
pnpm run agent:bootstrap
pnpm run agent:verify
pnpm run agent:verify-platform
pnpm run test:unit
pnpm run lint
pnpm run build
```

Bootstrap là idempotent. Sau lần đầu, chạy lại phải trả `created: []`.

Redis production path:

```bash
docker compose up -d redis
REDIS_INFRASTRUCTURE_ENABLED=true \
REDIS_URL=redis://localhost:6379 \
LOCKING_REDIS_URL=redis://localhost:6379 \
pnpm run agent:verify-platform
```

Baseline đã xác nhận:

- 59/59 unit test pass;
- backend TypeScript và Medusa lint sạch;
- full workspace build pass;
- migration PostgreSQL pass;
- `Migration20260810073306` backfill action inventory cũ, cho phép action
  context tùy chọn và bổ sung task escalation fields;
- role `operations_manager` có 20 active policy;
- task đi hết `TODO -> CLAIMED -> IN_PROGRESS -> COMPLETED`;
- task Action Gateway fail-closed khi thiếu policy; create/assign/escalate đều
  `SUCCEEDED`; stale expected state trả `CONFLICT`; request trùng bị suppress và
  mỗi action ghi đúng một tool call;
- knowledge đi `DRAFT -> APPROVED` và chỉ khi đó mới eligible;
- SHIP-001 evaluation `PASSED`, duplicate run bị suppress;
- Redis Event Bus, Workflow Engine và Locking đều kết nối runtime;
- Admin production shell `/app` trả 200;
- Admin API không có session trả 401.

## 8. Cách xây một agent mới

Không bắt đầu bằng prompt. Thực hiện theo thứ tự:

1. Chọn một agent trong catalog và chỉ rõ business owner.
2. Chốt event schema/version và idempotency key.
3. Chốt entity ownership; xác định dữ liệu nào Medusa sở hữu.
4. Khai báo typed read/command tool bằng `AgentToolDefinition`: input/output
   schema, permission, risk, approval, timeout, retry, idempotency, error codes
   và audit fields; sau đó đăng ký trong `tool-registry.ts`.
5. Viết deterministic rules trước; thêm policy definition và risk ceiling.
6. Viết scenario gồm initial state, event, expected assertions và forbidden
   assertions.
7. Tạo/đổi persistence model nếu thực sự cần, rồi sinh migration mới.
8. Viết business mutation trong workflow, không trong route handler.
9. Command phải đi qua Action Gateway, lock, approval và live revalidation.
10. Thêm audit/outbox, retry/idempotency và human handoff.
11. Thêm API/Admin UI bằng Medusa SDK.
12. Chạy unit, runtime script, HTTP auth/RBAC allow-deny và failure scenarios.
13. Chỉ cập nhật trạng thái catalog khi có bằng chứng đúng cấp độ.

Một vertical slice tốt phải đi xuyên từ event đến UI/audit; không tạo thêm một
đống infrastructure nhưng chưa có luồng nghiệp vụ chạy được.

## 9. Gate chưa hoàn thành

Đây là các việc còn thiếu theo môi trường hoặc theo từng agent, không phải nền
chung đã được phép coi là production-ready:

- chưa gán role `operations_manager` cho một tài khoản Admin thật và chưa có
  HTTP allow/deny evidence bằng hai tài khoản;
- chưa cấu hình model provider, secret manager, ngân sách production hoặc model
  benchmark ngoài baseline assertion;
- Telegram, Zalo, Slack, Teams, web push và mobile chưa có provider/webhook,
  identity mapping hoặc delivery receipt thật;
- chưa có connector order/fulfillment/payment/return production cho các agent
  tiếp theo;
- tool registry chạy thật có 8/24 tool catalog; 16 tool còn lại mới là tên hợp
  đồng, dù một số workflow/API nền như approval/task/knowledge đã có;
- chưa có load, recovery, penetration và multi-process contention test đầy đủ;
- trace/replay detail, append-only enforcement và retention vẫn cần hardening;
- Inventory Agent còn cần happy path với hai stock location thật và cạnh tranh
  reservation/action thật.

## 10. Những điều không được làm

- Không cho agent hoặc worker ghi thẳng business table.
- Không bỏ qua workflow, policy, RBAC, approval, idempotency hoặc revalidation.
- Không lưu API key/token thô; chỉ lưu secret reference.
- Không bật model/channel chỉ vì có biến môi trường; adapter phải qua security và
  evaluation gate.
- Không gọi agent `runtime-verified` chỉ vì TypeScript/build pass.
- Không coi Redis container local là bằng chứng production readiness.
- Không tạo inventory ownership thứ hai cạnh Medusa.
- Không sửa migration cũ hoặc file trong `.medusa`, `.next`, `dist`, `.turbo`.
- Không ghi đè thay đổi không liên quan trong worktree đang dirty.

## 11. Prompt khởi động gợi ý cho session sau

```text
Đọc AGENTS.md, docs/session-logs/2026-08-10-agent-platform-foundation-handoff.md,
AGENT_CATALOG.md và AGENT_FOUNDATION.md. Sau đó đọc source thật của
agentOperations, workflows, API và Admin liên quan. Chọn một vertical slice của
<agent-name>, giữ deterministic rules/policy/approval làm quyền quyết định,
không ghi trực tiếp bảng Medusa, bổ sung scenario và kiểm chứng đúng cấp độ.
```
