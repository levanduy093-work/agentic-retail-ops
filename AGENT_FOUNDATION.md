# Agent Platform Foundation

## 1. Mục đích

Tài liệu này xác định phần nền phải hoàn thiện trước khi biến các vai trò trong
[`AGENT_CATALOG.md`](./AGENT_CATALOG.md) thành agent có thể chạy thật.

Mục tiêu không phải tạo ngay 17 tiến trình AI độc lập. Mục tiêu là xây một nền
vận hành chung để từng năng lực agent có thể:

- nhận đúng sự kiện nghiệp vụ;
- đọc dữ liệu có quyền và có nguồn gốc;
- tạo kết luận hoặc đề xuất có cấu trúc;
- xin duyệt khi hành động có rủi ro;
- thực thi qua API/workflow nghiệp vụ được kiểm soát;
- chống xử lý trùng và kiểm tra lại dữ liệu trước khi ghi;
- lưu đầy đủ lịch sử để con người kiểm tra, tiếp quản và đánh giá.

## 2. Hiện trạng cần hiểu đúng

### Đã có

- Medusa backend là system of record cho catalog, customer, cart, order,
  payment, fulfillment, inventory, promotion và các cấu hình commerce.
- Medusa Admin cung cấp giao diện quản trị nghiệp vụ.
- Next.js storefront cung cấp luồng mua hàng và tài khoản khách hàng.
- PostgreSQL là cơ sở dữ liệu chính.
- Backend đã có ví dụ đúng về route gọi workflow trong luồng liên kết Google
  customer.
- `AGENT_CATALOG.md` đã liệt kê 17 năng lực agent mục tiêu.

### Đã bổ sung trong vertical slice đầu tiên

- Custom module `agent-operations` và migration cho event, incident, run,
  recommendation, approval, audit và outbox.
- Contract + validator cho `inventory.low`.
- State machine, event dedupe, deterministic inventory recommendation và
  approval decision idempotency.
- Admin API cho event, incident và approval.
- Policy declarations tương thích Medusa RBAC cho các resource agent.
- Unit test và script kiểm chứng module service/database.
- Scheduled outbox dispatcher có optimistic claim, lease expiry, exponential
  backoff, dead-letter và message idempotency metadata.
- Typed tool registry gồm `inventory.get-position@1.0.0`,
  `inventory.execute-transfer@1.0.0`, `knowledge.search@1.0.0`,
  `audit.search@1.0.0`, `trace.replay@1.0.0`, `task.create@1.0.0`,
  `task.assign@1.0.0`, `task.escalate@1.0.0`, `incident.create@1.0.0`,
  `incident.update@1.0.0`, `approval.request@1.0.0`,
  `approval.decide@1.0.0`, `knowledge.propose@1.0.0` và
  `message.send@1.0.0`.
- `AgentToolDefinition` và executor dùng chung đã kiểm tra schema input/output,
  version, permission, risk/approval, timeout/retry/idempotency contract và chặn
  command không đi qua Action Gateway. Ba read tool platform có runtime thật đi
  qua module service và executor; chín platform/task command đi qua request
  gateway, policy và worker; coverage hiện là 15/24 tool catalog.
- Action request/tool-call persistence, Action Gateway workflow và scheduled
  action worker có lease, retry, dead-letter và idempotency. Action envelope hỗ
  trợ context incident/recommendation/approval tùy chọn; không có policy ACTIVE
  phù hợp thì từ chối và không tạo action.
- Supervisor job chạy mỗi phút: hết hạn approval quá giờ bằng workflow có
  audit/outbox, đồng thời phát `task.escalate` request idempotent cho task quá
  deadline; supervisor không tự ghi nghiệp vụ commerce.
- Inventory Action Gateway đọc `available_quantity` live từ Medusa dưới khóa,
  kiểm tra lại approval/state/tool contract rồi mới điều chỉnh hai stock level.
- Safe conflict đưa incident từ `EXECUTING` về `OPTIONS_READY`; mutation thành
  công có compensation và đi tiếp `MONITORING -> RESOLVED`.
- Communication Gateway `IN_APP` có conversation/message persistence,
  notification subscriber và structured `APPROVAL_DECISION` command idempotent.
- Admin API đọc conversation/message và gửi command; command vẫn đi qua policy,
  approval workflow và Action Gateway hiện có.

### Vẫn chưa có

