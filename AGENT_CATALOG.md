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
| Policy & Approval Agent | `implemented-static` | Policy HIGH cho đề xuất chuyển tồn; `approval.request/decide` đã có typed contract, role gate và Action Gateway; approval có expiry, reason, actor; RBAC module, 21 policy và role Operations Manager đã bootstrap idempotent | Gán role cho tài khoản thật và kiểm thử allow/deny qua HTTP |
| Event Triage Agent | `implemented-static` | Nhận `inventory.low`; validate envelope; unique theo `source + event_id`; tạo một incident cho event; duplicate trả lại record cũ | Subscriber/connector thật, retry/concurrency test, dead-letter và nhiều event type |
| Inventory Agent | `implemented-static` | Rule deterministic, typed read/command tools, Action Gateway revalidate và safe conflict; runtime verifier dùng ba stock location và inventory item thật của Medusa, chạy hai action cạnh tranh dưới Redis lock cho kết quả một `SUCCEEDED`, một `CONFLICT` và không oversell | Lặp lại contention bằng nhiều process/worker, thêm reservation interaction và chạy trên location vận hành thật |
| Audit & Compliance Agent | `implemented-static` | Audit/outbox/tool trace, lease, retry/backoff, dead-letter; Redis Event Bus, Workflow Engine và locking đã kết nối runtime | Subscriber idempotency mở rộng, append-only enforcement, trace/replay detail và retention |
| Order Exception Agent | `runtime-verified` | Checkout `order.placed` và luồng API/OMS tự gán SLA UTC; `order.read` lấy live status; detector quét phân trang mỗi 5 phút và khóa từng order bằng Redis; HTTP/RBAC đã xác nhận; hai worker cạnh tranh vẫn chỉ tạo một event/incident/action | Hiệu chỉnh SLA theo vận hành thật và SLA table/index hoặc durable cursor cho volume lớn |
| Fulfillment Agent | `contracted` | Có trigger fulfillment, read/task tool và foundation dependency | SLA contract, workflow và connector vận chuyển thật |
| Customer Support Agent | `runtime-verified` | API/worker/PostgreSQL đã xác nhận `support.requested` đọc live order, chặn sai chủ sở hữu trước knowledge/model call, gọi Gemini thật, dùng knowledge `APPROVED`, tạo draft có citation và task; browser nhân viên đã xác nhận nhận/sửa/lưu, trả hàng đợi, chuyển quản lý và VI/EN; simulator `IN_APP` đã xác nhận khách hỏi và nhân viên bấm gửi bản đã duyệt, có chống gửi trùng | Customer channel/identity mapping, consent, webhook signature, delivery receipt và adapter gửi khách thật |
| Knowledge Curator Agent | `implemented-static` | Kho hướng dẫn có Google OAuth/Picker connector, tài liệu bất biến theo phiên bản, chunk/checksum/citation, vòng đời duyệt/ngừng dùng và Admin UI Việt/Anh. LangChain.js + Qdrant đã chạy với Gemini `gemini-embedding-001`; live verifier chứng minh lexical không tìm thấy fixture nhưng semantic và hybrid đều tìm đúng, rồi retire/xóa vector | Benchmark VI/EN, phát hiện nội dung thiếu/trùng/xung đột và agent đề xuất bản cập nhật; quản lý vẫn là người duyệt cuối |
| Returns & Refund Agent | `contracted` | Có policy/approval, task, audit và evaluation foundation | Ownership, evidence contract và Medusa workflow riêng |
| Payment & Fraud Watcher | `contracted` | Có event/incident/task/escalation và `PROHIBITED` policy primitive | Payment mapping, fraud rules và prohibited-action scenarios |
| Catalog Quality Agent | `contracted` | Có task, evaluation và typed-tool contract | Catalog rules, scanner và remediation tools riêng |
| Pricing & Promotion Analyst | `contracted` | Có model run, prompt version, evaluation và approval foundation | Metrics dataset, margin rules và pricing ownership |
| Workforce Coordinator Agent | `implemented-static` | `task.create`, `task.assign`, `task.escalate` chạy qua Action Gateway, policy ACTIVE, lease, typed executor, tool-call/audit/outbox; PostgreSQL runtime đã xác nhận success và safe conflict | Trigger `task.created/task.overdue`, roster/shift thật, SLA scheduler, HTTP/RBAC user thật và multi-worker contention |
| Integration Watchdog Agent | `contracted` | Có event/incident/task/outbox/channel foundation | Connector telemetry, health adapter và recovery playbook |
| Incident Commander Agent | `contracted` | Có incident, task, channel, audit và policy foundation | Severity/SLA workflow, checklist và war-room adapter |
| Owner Briefing Agent | `contracted` | Có read model, knowledge citation, channel và prompt contract | Metrics composition, scheduler và mobile delivery adapter |
| Analytics Agent | `contracted` | Có governed prompt/model-run/evaluation contract | Semantic metrics layer, query tool và benchmark dataset |

