# Agent Catalog

## Cách đọc trạng thái

- `planned`: mới xác định năng lực mục tiêu.
- `contracted`: đã chốt trigger, tool, policy và scenario.
- `implemented-static`: đã có code và test tĩnh, chưa đủ bằng chứng end-to-end.
- `runtime-verified`: đã chạy qua API, worker và database thật.
- `production-ready`: đã qua security, recovery, load và operational gate.

Không suy diễn `database-verified` thành `runtime-verified`. Worker thực thi,
revalidation trên dữ liệu Medusa mới nhất, RBAC bằng tài khoản thật và Admin UI
vẫn là các gate riêng.

## Hiện trạng triển khai

| Agent capability | Trạng thái | Phạm vi đã có | Gate còn thiếu |
| --- | --- | --- | --- |
| Policy & Approval Agent | `implemented-static` | Policy HIGH cho đề xuất chuyển tồn; approval có expiry, reason, actor; approve/reject và quyết định lặp lại an toàn; Action Gateway revalidate; RBAC module, 20 policy và role Operations Manager đã bootstrap idempotent | Gán role cho tài khoản thật, kiểm thử allow/deny qua HTTP và mở rộng policy cho action khác |
| Event Triage Agent | `implemented-static` | Nhận `inventory.low`; validate envelope; unique theo `source + event_id`; tạo một incident cho event; duplicate trả lại record cũ | Subscriber/connector thật, retry/concurrency test, dead-letter và nhiều event type |
| Inventory Agent | `implemented-static` | Rule deterministic, typed read/command tools, Action Gateway revalidate và safe conflict; Redis locking adapter đã kết nối runtime | Happy path với hai stock location thật và concurrency/reservation test nhiều process |
| Audit & Compliance Agent | `implemented-static` | Audit/outbox/tool trace, lease, retry/backoff, dead-letter; Redis Event Bus, Workflow Engine và locking đã kết nối runtime | Subscriber idempotency mở rộng, append-only enforcement, trace/replay detail và retention |
| Order Exception Agent | `contracted` | Có ID/version, mission, trigger, tool và foundation dependency trong registry | Event payload riêng, workflow và scenario theo order thật |
| Fulfillment Agent | `contracted` | Có trigger fulfillment, read/task tool và foundation dependency | SLA contract, workflow và connector vận chuyển thật |
| Customer Support Agent | `contracted` | Có knowledge/citation, prompt version, model gateway disabled-by-default và KNOW-001 | Retrieval, order context, model provider và human-review UI riêng |
| Knowledge Curator Agent | `contracted` | Có knowledge lifecycle, checksum, citation và approval workflow | Gap detector, diff/review UI và nguồn tri thức thật |
| Returns & Refund Agent | `contracted` | Có policy/approval, task, audit và evaluation foundation | Ownership, evidence contract và Medusa workflow riêng |
| Payment & Fraud Watcher | `contracted` | Có event/incident/task/escalation và `PROHIBITED` policy primitive | Payment mapping, fraud rules và prohibited-action scenarios |
| Catalog Quality Agent | `contracted` | Có task, evaluation và typed-tool contract | Catalog rules, scanner và remediation tools riêng |
| Pricing & Promotion Analyst | `contracted` | Có model run, prompt version, evaluation và approval foundation | Metrics dataset, margin rules và pricing ownership |
| Workforce Coordinator Agent | `contracted` | Task module có idempotency, assignee, due date, priority và state machine | Roster/shift integration, SLA scheduler và escalation policy |
| Integration Watchdog Agent | `contracted` | Có event/incident/task/outbox/channel foundation | Connector telemetry, health adapter và recovery playbook |
| Incident Commander Agent | `contracted` | Có incident, task, channel, audit và policy foundation | Severity/SLA workflow, checklist và war-room adapter |
| Owner Briefing Agent | `contracted` | Có read model, knowledge citation, channel và prompt contract | Metrics composition, scheduler và mobile delivery adapter |
| Analytics Agent | `contracted` | Có governed prompt/model-run/evaluation contract | Semantic metrics layer, query tool và benchmark dataset |