- Agent planner/supervisor dùng LLM để tự chọn tool; hiện tool được gọi bằng
  workflow deterministic và worker.
- Trigger/SLA scheduler tự gọi `task.assign` và `task.escalate` từ
  `task.created` hoặc `task.overdue`.
- Bằng chứng multi-process cho production Event Bus, distributed locking và
  subscriber idempotency/replay tooling.
- Telegram adapter đã có webhook secret, identity allowlist và delivery
  receipt/retry nhưng chưa acceptance với bot thật. Mobile/PWA, push,
  Zalo/Slack/Teams/Messenger vẫn chưa có provider adapter.
- LLM chuyển câu chat tự do thành structured command có evaluation.
- Connector ingestion và semantic/vector retrieval cho Knowledge; lifecycle,
  version, approval và citation cơ bản đã có.
- UI chi tiết để yêu cầu/chạy task tool và xem timeline gateway trực tiếp.
- Scenario riêng cho Workforce Coordinator ngoài runtime verification script.

Vì vậy, bốn capability đầu tiên vẫn ở mức `implemented-static`. Safe-conflict
đã có bằng chứng database/runtime cục bộ, nhưng happy path chuyển tồn với hai
stock location thật, RBAC bằng user thật và production Event Bus/locking vẫn là
gate trước khi gọi `runtime-verified` end-to-end.

## 3. Ranh giới kiến trúc bắt buộc

### 3.1 Medusa vẫn là system of record

Medusa sở hữu và quyết định trạng thái cuối của:

- product, variant, price và promotion;
- customer, cart và order;
- payment, refund và return;
- fulfillment, reservation, stock location và sellable inventory.

Agent không được ghi trực tiếp vào bảng Medusa và không được tự tính lại các
giá trị mà Medusa phải quyết định như tồn khả dụng, tổng tiền, điều kiện refund
hoặc eligibility của promotion.

### 3.2 Agent Operations sở hữu trạng thái điều phối

Phần Agent Operations sở hữu:

- canonical event và event inbox;
- incident/case;
- agent run và từng bước thực thi;
- evidence, recommendation và confidence;
- approval, rejection, expiry và escalation;
- action request, tool call và execution result;
- task của con người;
- audit trail và evaluation result.

### 3.3 Mọi mutation phải đi qua một đường duy nhất

```text
Agent
  -> Typed Tool
  -> Action Gateway
  -> Authentication / Authorization
  -> Policy / Risk / Approval Check
  -> Idempotency / State Revalidation
  -> Medusa Workflow hoặc Application Service
  -> Transaction + Outbox
  -> Domain Event + Audit
```

Worker, LLM, Admin UI và connector bên ngoài đều không được đi tắt qua ranh giới
này.

### 3.4 Deterministic rules có quyền quyết định cuối

LLM có thể phân loại, tóm tắt và đề xuất. Code deterministic phải quyết định:

- quyền truy cập;
- risk level và yêu cầu phê duyệt;
- số tiền, tồn kho và ngưỡng;
- điều kiện hợp lệ của refund/return/promotion;
- idempotency;
- kiểm tra state mới nhất trước mutation;
- hành động nào được phép thực thi.

## 4. Những nền tảng phải bổ sung

### 4.1 Chuẩn hóa domain và ownership

Tạo bảng ownership cho từng entity và command trước khi code agent đầu tiên.
Mỗi dòng phải xác định:

- system of record;
- API đọc;
- command được phép;
- workflow thực thi;
- role có quyền;
- risk level;
- yêu cầu approval;
- audit fields bắt buộc.

Không cho phép hai module cùng sở hữu inventory, order hoặc payment state.

### 4.2 Canonical event contract

Mọi sự kiện đưa vào Agent Operations phải có envelope thống nhất:

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

Yêu cầu:

- event bất biến sau khi ghi;
- unique theo nguồn và ID sự kiện nguồn;
- consumer dedupe trước khi tạo workflow run;
- có version và migration strategy;
- payload được validate bằng schema;
- dữ liệu nhạy cảm không được đưa tùy tiện vào payload/log.

Các event đầu tiên nên bám vào domain hiện có:

- `order.placed`;
- `order.fulfillment_at_risk`;
- `inventory.low`;
- `inventory.reservation_changed`;
- `payment.failed`;
- `return.requested`;
- `approval.decided`;
- `action.executed`;
- `action.failed`.

### 4.3 Agent state và state machine