Communication Gateway là platform capability dùng chung, không tính thêm thành
agent thứ 18. `IN_APP` đã chạy trong Admin; Telegram đã có adapter gửi, webhook
nhận, allowlist identity, secret verification, delivery lease/retry/dead-letter
và runtime verifier với Telegram API giả lập. Kết nối bot thật vẫn
`RUNTIME-PENDING` cho tới khi có bot token và public HTTPS URL. Các provider
mobile/push/Zalo/Slack/Teams vẫn chưa triển khai.

## Nền tảng dùng chung đã hoàn thiện để bắt đầu xây agent

- Catalog registry đọc được bằng máy đủ 17 agent: ID/version, mission, trigger, tool,
  risk ceiling và foundation dependency.
- Tool runtime dùng `AgentToolDefinition` chung cho schema input/output,
  permission, risk, approval, timeout, retry, idempotency, error và audit fields.
  Executor kiểm tra registry/version/schema/permission và từ chối command không
  có Action Gateway authority và kiểm tra cả permission lẫn required role.
  Registry chạy thật hiện có 16/24 tool catalog; ngoài inventory, order read,
  response draft, platform read và task đã có `incident.create/update`,
  `approval.request/decide`, `knowledge.propose`, `message.send`; coverage API
  công khai đúng 8 tool còn
  thiếu.
- Task orchestration có idempotency, assignee, deadline, priority, state machine
  và audit; create/assign/escalate đi qua Action Gateway tổng quát, policy
  ACTIVE, lease và Medusa workflow. Supervisor mỗi phút chủ động tạo escalation
  request cho task quá hạn. Escalation lưu reason, actor và thời điểm.
- Policy definition có version, hiệu lực và điều kiện deterministic `eq`, `gte`,
  `lte`, `in`; RBAC policy được đăng ký bằng `definePolicies`.
- Bootstrap tạo role tối thiểu `customer_support_staff` với đúng quyền đọc
  order/customer, đọc/cập nhật support task và tạo/thực thi yêu cầu chuyển quản
  lý. Script onboarding thay role `Super Admin` do Medusa CLI gán mặc định bằng
  role nhân viên này.
- Knowledge có lifecycle `DRAFT -> APPROVED -> RETIRED`, checksum, citation,
  owner, locale, scope, hiệu lực và expiry. Nội dung được chia thành các đoạn
  tìm kiếm ổn định; mỗi đoạn có checksum và locator riêng. Agent chỉ được dùng
  đoạn thuộc bản approved còn hiệu lực.
- Semantic RAG dùng LangChain.js và Qdrant mã nguồn mở. Qdrant chỉ là derived
  vector index; PostgreSQL vẫn là nguồn sự thật. Approval tự upsert chunks,
  retire tự xóa vectors; truy vấn semantic được lọc tenant/scope/locale rồi
  kiểm tra lại chunk thuộc tài liệu approved còn hiệu lực. Khi Qdrant hoặc
  embedding provider lỗi/chưa bật, `knowledge.search` tự rơi về lexical search.
- OpenAI và Gemini có thể làm embedding hoặc soạn câu trả lời; DeepSeek được
  hỗ trợ cho suy luận và soạn câu trả lời vì API chính thức chưa cung cấp
  embedding. Chủ cửa hàng kết nối provider từ Admin; API key được mã hóa trong
  PostgreSQL, không trả về browser. Workflow tự reindex knowledge khi đổi
  embedding provider/model và Qdrant dùng collection tách biệt theo
  provider/model.