Communication Gateway là platform capability dùng chung, không tính thêm thành
agent thứ 18. Nền `IN_APP` hiện đã lưu conversation/message, tạo thông báo từ
`agent.approval.requested` và nhận structured command `APPROVAL_DECISION` từ
Admin. Provider mobile/push/chat bên ngoài vẫn là adapter chưa triển khai.

## Nền tảng dùng chung đã hoàn thiện để bắt đầu xây agent

- Registry đọc được bằng máy đủ 17 agent: ID/version, mission, trigger, tool,
  risk ceiling và foundation dependency.
- Task orchestration có idempotency, assignee, deadline, priority, state machine
  và audit; mutation đi qua Medusa workflow.
- Policy definition có version, hiệu lực và điều kiện deterministic `eq`, `gte`,
  `lte`, `in`; RBAC policy được đăng ký bằng `definePolicies`.
- Knowledge có lifecycle `DRAFT -> APPROVED -> RETIRED`, checksum, citation,
  owner, locale, scope, hiệu lực và expiry. Agent chỉ được dùng bản approved còn
  hiệu lực.
- Model Gateway có adapter contract, redaction, token budget và structured
  output bắt buộc. Adapter mặc định chủ động từ chối khi chưa cấu hình provider.
- Evaluation harness lưu scenario/run, expected/forbidden assertions và score.
  Baseline đã seed `SHIP-001` và `KNOW-001`.
- Channel registry và delivery ledger hỗ trợ `IN_APP`, web push, Telegram, Zalo,
  Slack, Teams; hiện chỉ `IN_APP` active và secret chỉ lưu reference.
- Medusa Admin có trang `Agent Operations` xem readiness, incident, approval,
  task, knowledge, evaluation và catalog; quyết định approval bắt buộc có reason.
- Có production switch cho Redis Event Bus, Workflow Engine và distributed
  locking; local vẫn dùng in-memory khi cờ môi trường chưa bật.

## Vertical slice đã code

### Event Triage Agent

- ID/version: `event-triage-agent@0.1.0`.
- Trigger hiện hỗ trợ: `inventory.low` version 1.
- Input bắt buộc: event envelope, inventory item, location, available/required
  quantity và snapshot các kho thay thế.
- Output: một `agent_event` và tối đa một `agent_incident` cho mỗi
  `source + event_id`.
- Trạng thái: `RECEIVED -> INVESTIGATING` trước khi chuyển cho rule inventory.
- Cấm: ghi bảng inventory/order của Medusa hoặc bỏ qua schema validation.

### Inventory Agent

- ID/version: `inventory-agent@0.1.0`.
- Rule hiện tại: tính `shortfall = max(required - available, 0)`.
- Nếu đủ tồn: tạo `NO_ACTION`, risk `READ_ONLY`, incident `RESOLVED`.
- Nếu một kho thay thế đủ shortfall: chọn kho có available quantity lớn nhất,
  tạo `INVENTORY_TRANSFER`, risk `HIGH`, chờ approval.
- Nếu không kho nào đủ: tạo `ESCALATE`, risk `MEDIUM`, không mutation.
- Typed tool `inventory.get-position@1.0.0` đọc tồn live từ Inventory Module.
- Command `inventory.execute-transfer@1.0.0` chỉ chạy qua Action Gateway sau
  approval; source/target được điều chỉnh trong cùng lời gọi Inventory Module.
- Cấm: coi snapshot trong event là quyền thực thi hoặc bỏ qua revalidation.

### Policy & Approval Agent