Không lưu trạng thái agent chỉ trong memory của process. Một run tối thiểu cần
các trạng thái:

```text
RECEIVED
  -> INVESTIGATING
  -> OPTIONS_READY
  -> AWAITING_APPROVAL
  -> EXECUTING
  -> MONITORING
  -> RESOLVED
```

Các nhánh kết thúc khác:

```text
REJECTED | CANCELLED | FAILED | ESCALATED
```

Mỗi transition phải lưu actor, thời gian, reason, input reference,
correlation ID và previous state. Transition không hợp lệ phải bị từ chối.

### 4.4 Typed Tool Registry

Mỗi tool phải có:

- tên và version;
- mục đích nghiệp vụ;
- input/output schema;
- read hoặc command classification;
- required permission;
- risk level;
- approval rule;
- timeout, retry và idempotency behavior;
- error taxonomy;
- audit fields;
- test contract.

Source hiện thực hóa contract này nằm ở `tool-contract.ts`; mọi lời gọi dùng
`tool-executor.ts`. API coverage phải phân biệt tool đã đăng ký chạy thật với
tên tool mới được khai báo trong catalog. Read tool platform dùng
`read-tool-runtime.ts`; knowledge search chỉ lấy tài liệu `APPROVED` còn hiệu
lực, audit search bắt buộc có filter, và trace replay hợp nhất
event/run/action/tool-call/audit/outbox theo thời gian.

Ví dụ nhóm tool đầu tiên:

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

Tên `execute-*` không có nghĩa agent được tự thực thi. Action Gateway vẫn phải
kiểm tra policy, approval và state mới nhất.

### 4.5 Policy và Approval

Tạo policy matrix theo `action type x risk x actor x amount/quantity`.

Mức rủi ro đề xuất:

- `READ_ONLY`: chỉ đọc và phân tích;
- `LOW`: có thể tự động nếu policy cho phép;
- `MEDIUM`: có thể yêu cầu xác nhận hoặc sampling review;
- `HIGH`: luôn cần người có đúng role phê duyệt;
- `PROHIBITED`: agent không được gọi.

Approval record tối thiểu gồm:

- request ID và action proposal bất biến;
- requester/agent run;
- risk level và policy version;
- approver role;
- trạng thái pending/approved/rejected/expired/cancelled;
- decision actor, reason và timestamp;
- expiry time;
- snapshot/reference của evidence;
- execution status và result reference.

Approval chỉ cấp quyền thử thực thi. Worker vẫn phải revalidate inventory,
order, price, SLA hoặc payment state ngay trước mutation. State đã đổi phải trả
conflict an toàn, không cố thực thi theo approval cũ.

### 4.6 Idempotency, transaction và outbox

Mọi command có side effect phải nhận idempotency key. Cùng key và cùng input chỉ
được tạo một kết quả nghiệp vụ; cùng key nhưng input khác phải bị từ chối.

Trong cùng transaction cần ghi:

1. thay đổi domain;
2. execution result;
3. audit record;
4. outbox event.

Outbox worker cần có:

- status;
- attempt count;
- available time;
- lock owner và lock expiry;
- last error;
- dead-letter/escalation policy.

Retry không được tạo thêm refund, stock movement, notification hoặc task.

### 4.7 Audit và observability

Audit là append-only và tối thiểu phải trả lời được:

- ai hoặc agent nào đã làm gì;
- dùng tool/version/model/prompt nào;
- dựa trên dữ liệu và tài liệu nào;
- policy nào đã áp dụng;
- ai phê duyệt;
- input/output đã được redaction như thế nào;
- mutation cuối cùng thành công hay thất bại;
- correlation ID để lần theo toàn bộ luồng.

Metrics nền:

- event-to-case latency;
- time-to-recommendation;
- approval waiting time;
- execution success/conflict rate;
- duplicate suppression count;
- tool error/retry rate;
- human override rate;
- false positive/false negative theo scenario;
- cost và token usage khi LLM được bật.

### 4.8 Human Operations UI

Tận dụng Medusa Admin trước khi cân nhắc một console riêng. Các màn hình đầu
tiên:

- `Incident Queue`: danh sách case, mức độ ưu tiên, SLA và owner;
- `Incident Detail`: timeline, evidence, recommendation và task;
- `Approval Inbox`: approve/reject cùng reason và impact preview;
- `Agent Trace`: event, tool calls, model output, policy và execution result;
- `Task Board`: việc cần con người xử lý và escalation.