- Model Gateway có adapter contract, redaction, token budget và structured
  output bắt buộc. OpenAI Responses adapter dùng JSON Schema strict, timeout,
  `store=false`, input tối thiểu và model-run ledger; Gemini adapter dùng JSON
  Schema; DeepSeek adapter dùng Chat Completions JSON mode và khóa server-side
  tương tự. Prompt Customer Support là cấu hình có
  phiên bản trong PostgreSQL, hiển thị và tùy chỉnh từ Admin, có prompt mặc định
  để khôi phục; model run ghi đúng prompt key/version đã dùng. Thiếu
  provider/key/model thì Customer Support giữ draft deterministic thay vì làm
  hỏng hàng đợi.
- Evaluation harness lưu scenario/run, expected/forbidden assertions và score.
  Baseline đã seed `SHIP-001`, `KNOW-001` và `ORDER-001`.
- Channel registry và delivery ledger hỗ trợ `IN_APP`, web push, Telegram, Zalo,
  Slack, Teams. Telegram chỉ lưu `env:...` secret reference; adapter xử lý
  `sendMessage`, receipt, retry và webhook `secret_token`, không ghi bot token
  vào database.
- Medusa Admin có trang `Agent Operations` xem readiness, incident, approval,
  task, knowledge, evaluation và catalog; quyết định approval bắt buộc có reason.
- Medusa Admin có trang `Knowledge Hub / Kho hướng dẫn của cửa hàng` để quản lý
  tạo bản nháp, duyệt, ngừng sử dụng, xem từng đoạn và thử câu hỏi bằng tiếng
  Việt hoặc tiếng Anh. Câu chữ giải thích rõ khi nào agent được phép sử dụng.
- Medusa Admin có route nghiệp vụ `Customer Support / Hỗ trợ khách hàng` tách
  khỏi control plane kỹ thuật. Nhân viên chỉ thấy câu hỏi, khách, trạng thái đơn,
  bản nháp, nguồn tham khảo và các nút nhận việc/hoàn tất/chuyển quản lý. Toàn bộ
  nội dung màn hình có resource tiếng Việt và tiếng Anh.
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
- Cả read và command đều chạy qua executor dùng chung; command contract cung
  cấp timeout/retry/idempotency và không thể gọi ở chế độ `DIRECT`.
- Cấm: coi snapshot trong event là quyền thực thi hoặc bỏ qua revalidation.

### Order Exception Agent

- ID/version: `order-exception-agent@0.1.0`.
- Trigger: `order.exception@1` với ba loại `PAYMENT_STUCK`,
  `FULFILLMENT_OVERDUE`, `MANUAL_REVIEW`.
- `order.read@1.0.0` gọi `getOrderDetailWorkflow` của Medusa và lấy trạng thái
  order/payment/fulfillment mới nhất trước khi quyết định.
- Luật deterministic đóng incident `RESOLVED` nếu tín hiệu đã cũ; nếu vẫn còn
  hiệu lực thì tạo recommendation và request `task.create` qua Action Gateway.
- Task chỉ yêu cầu người vận hành điều tra; contract cấm tự hủy đơn, capture hay
  hoàn tiền và cấm thay đổi fulfillment.
- Event, action và task đều có idempotency; recommendation lưu live order
  version làm bằng chứng; audit/outbox ghi lại quyết định.
- `ORDER-001` kiểm tra có live read và task, đồng thời cấm order/refund mutation.
- Job `detect-order-exceptions` chạy mỗi 5 phút và chỉ xét order có metadata
  `agent_payment_due_at` hoặc `agent_fulfillment_due_at`; không tự suy diễn SLA.
- Hook `createOrderWorkflow.orderCreated` phủ luồng API/OMS; subscriber
  `order.placed` gọi workflow idempotent để phủ checkout Medusa. Draft order bị
  bỏ qua, hàng không cần giao không nhận fulfillment SLA.
- Chính sách mặc định là 120 phút cho payment và 2.880 phút cho fulfillment;
  deadline OMS hợp lệ được giữ nguyên, deadline sai được thay bằng mặc định.
  Payment `authorized` không bị báo nhầm là payment stuck.
- Mỗi lượt quét đọc tối đa 5 trang x 100 order theo mặc định; cả page size và
  số trang đều cấu hình được nhưng có giới hạn cứng để bảo vệ database.
- Payment quá hạn được ưu tiên trước fulfillment; event ID ghép từ order, loại
  ngoại lệ và SLA due time nên quét lại không tạo incident/action/task trùng.
- Mỗi order lỗi được cô lập; detector re-read qua typed tool rồi ingestion
  workflow lại revalidate trước khi tạo task. Toàn bộ đoạn xử lý một order nằm
  trong distributed lock `agent-order-sla:<order_id>`.