- ID/version: `policy-approval-agent@0.1.0`.
- Policy hiện tại: `inventory.transfer.requires-operations-manager@1.0.0`.
- Approval mặc định hết hạn sau 24 giờ.
- `APPROVED` chuyển incident từ `AWAITING_APPROVAL` sang `EXECUTING` và ghi
  `approval.decided` vào audit/outbox.
- `REJECTED` chuyển incident sang `REJECTED`.
- Approval hết hạn chuyển sang `EXPIRED` và escalation.
- Cùng decision gửi lại trả duplicate; decision khác với quyết định đã chốt bị
  từ chối conflict.
- `APPROVED` tạo đúng một `agent_action_request`; action worker claim bằng lease.
- Action Gateway kiểm tra approval còn hiệu lực, recommendation, incident state
  và tool version ngay trước command.
- Stale/missing inventory trả `CONFLICT`, ghi trace và đưa incident về
  `OPTIONS_READY`; không tạo mutation một phần.

### Audit & Compliance Agent

- ID/version: `audit-compliance-agent@0.1.0`.
- Audit ghi recommendation, approval decision và action outcome.
- Tool trace ghi riêng read tool và command tool với input/output/error.
- Outbox ghi `agent.approval.requested`, `approval.decided`,
  `agent.action.requested` và action outcome với idempotency key duy nhất.
- Scheduled dispatcher chạy mỗi phút, claim tối đa 25 event theo lease.
- Delivery thành công chuyển sang `DELIVERED`; lỗi dùng exponential backoff và
  quá 5 attempt chuyển `DEAD`.
- Message phát ra mang `agent_outbox.event_id` và `idempotency_key` để consumer
  chống xử lý trùng.
- `DELIVERED` hiện chỉ chứng minh Medusa Event Bus đã nhận message, không chứng
  minh subscriber hoặc mutation commerce đã hoàn tất.

### Communication Gateway

- Channel đầu tiên: `IN_APP`; conversation gắn với approval và incident.
- Subscriber `agent.approval.requested` tạo notification idempotent từ outbox.
- Admin command hiện hỗ trợ `APPROVAL_DECISION` với `client_message_id` chống
  xử lý trùng.
- Conversation topic phải khớp `approval_id`; message sai topic bị từ chối.
- Command gọi lại approval workflow hiện có; không tạo mutation commerce hoặc
  ghi bảng nghiệp vụ trực tiếp.
- Kết quả command được ghi thành outbound `COMMAND_RESULT` và audit event.
- Chưa có diễn giải câu chat tự do bằng LLM, push notification hoặc adapter
  Telegram/Zalo/Slack/Teams.

## API và persistence đã có

Admin API:

- `POST /admin/agent-operations/events`;
- `GET /admin/agent-operations/incidents`;
- `GET /admin/agent-operations/incidents/:id`;
- `GET /admin/agent-operations/approvals`;
- `POST /admin/agent-operations/approvals/:id/decision`.
- `GET /admin/agent-operations/actions`;
- `GET /admin/agent-operations/actions/:id`;
- `POST /admin/agent-operations/actions/:id/execute`;
- `GET /admin/agent-operations/tools`.
- `GET /admin/agent-operations/conversations`;
- `GET /admin/agent-operations/conversations/:id`;
- `POST /admin/agent-operations/conversations/:id/messages`.
- `GET /admin/agent-operations/catalog`;
- `GET /admin/agent-operations/platform/readiness`;
- `POST /admin/agent-operations/platform/bootstrap`;
- `GET|POST /admin/agent-operations/tasks`;
- `POST /admin/agent-operations/tasks/:id/transition`;
- `GET|POST /admin/agent-operations/knowledge`;
- `POST /admin/agent-operations/knowledge/:id/approve`;
- `GET /admin/agent-operations/evaluations/scenarios`;
- `GET|POST /admin/agent-operations/evaluations/runs`;
- read API cho policies, prompts, model runs và channel connections.

Persistence:

- `agent_event`;
- `agent_incident`;
- `agent_run`;
- `agent_recommendation`;
- `agent_approval`;
- `agent_audit_event`;
- `agent_outbox_event`.
- `agent_action_request`;
- `agent_tool_call`.
- `agent_conversation`;
- `agent_message`.
- `agent_task`;
- `agent_policy_definition`;
- `agent_knowledge_document`;
- `agent_prompt_template`;
- `agent_model_run`;
- `agent_evaluation_scenario`;
- `agent_evaluation_run`;
- `agent_channel_connection`;
- `agent_delivery`.

## Bằng chứng hiện tại

Ngày kiểm chứng: 2026-08-10.

- Migration `Migration20260809174339` chạy thành công trên PostgreSQL local.
- Migration `Migration20260809180247` bổ sung lease expiry và chạy thành công.
- Migration `Migration20260809190225` tạo action request/tool call và chạy
  thành công trên PostgreSQL local.
- Migration `Migration20260809194213` tạo conversation/message và chạy thành
  công trên PostgreSQL local.
- 35/35 unit test pass cho analyzer, state machines, validators, tools, policy,
  knowledge, model boundary, evaluation, action/outbox và communication.
- ESLint mục tiêu của toàn bộ source agent pass.
- Kịch bản Medusa runtime qua module service/database xác nhận: duplicate event
  bị suppress; duplicate approval decision chỉ dùng một action request;
  Action Gateway đọc inventory live và missing level tạo safe conflict;
  incident trở lại `OPTIONS_READY`; có 2 tool call, 5 audit event và 4 outbox
  event.
- Runtime communication scenario xác nhận Event Bus gọi đúng subscriber;
  notification xuất hiện trong conversation; Admin command tạo approval/action;
  gửi lại cùng `client_message_id` không tạo message/action thứ hai; conversation
  có đúng chuỗi `NOTIFICATION -> COMMAND -> COMMAND_RESULT`.
- Runtime outbox scenario xác nhận hai message đạt `DELIVERED`, expired lease
  được reclaim, competing worker không claim được active lease và exhausted
  attempt chuyển `DEAD`.
- Request không xác thực tới event Admin API trả `401 Unauthorized`.
- TypeScript, Medusa lint và full workspace build đều pass.
- Migration `Migration20260809200756` tạo 9 bảng nền mới; migration RBAC chính
  thức của Medusa cũng chạy thành công.
- Bootstrap chạy lại trả `created: []`; role `operations_manager` có đúng 20
  policy active do Medusa tự đồng bộ từ `definePolicies`.
- Runtime platform xác nhận task `TODO -> CLAIMED -> IN_PROGRESS -> COMPLETED`,
  knowledge `DRAFT -> APPROVED`, `SHIP-001` đạt `PASSED` và evaluation trùng bị
  suppress.
- Redis container healthy; Event Bus Redis, Workflow Engine Redis và Locking
  Redis đều kết nối thành công khi bật production switch.
- Production server trên cổng kiểm thử phục vụ `/app` với HTTP 200; catalog API
  không có session trả đúng HTTP 401.

## Gate tiếp theo

1. Gán role `operations_manager` cho tài khoản Admin thật và kiểm thử allow/deny
   trên từng policy qua HTTP.
2. Chạy happy path bằng ít nhất hai stock location thật và kiểm thử hai action
   cạnh tranh trên cùng inventory item.
3. Bổ sung trace/replay detail, append-only/retention và subscriber idempotency
   cho từng connector production.
4. Thêm delivery adapter/push provider, webhook signature, channel identity
   mapping, delivery receipt/retry và mobile/PWA; sau đó mới thêm hiểu chat tự
   do bằng LLM.
5. Chọn model provider, secret manager và budget; chỉ bật adapter sau khi
   benchmark `KNOW-001` và security review đạt yêu cầu.
6. Bổ sung connector nguồn thật và scenario approval expiry, retry/dead
   recovery qua API/worker.