UI không được coi thao tác click là nguồn sự thật duy nhất. Mọi decision phải đi
qua Admin API/workflow và được ghi audit.

### 4.9 Knowledge foundation

Chỉ xây RAG sau khi tool/policy/approval chạy ổn định. Knowledge item cần:

- document ID, version và owner;
- status `DRAFT | APPROVED | RETIRED`;
- effective/expiry time;
- scope/tenant/locale;
- nguồn gốc và checksum;
- citation locator;
- access policy.

Agent chỉ được dùng tài liệu `APPROVED` còn hiệu lực cho quyết định nghiệp vụ.
Không tìm được bằng chứng phải hỏi hoặc escalation, không được đoán.

Baseline hiện đã có `agent_knowledge_chunk`: tài liệu mới được chia đoạn ổn
định khi tạo, mỗi đoạn có checksum và citation locator riêng. Tìm kiếm chỉ xét
đoạn thuộc tài liệu đúng tenant/scope/locale, đã duyệt và còn hiệu lực. Admin có
Knowledge Hub Việt/Anh để tạo bản nháp, duyệt, ngừng sử dụng và thử truy xuất;
script reindex dùng để bổ sung đoạn cho tài liệu được tạo trước migration.

### 4.10 Security và tenant boundary

Trước khi bật agent command cần có:

- service identity riêng cho worker;
- least-privilege permission cho từng tool;
- tenant/store/sales-channel/location scope;
- secret reference thay vì lưu token thô;
- PII redaction trong prompt, trace và log;
- rate limit và execution budget;
- kill switch theo agent, action type và tenant;
- không cho prompt/user text tạo tên tool hoặc query tùy ý.

## 5. Cấu trúc source đề xuất

Giữ modular monolith cho control plane và chỉ tách worker thực thi nền:

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

Quy tắc dependency:

- `agent-domain` chỉ chứa type, rule deterministic và state transition thuần;
- `agent-contracts` chứa event/tool/API schema, không chứa DB client;
- backend sở hữu module service, workflow và transaction;
- worker chỉ gọi typed API/Action Gateway;
- Admin UI chỉ gọi Admin API;
- LLM adapter không được import repository hoặc Medusa service để mutation.

Nếu thêm `packages/**`, phải cập nhật `pnpm-workspace.yaml`. Nếu thêm task mới,
phải khai báo đúng `outputs` trong `turbo.json`.

## 6. Cách nâng cấp `AGENT_CATALOG.md`

Mỗi dòng mô tả hiện tại phải được mở rộng thành một contract có cùng mẫu:

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

Mỗi agent phải trả lời rõ:

1. Business outcome nào agent chịu trách nhiệm?
2. Sự kiện hoặc lịch nào kích hoạt?
3. Agent được đọc entity nào?
4. Agent được gọi những tool nào?
5. Hành động nào bị cấm?
6. Hành động nào cần approval của role nào?
7. Khi nào agent phải dừng và giao cho con người?
8. Trạng thái nào được persist?
9. SLA và metric thành công là gì?
10. Scenario nào chứng minh agent hoạt động đúng và an toàn?

`status` chỉ được dùng theo các mức:

- `planned`: mới có thiết kế;
- `contracted`: event/tool/policy/scenario đã được duyệt;
- `implemented-static`: code và test tĩnh đã có;
- `runtime-verified`: đã chạy qua API/worker/database thật;
- `production-ready`: đã qua security, load, recovery và operational gate.

## 7. Thứ tự triển khai agent

Không triển khai 17 agent cùng lúc. Bốn năng lực đầu tiên nên tạo thành một
vertical slice:

1. **Event Triage** nhận sự kiện và tạo incident.
2. **Inventory hoặc Order Exception** điều tra và tạo recommendation.
3. **Policy & Approval** quyết định có cần người duyệt và quản lý decision.
4. **Audit & Compliance** ghi và kiểm tra trace của toàn bộ luồng.

Sau khi vertical slice này ổn định mới mở rộng theo thứ tự:

1. Fulfillment và Returns & Refund;
2. Catalog Quality và Pricing/Promotion;
3. Customer Support và Knowledge Curator;
4. Integration Watchdog và Incident Commander;
5. Workforce Coordinator, Owner Briefing và Analytics.

Các tên trên là năng lực nghiệp vụ. Chúng có thể dùng chung một supervisor,
worker, policy engine và Action Gateway; không bắt buộc tương ứng với 17 service
hay 17 process.