### Customer Support Agent

- ID/version: `customer-support-agent@0.1.0`.
- Trigger đầu tiên: `support.requested@1`, hiện chỉ hỗ trợ câu hỏi
  `ORDER_STATUS` bằng tiếng Việt hoặc tiếng Anh.
- `order.read@1.0.0` lấy trạng thái order/payment/fulfillment trực tiếp từ
  Medusa. Customer ID trong request phải đúng chủ sở hữu của order, nếu không
  workflow fail-closed trước khi ghi event hay incident.
- `knowledge.search@1.0.0` chỉ lấy từng đoạn thuộc tài liệu scope
  `customer_support` đang `APPROVED`, còn hiệu lực và đúng locale; citation giữ
  document, chunk, locator, checksum và version để nhân viên kiểm tra đúng đoạn.
- `response.draft@1.0.0` tạo câu trả lời deterministic từ live order và
  knowledge. Khi model provider được bật, model chỉ được viết lại phần `body`
  từ live order và approved excerpts; citation/grounding/review flag do code
  gắn cố định. Nếu model lỗi hoặc thiếu knowledge, luồng deterministic tiếp tục.
- Mọi bản nháp đều có `requires_human_review=true`. Agent tạo recommendation
  `REVIEW_SUPPORT_RESPONSE` và request `task.create` qua Action Gateway với loại
  `SUPPORT_RESPONSE_REVIEW`.
- Luồng tiếp nhận chuẩn vẫn chỉ tạo bản nháp và task, không tự gửi khách. Chế độ
  thử nội bộ có thể tạo conversation `IN_APP`; chỉ nhân viên đã nhận task, hoàn
  tất kiểm tra và bấm xác nhận mới tạo action `message.send` qua Action Gateway.
  Action có idempotency key nên bấm lại không tạo tin thứ hai.
- Simulator được bảo vệ bằng đăng nhập Admin và quyền RBAC riêng
  `agent_support_simulator:create`; không còn công tắc môi trường riêng. Tin
  nhắn chỉ nằm trong database nội bộ, không gọi email, Telegram, Zalo hay khách
  thật.
- Route Admin `customer-support` dùng SDK session và query cache; nhân viên có
  thể nhận task, sửa draft, hoàn tất với `message_sent=false`, hoặc chuyển quản
  lý qua `task.escalate` trong Action Gateway. Màn hình không hiển thị event ID,
  correlation ID, tool call, model run hay JSON kỹ thuật.
- Nhân viên đang soạn có thể chọn “Trả lại cho nhân viên khác”. Workflow khóa
  theo task, chỉ chấp nhận đúng user đang phụ trách, xóa assignee và đưa task về
  `TODO`; mọi lần trả lại đều có audit. UI xác nhận trước và cảnh báo nội dung
  chưa lưu sẽ bị bỏ.

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

- `IN_APP` phục vụ Admin; Telegram tạo conversation `OPERATOR_CHAT` riêng theo
  connection và `chat_id` đã được ánh xạ tới Medusa user.
- Subscriber `agent.approval.requested` tạo notification idempotent từ outbox.
- Admin command hiện hỗ trợ `APPROVAL_DECISION` với `client_message_id` chống
  xử lý trùng.
- Conversation topic phải khớp `approval_id`; message sai topic bị từ chối.
- Command gọi lại approval workflow hiện có; không tạo mutation commerce hoặc
  ghi bảng nghiệp vụ trực tiếp.
- Kết quả command được ghi thành outbound `COMMAND_RESULT` và audit event.
- Telegram webhook chỉ nhận private text, kiểm tra
  `X-Telegram-Bot-Api-Secret-Token`, bỏ qua chat ngoài allowlist và suppress
  update trùng. Nội dung tự do hiện được lưu để xử lý, chưa tự biến thành lệnh.
- Outbound Telegram chỉ được tạo bởi `message.send` qua Action Gateway. Worker
  claim delivery bằng lease, gọi Bot API, lưu external message ID; lỗi retry
  exponential và quá giới hạn chuyển `DEAD`.
- Script `agent:configure-telegram` gọi `getMe`, đăng ký `setWebhook`, sau đó mới
  bật connection. Nếu Telegram từ chối, connection giữ `DISABLED`.