## 8. Vertical slice đầu tiên đề xuất

### Scenario: đơn hàng có nguy cơ thiếu tồn kho

1. Inventory/order event được ghi vào event inbox.
2. Event Triage tạo một incident duy nhất dù event bị gửi lại.
3. Agent đọc order, reservation và availability qua typed read tools.
4. Rule deterministic tính shortfall và các phương án hợp lệ.
5. Agent tạo recommendation có evidence và impact.
6. Policy đánh dấu chuyển tồn kho là hành động rủi ro cao.
7. Operations Manager approve/reject trong Admin.
8. Worker nhận `approval.decided`.
9. Action Gateway kiểm tra permission, idempotency và state mới nhất.
10. Medusa workflow thực thi hoặc trả conflict an toàn.
11. Outbox phát kết quả, incident chuyển sang monitoring/resolved.
12. Toàn bộ event, tool, approval, mutation và lỗi xuất hiện trong Agent Trace.

Để scenario có ý nghĩa, dữ liệu test phải có ít nhất hai stock location, tồn
kho lệch nhau, order/reservation thực và expected outcome rõ ràng.

## 9. Milestone chuẩn bị nền

### M0 — Contract và ownership

- Chốt entity ownership, event envelope, tool contract và risk matrix.
- Chọn vertical slice đầu tiên và viết scenario ground truth.
- Chưa tích hợp LLM.

### M1 — Persistence và control plane

- Tạo migrations/module cho event inbox, incident, run, recommendation,
  approval, tool call, audit và outbox.
- Implement state transition và dedupe/idempotency tests.

### M2 — Action Gateway và worker

- Implement read tools, approval flow và một command tool.
- Worker có lease, retry, dead-letter và safe conflict.
- Chạy end-to-end bằng rule deterministic.

### M3 — Human console

- Incident Queue, Incident Detail, Approval Inbox và Agent Trace trong Admin.
- Role/permission và audit decision hoạt động bằng tài khoản thật.

### M4 — LLM trong giới hạn

- LLM chỉ sinh structured recommendation theo schema.
- Bổ sung prompt/version tracking, redaction, budget và evaluation.
- So sánh deterministic-only với LLM-assisted trên cùng scenario.

### M5 — Mở rộng catalog agent

- Chỉ chuyển agent tiếp theo sang `contracted` khi event, tool, policy,
  scenario và human owner đã sẵn sàng.
- Integration Hub và connector bên ngoài là capability bổ sung, không thay thế
  commerce core.

## 10. Definition of Ready cho một agent

Một agent chỉ được bắt đầu code khi có đủ:

- business owner;
- mission và out-of-scope;
- trigger/event schema;
- entity ownership;
- typed read/command tools;
- risk và approval matrix;
- state machine;
- human handoff/escalation;
- scenario gồm initial state, event, expected actions và forbidden actions;
- success, safety và latency metrics.

## 11. Definition of Done cho một agent

Một agent chỉ được gọi là runtime verified khi:

- duplicate event không tạo run/action thứ hai;
- invalid transition bị từ chối;
- unauthorized tool call bị từ chối;
- high-risk action không thể chạy thiếu approval;
- approval hết hạn hoặc state thay đổi tạo safe conflict;
- retry không tạo side effect trùng;
- audit truy được event đến mutation cuối;
- con người có thể reject, cancel, retry và takeover;
- scenario happy path và failure paths chạy qua API, worker và database thật;
- không có secret/PII không cần thiết trong prompt hoặc log.

## 12. Việc cần làm ngay

Nền dùng chung đã đạt `implemented-static` và phần persistence/bootstrap đạt
`runtime-verified` trên PostgreSQL local. Vì vậy việc tiếp theo chuyển sang xây
vertical slice của từng agent, không tiếp tục dựng infrastructure chung chung:

1. Gán role `operations_manager` cho tài khoản vận hành production; HTTP verifier
   bằng User record tạm đã xác nhận allow 201, deny 403 và unauthenticated 401.
2. Chạy happy path chuyển tồn với hai stock location thật và kiểm thử hai action
   cạnh tranh trên cùng inventory item bằng Redis locking.
3. Chuẩn hóa nơi checkout/OMS ghi `agent_payment_due_at` và
   `agent_fulfillment_due_at`; detector SLA 5 phút đã chạy thật và không ghi
   thẳng bảng order.