- Chưa có diễn giải chat tự do bằng LLM, push notification hoặc adapter
  Zalo/Slack/Teams/Messenger.

## API và persistence đã có

Admin API:

- `POST /admin/agent-operations/events`;
- `POST /admin/agent-operations/order-exceptions`;
- `POST /admin/agent-operations/support-requests`;
- `GET /admin/agent-operations/incidents`;
- `GET /admin/agent-operations/incidents/:id`;
- `GET /admin/agent-operations/approvals`;
- `POST /admin/agent-operations/approvals/:id/decision`.
- `GET /admin/agent-operations/actions`;
- `POST /admin/agent-operations/actions/requests` tạo command qua Action Gateway;
- `GET /admin/agent-operations/actions/:id`;
- `POST /admin/agent-operations/actions/:id/execute`;
- `GET /admin/agent-operations/tools` trả metadata serializable và coverage
  catalog/registry.
- `GET /admin/agent-operations/conversations`;
- `GET /admin/agent-operations/conversations/:id`;
- `POST /admin/agent-operations/conversations/:id/messages`.
- `GET /admin/agent-operations/catalog`;
- `GET /admin/agent-operations/platform/readiness`;
- `POST /admin/agent-operations/platform/bootstrap`;
- `GET|POST /admin/agent-operations/tasks`;
- `POST /admin/agent-operations/tasks/:id/transition`;
- `GET|POST /admin/agent-operations/knowledge`;
- `GET /admin/agent-operations/knowledge/:id` trả tài liệu và các đoạn;
- `POST /admin/agent-operations/knowledge/search` thử tìm nguồn đã duyệt;
- `POST /admin/agent-operations/knowledge/:id/approve`;
- `POST /admin/agent-operations/knowledge/:id/retire`;
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
- `agent_knowledge_chunk`;
- `agent_prompt_template`;
- `agent_model_run`;
- `agent_evaluation_scenario`;
- `agent_evaluation_run`;
- `agent_channel_connection`;
- `agent_delivery`.

## Bằng chứng hiện tại

Ngày kiểm chứng: 2026-08-11.

- Migration `Migration20260809174339` chạy thành công trên PostgreSQL local.
- Migration `Migration20260809180247` bổ sung lease expiry và chạy thành công.
- Migration `Migration20260809190225` tạo action request/tool call và chạy
  thành công trên PostgreSQL local.
- Migration `Migration20260809194213` tạo conversation/message và chạy thành
  công trên PostgreSQL local.
- Migration `Migration20260810073306` tổng quát hóa action context và bổ sung
  task escalation; migration chạy thành công, có backfill action inventory cũ.
- Migration `Migration20260810132610` lưu snapshot role được ủy quyền trên
  action request và đã chạy thành công trên PostgreSQL local.
- 134/134 unit test pass cho analyzer, detector, response draft, state machines, validators, tool contract,
  executor, registry coverage, tools, policy,
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
- Bootstrap PostgreSQL đã seed `ORDER-001`. Runtime verifier tạo order kiểm thử
  bằng workflow Medusa và chạy thành công event → live read → recommendation →
  Action Gateway → task trên PostgreSQL; event trùng bị suppress và order giữ
  nguyên status/version/canceled state.
- HTTP/RBAC verifier dùng hai User record tạm và JWT ngắn hạn: user có
  `operations_manager` nhận 201 rồi execute action nhận 202/`SUCCEEDED`; user
  không role nhận 403; request không đăng nhập nhận 401; hai nhánh bị chặn tạo
  0 event và user tạm được xóa trong `finally`.
- RBAC được bật mặc định trong `medusa-config.ts`; `.env.template` cũng khai báo
  `MEDUSA_FF_RBAC=true`, tránh route có policy nhưng vô tình chạy không enforce.
- Detector runtime tạo một order có payment SLA quá hạn: lần quét đầu tạo đúng
  một incident/action/task, lần quét hai trả duplicate, không có lỗi và order
  giữ nguyên status/version/canceled state.
- Redis race verifier chạy hai tiến trình Medusa đồng thời trên cùng tập order;
  cả hai kết nối `locking-redis`, không có scan error và order mục tiêu chỉ có
  đúng một event, một incident, một action request.
- SLA assignment verifier xác nhận cả hook tạo order và event checkout đều ghi
  policy `order-sla-default@1.0.0`; deadline tự sinh đi qua detector rồi tạo task
  `ORDER_PAYMENT_REVIEW`, action `SUCCEEDED` và không mutation order.