4. Xây Customer Support Agent bằng approved knowledge, citation và KNOW-001;
   đầu ra chỉ là draft chờ người duyệt.
5. Chọn secret manager/model provider và adapter mobile/chat sau khi có benchmark
   và security gate; không đặt khóa bí mật trong database hoặc Admin client.

## 13. Baseline nền tảng đã code ngày 2026-08-10

- 17 agent được đăng ký trong catalog TypeScript đọc được bằng máy.
- 21 RBAC policy được Medusa đồng bộ từ `definePolicies` và gắn vào role
  `operations_manager` bằng bootstrap idempotent.
- Có persistence và workflow cho task, policy definition, knowledge, prompt,
  model run, evaluation, channel connection và delivery.
- Có deterministic policy engine, task state machine, knowledge eligibility,
  citation checksum, model redaction/budget/schema gate và assertion evaluator.
- Typed registry có 15/24 tool. Sáu platform command
  `incident.create/update`, `approval.request/decide`, `knowledge.propose` và
  `message.send` đã được nối vào Action Gateway cùng ba task command.
- Action request lưu snapshot `authorized_roles`; executor kiểm tra permission
  và required role tại cả lúc yêu cầu lẫn lúc thực thi.
- Migration `Migration20260810132610` đã chạy trên PostgreSQL local; runtime
  xác nhận `knowledge.propose` qua gateway là `SUCCEEDED`, ba task command vẫn
  chạy đúng, stale state trả `CONFLICT`, request thiếu policy không tạo action.
  Unit test hiện đạt 77/77. Order Exception runtime verifier đã tự tạo order thử
  qua workflow Medusa và xác nhận live read, HTTP/RBAC, Action Gateway, task,
  audit/outbox, chống trùng và không thay đổi order. Agent này đạt
  `runtime-verified`; detector/SLA 5 phút đã xác nhận first-create/second-dedupe,
  còn production cursor/index và concurrency nhiều worker.
- Có Admin Operations Console và readiness API phân biệt `code_ready` với
  `deployment_ready`.
- Redis Event Bus, Workflow Engine và distributed locking đã kết nối runtime khi
  bật cờ; local mặc định vẫn an toàn với in-memory.
- OpenAI Responses adapter đã có structured output, timeout, redaction,
  idempotent model-run ledger và deterministic fallback; provider vẫn disabled
  nếu chưa cấu hình key/model. External delivery provider thật vẫn disabled.
  Đây là chủ ý an toàn, không phải bằng chứng runtime production.

## 14. Knowledge Source Connector ngày 2026-08-11

- Có model nguồn knowledge, API Admin, workflow kết nối/đồng bộ và giao diện
  Việt/Anh trong Knowledge Hub.
- Connector đầu tiên chỉ nhận tài liệu Markdown hoặc văn bản qua HTTPS, bắt
  buộc hostname nằm trong `KNOWLEDGE_CONNECTOR_ALLOWED_HOSTS`, từ chối URL có
  credential, custom port, địa chỉ private, HTML, redirect không an toàn và tài
  liệu lớn hơn 1 MB.
- Mỗi lần nội dung thay đổi tạo một knowledge document `DRAFT`; quản lý vẫn phải
  duyệt thì agent mới tìm thấy. Checksum ngăn bản nháp trùng khi nguồn không đổi.
- Migration `Migration20260811060537` và runtime verifier đã chạy thành công
  trên PostgreSQL local. Migration `Migration20260811064334` mở rộng nguồn cho
  Google Docs, Google Sheets và tệp TXT/Markdown/CSV trên Drive.
- Google adapter đã chuyển sang connector OAuth theo từng shop. Chủ shop bấm
  kết nối, đăng nhập Google và chọn tệp qua Google Picker; quyền `drive.file`
  chỉ cho phép đọc những tệp được chọn. Refresh token được mã hóa AES-256-GCM
  trong `agent_connector_credential`, callback kiểm tra state ký số, nonce và
  thời hạn; kết nối/ngắt kết nối có workflow và audit.
- Migration `Migration20260811080525` đã chạy; build, lint và 112 unit test đạt.
  Acceptance Google thật vẫn `RUNTIME-PENDING` đến khi bên triển khai cấu hình
  OAuth Client, Picker API key và project number. Chưa có Notion/PDF, lịch đồng
  bộ nền hoặc review diff.