- Customer Support verifier tạo customer/order/knowledge thật, duyệt knowledge,
  rồi chạy `support.requested -> order.read -> knowledge.search ->
  response.draft -> task.create`. Kết quả có đúng 1 event, incident,
  recommendation, action, task và tool call; event trùng bị suppress; customer
  không sở hữu order bị từ chối trước model boundary, tạo 0 event và 0 model
  run; order không đổi; có 0
  conversation và 0 `message.send` action.
- Migration `Migration20260811052521` tạo bảng `agent_knowledge_chunk` đã chạy
  thành công. Script reindex đã chuyển 14 tài liệu cũ thành 14 đoạn có nguồn.
- Knowledge Hub verifier đã xác nhận trên PostgreSQL: bản nháp không xuất hiện
  khi tìm, bản đã duyệt trả đúng locator `#chunk-*` và checksum, bản ngừng sử
  dụng lập tức bị loại khỏi kết quả. Customer Support verifier chạy lại thành
  công với tìm kiếm theo đoạn, draft grounded và vẫn bắt buộc người duyệt.
- OpenAI Responses adapter có unit test kiểm tra JSON Schema strict,
  `store=false`, parse structured output và không đưa credential vào payload.
  API key, provider và model chỉ được lấy từ credential vault do quản lý cấu
  hình trong Admin; không còn fallback bí mật qua `.env`. Live model path chỉ
  được xác nhận sau khi kết nối provider thật và chạy kiểm thử nghiệp vụ.
- Knowledge Source Connector hiện chỉ nhận tài liệu người dùng chủ động chọn từ
  Google Drive. Google Docs, Google Sheets và tệp TXT/Markdown/CSV được nhận
  diện tự động; nội dung thay đổi chỉ tạo `DRAFT`, không tự xuất bản cho agent.
- Connector tải văn bản tùy ý từ website đã được gỡ khỏi API, workflow, Admin
  và cấu hình triển khai. Migration `Migration20260811122426` loại kiểu nguồn
  cũ nhưng giữ nguyên những knowledge document đã được tạo trước đó.
- Google knowledge adapter đã hỗ trợ Google Docs, Google Sheets và tệp
  TXT/Markdown/CSV bằng OAuth connector và Google Picker. Chủ shop đăng nhập rồi
  chọn từng tệp; quyền `drive.file` không mở toàn bộ Drive. Refresh token được
  mã hóa, callback chống CSRF bằng state/nonce có hạn dùng, disconnect cố thu hồi
  quyền và xóa credential. Migration `Migration20260811080525` đã chạy; gọi
  Google thật vẫn `RUNTIME-PENDING` đến khi có OAuth app production.
- LangChain.js `QdrantVectorStore` và Qdrant `1.19.0` đã được tích hợp. Runtime
  verifier đã upsert hai chunks, chứng minh metadata filter cô lập tenant và
  xóa vector khi tài liệu ngừng dùng. Live verifier gọi Gemini
  `gemini-embedding-001`, index 17 tài liệu/17 chunks và chứng minh fixture có
  lexical result bằng 0 nhưng semantic và hybrid result đều bằng 1; fixture sau
  đó được retire và vector được xóa.
- Customer Support live verifier gọi Gemini `gemini-3.5-flash-lite`, trả draft
  structured có hai citation và bắt buộc human review. Nhánh sai ownership tạo
  0 model run, nên dữ liệu order không vượt qua authorization gate.
- Inventory contention verifier tạo ba location và một inventory item bằng
  workflow Medusa, duyệt hai action cùng đòi chuyển 10 từ nguồn có 15, rồi chạy
  đồng thời dưới Redis lock. Kết quả một `SUCCEEDED`, một `CONFLICT`, nguồn còn
  5 và hai đích là 0/10; toàn bộ fixture được cleanup bằng workflow chính thức.
- Customer Support staff-flow verifier dùng hai User record tạm và JWT ngắn
  hạn: user có role nhận 201, user thiếu role nhận 403, request chưa đăng nhập
  nhận 401; hai nhánh bị chặn tạo 0 event. Worker tạo task thật; nhân viên nhận
  `TODO -> CLAIMED -> IN_PROGRESS -> COMPLETED`, lưu bản trả lời đã duyệt với
  `message_sent=false`; nhánh `task.escalate` chuyển việc cho team
  `operations_manager` với priority HIGH. Verifier giữ lại một customer, một
  order và hai task TODO Việt/Anh làm dữ liệu demo, nhưng tự xóa user tạm.
- Customer Support UI lint/build thành công bằng Medusa Admin; cả `vi` và `en`
  resource được compile. Browser bằng tài khoản `customer_support_staff` thật
  đã xác nhận nhận task, sửa/lưu câu trả lời, trả lại hàng đợi, chuyển quản lý
  và đổi VI/EN. Lần kiểm thử này phát hiện UI dùng nhầm `incident_id` làm
  `correlation_id`; API task đã trả correlation thật và Action Gateway chuyển
  quản lý thành công sau khi sửa.
- Support simulator verifier chạy API thật với đúng role
  `customer_support_staff`: tạo một tin khách `INBOUND`, hoàn thành task rồi
  xác nhận một tin `OUTBOUND`. Gửi khi chưa duyệt và gửi bằng nhân viên khác đều
  bị chặn; gọi lại cùng yêu cầu không tạo tin/action thứ hai. Kết quả chỉ lưu ở
  kênh `IN_APP`, chưa có external delivery.
- Migration `Migration20260809200756` tạo 9 bảng nền mới; migration RBAC chính
  thức của Medusa cũng chạy thành công.
- Bootstrap có tính idempotent; role `operations_manager` có đúng 21
  policy active do Medusa tự đồng bộ từ `definePolicies`.
- Runtime platform xác nhận task `TODO -> CLAIMED -> IN_PROGRESS -> COMPLETED`,
  knowledge `DRAFT -> APPROVED`, `SHIP-001` đạt `PASSED` và evaluation trùng bị
  suppress.
- Runtime task gateway xác nhận request trùng bị suppress; không có policy thì
  fail-closed và không ghi action; create/assign/escalate đều `SUCCEEDED`; stale
  expected state trả `CONFLICT`; mỗi action có đúng một tool call.
- Runtime platform xác nhận `knowledge.propose` tạo đúng tài liệu `DRAFT` qua
  Action Gateway rồi mới được workflow người dùng duyệt thành `APPROVED`.
- Supervisor định kỳ hết hạn approval quá giờ thành `EXPIRED`, đưa incident đang
  chờ sang `ESCALATED`, và tạo task escalation qua Action Gateway; từng record
  lỗi được cô lập để không chặn cả batch.
- Redis container healthy; Event Bus Redis, Workflow Engine Redis và Locking
  Redis đều kết nối thành công khi bật production switch.
- Production server trên cổng kiểm thử phục vụ `/app` với HTTP 200; catalog API
  không có session trả đúng HTTP 401.

## Gate tiếp theo

1. Bổ sung customer channel có identity mapping, consent, delivery receipt và
   bước nhân viên xác nhận gửi; chưa bật agent tự gửi.
2. Gán role `operations_manager` cho tài khoản Admin thật và kiểm thử allow/deny
   trên từng policy qua HTTP.
3. Chạy inventory contention bằng hai process/worker riêng, bổ sung tương tác
   reservation và xác nhận lại trên stock location vận hành thật.
4. Bổ sung trace/replay detail, append-only/retention và subscriber idempotency
   cho từng connector production.
5. Cấu hình bot Telegram thật và public HTTPS để chạy acceptance; sau đó thêm UI
   quản lý connection. Tiếp tục xây push/Zalo/Slack/Teams/Messenger rồi mới
   thêm hiểu chat tự do bằng LLM.
6. Benchmark Gemini generation/embedding với bộ `KNOW-001` VI/EN, đặt budget,
   rate-limit và security review trước production rollout.
7. Google OAuth/Picker đã kết nối; cần người dùng chọn Docs/Sheets thật để chạy
   acceptance import. Sau đó thêm lịch đồng bộ, review diff, phát hiện nội
   dung thiếu/xung đột và retry/dead recovery qua worker. Notion/PDF cần adapter
   riêng theo cùng connector contract.
8. Hiệu chỉnh số phút SLA theo vận hành thật; khi vượt giới hạn batch cấu hình,
   chuyển detector sang SLA table có index hoặc durable cursor.
9. Sau lát cắt hỗ trợ khách hàng, triển khai Fulfillment Agent từ SLA contract
   và connector vận chuyển thật; không tạo tool placeholder.
