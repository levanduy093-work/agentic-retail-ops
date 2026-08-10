import assert from "node:assert/strict"
import {
  createCustomersWorkflow,
  createOrderWorkflow,
  createUsersWorkflow,
  deleteUsersWorkflow,
} from "@medusajs/core-flows"
import type {
  ExecArgs,
  IOrderModuleService,
  IRbacModuleService,
} from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  generateJwtToken,
  Modules,
} from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { approveKnowledgeDocumentWorkflow } from "../workflows/agent-operations/approve-knowledge-document"
import { createKnowledgeDocumentWorkflow } from "../workflows/agent-operations/create-knowledge-document"

type HttpConfig = {
  jwtExpiresIn?: string | number
  jwtOptions?: Record<string, unknown>
  jwtSecret: string
}

type SupportResponseBody = {
  action_request: { id: string; status: string; tool_name: string }
  draft: {
    body: string
    citations: Array<{ locator: string }>
    grounded: boolean
    requires_human_review: boolean
  }
  incident: { id: string }
}

type ActionResponseBody = {
  action: { id: string; status: string }
}

function createAdminToken(
  userId: string,
  roleIds: string[],
  http: HttpConfig
) {
  return generateJwtToken(
    {
      actor_id: userId,
      actor_type: "user",
      app_metadata: {
        roles: roleIds,
        user_id: userId,
      },
      auth_identity_id: "customer-support-staff-flow-verifier",
      user_metadata: {},
    },
    {
      expiresIn: http.jwtExpiresIn ?? "10m",
      jwtOptions: http.jwtOptions,
      secret: http.jwtSecret,
    }
  )
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
  token?: string
) {
  return fetch(url, {
    body: JSON.stringify(body),
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
    },
    method: "POST",
  })
}

async function postSupportRequest(input: {
  baseUrl: string
  customerId: string
  eventId: string
  locale: "en" | "vi"
  orderId: string
  question: string
  token?: string
}) {
  const occurredAt = new Date().toISOString()

  return postJson(
    `${input.baseUrl}/admin/agent-operations/support-requests`,
    {
      correlation_id: input.eventId,
      event_id: input.eventId,
      event_type: "support.requested",
      event_version: 1,
      occurred_at: occurredAt,
      payload: {
        customer_id: input.customerId,
        locale: input.locale,
        order_id: input.orderId,
        question: input.question,
        request_type: "ORDER_STATUS",
        requested_at: occurredAt,
      },
      source: "customer-support-staff-flow-verifier",
      subject_id: input.orderId,
      subject_type: "order",
      tenant_id: "default",
    },
    input.token
  )
}

async function executeAction(baseUrl: string, actionId: string, token: string) {
  const response = await fetch(
    `${baseUrl}/admin/agent-operations/actions/${actionId}/execute`,
    {
      headers: { authorization: `Bearer ${token}` },
      method: "POST",
    }
  )
  const body = (await response.json()) as ActionResponseBody

  assert.equal(response.status, 202)
  assert.equal(body.action.status, "SUCCEEDED")

  return body
}

async function createSupportTask(input: {
  baseUrl: string
  customerId: string
  eventId: string
  locale: "en" | "vi"
  orderId: string
  question: string
  token: string
}) {
  const response = await postSupportRequest(input)
  const body = (await response.json()) as SupportResponseBody

  assert.equal(response.status, 201)
  assert.equal(body.action_request.status, "PENDING")
  assert.equal(body.action_request.tool_name, "task.create")
  assert.equal(body.draft.grounded, true)
  assert.equal(body.draft.requires_human_review, true)
  assert.ok(body.draft.citations.length >= 1)

  await executeAction(input.baseUrl, body.action_request.id, input.token)

  return body
}

async function transitionTask(input: {
  baseUrl: string
  body: Record<string, unknown>
  expectedHttpStatus?: number
  taskId: string
  token: string
}) {
  const response = await postJson(
    `${input.baseUrl}/admin/agent-operations/tasks/${input.taskId}/transition`,
    input.body,
    input.token
  )

  assert.equal(response.status, input.expectedHttpStatus ?? 200)

  return response
}

export default async function verifyCustomerSupportStaffFlow({
  container,
}: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
  const rbac = container.resolve<IRbacModuleService>(Modules.RBAC)
  const config = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as {
    projectConfig: { http: HttpConfig }
  }
  const baseUrl = process.env.AGENT_HTTP_BASE_URL ?? "http://localhost:9000"
  const verificationId = `customer-support-staff-flow-${Date.now()}`
  const role = (await rbac.listRbacRoles({ name: "operations_manager" }))[0]

  assert.ok(role, "operations_manager role must be bootstrapped")

  const { result: users } = await createUsersWorkflow(container).run({
    input: {
      users: [
        {
          email: `${verificationId}-allowed@local.invalid`,
          first_name: "Support Staff",
          last_name: "Allowed",
          metadata: { purpose: "customer-support-staff-flow-verification" },
          roles: [role.id],
        },
        {
          email: `${verificationId}-denied@local.invalid`,
          first_name: "Support Staff",
          last_name: "Denied",
          metadata: { purpose: "customer-support-staff-flow-verification" },
        },
      ],
    },
  })
  const allowedUser = users[0]
  const deniedUser = users[1]
  let report: Record<string, unknown> | undefined

  try {
    const allowedToken = createAdminToken(
      allowedUser.id,
      [role.id],
      config.projectConfig.http
    )
    const deniedToken = createAdminToken(
      deniedUser.id,
      [],
      config.projectConfig.http
    )
    const demoUnitPriceInVnd = 349_000
    const [{ id: customerId }] = (
      await createCustomersWorkflow(container).run({
        input: {
          customersData: [
            {
              email: `${verificationId}@example.com`,
              first_name: "Minh Anh",
              last_name: "Nguyễn",
              metadata: {
                purpose: "customer-support-employee-ui-demo",
              },
            },
          ],
        },
      })
    ).result
    const { result: order } = await createOrderWorkflow(container).run({
      input: {
        currency_code: "vnd",
        customer_id: customerId,
        items: [
          {
            is_discountable: false,
            is_tax_inclusive: true,
            quantity: 1,
            requires_shipping: false,
            title: "Áo sơ mi demo hỗ trợ khách hàng",
            unit_price: demoUnitPriceInVnd,
          },
        ],
        metadata: {
          purpose: "customer-support-employee-ui-demo",
          verification_id: verificationId,
        },
        no_notification: true,
        status: "pending",
      },
    })
    const now = new Date()
    const knowledgeDocuments = [
      {
        citation_locator: `policy://customer-support/order-status/vi/${verificationId}`,
        content:
          "Khi khách hỏi trạng thái đơn hàng, nhân viên phải kiểm tra dữ liệu thanh toán và giao hàng trực tiếp trên hệ thống. Bản nháp phải được con người duyệt trước khi gửi.",
        document_key: `customer-support-order-status-vi-${verificationId}`,
        locale: "vi",
        title: "Hướng dẫn trạng thái đơn hàng",
      },
      {
        citation_locator: `policy://customer-support/order-status/en/${verificationId}`,
        content:
          "When a customer asks about an order, staff must verify live payment and fulfillment data. A human must review the draft before it is sent.",
        document_key: `customer-support-order-status-en-${verificationId}`,
        locale: "en",
        title: "Order status response guide",
      },
    ]
    const approvedKnowledgeIds: string[] = []

    for (const knowledge of knowledgeDocuments) {
      const { result: creation } = await createKnowledgeDocumentWorkflow(
        container
      ).run({
        input: {
          ...knowledge,
          effective_at: new Date(now.getTime() - 60_000).toISOString(),
          owner_id: "customer-support-staff-flow-verifier",
          scope: "customer_support",
          tenant_id: "default",
          version: "1.0.0",
        },
      })
      const { result: approval } = await approveKnowledgeDocumentWorkflow(
        container
      ).run({
        input: {
          actor_id: allowedUser.id,
          document_id: creation.document.id,
        },
      })

      assert.equal(approval.document.status, "APPROVED")
      approvedKnowledgeIds.push(approval.document.id)
    }

    const orderBefore = await orders.retrieveOrder(order.id)
    const allowedEventId = `${verificationId}:allowed`
    const deniedEventId = `${verificationId}:denied`
    const unauthenticatedEventId = `${verificationId}:unauthenticated`
    const allowedResponse = await postSupportRequest({
      baseUrl,
      customerId,
      eventId: allowedEventId,
      locale: "vi",
      orderId: order.id,
      question: "Đơn hàng của tôi đang ở trạng thái nào?",
      token: allowedToken,
    })
    const deniedResponse = await postSupportRequest({
      baseUrl,
      customerId,
      eventId: deniedEventId,
      locale: "vi",
      orderId: order.id,
      question: "Yêu cầu này phải bị từ chối vì thiếu quyền.",
      token: deniedToken,
    })
    const unauthenticatedResponse = await postSupportRequest({
      baseUrl,
      customerId,
      eventId: unauthenticatedEventId,
      locale: "vi",
      orderId: order.id,
      question: "Yêu cầu này phải bị từ chối vì chưa đăng nhập.",
    })

    assert.equal(allowedResponse.status, 201)
    assert.equal(deniedResponse.status, 403)
    assert.equal(unauthenticatedResponse.status, 401)

    const allowedBody = (await allowedResponse.json()) as SupportResponseBody
    assert.equal(allowedBody.action_request.status, "PENDING")
    assert.equal(allowedBody.action_request.tool_name, "task.create")
    assert.equal(allowedBody.draft.grounded, true)
    assert.equal(allowedBody.draft.requires_human_review, true)
    assert.ok(allowedBody.draft.citations.length >= 1)
    await executeAction(baseUrl, allowedBody.action_request.id, allowedToken)

    const deniedEvents = await service.listAgentEvents({
      event_id: deniedEventId,
      source: "customer-support-staff-flow-verifier",
    })
    const unauthenticatedEvents = await service.listAgentEvents({
      event_id: unauthenticatedEventId,
      source: "customer-support-staff-flow-verifier",
    })
    assert.equal(deniedEvents.length, 0)
    assert.equal(unauthenticatedEvents.length, 0)

    const [completedTask] = await service.listAgentTasks({
      incident_id: allowedBody.incident.id,
    })
    assert.ok(completedTask)

    const tasksResponse = await fetch(
      `${baseUrl}/admin/agent-operations/tasks`,
      { headers: { authorization: `Bearer ${allowedToken}` } }
    )
    const tasksBody = (await tasksResponse.json()) as {
      tasks: Array<{ id: string }>
    }
    assert.equal(tasksResponse.status, 200)
    assert.ok(tasksBody.tasks.some((task) => task.id === completedTask.id))

    await transitionTask({
      baseUrl,
      body: {
        assigned_to_id: allowedUser.id,
        assigned_to_type: "user",
        expected_status: "TODO",
        status: "CLAIMED",
      },
      taskId: completedTask.id,
      token: allowedToken,
    })
    await transitionTask({
      baseUrl,
      body: {
        expected_status: "CLAIMED",
        status: "IN_PROGRESS",
      },
      taskId: completedTask.id,
      token: allowedToken,
    })
    const reviewedResponse =
      "Đơn hàng đã được nhân viên kiểm tra trên hệ thống. Bản trả lời này mới chỉ hoàn tất duyệt nội bộ và chưa được gửi cho khách."
    await transitionTask({
      baseUrl,
      body: {
        expected_status: "IN_PROGRESS",
        result: {
          message_sent: false,
          response_body: reviewedResponse,
          review_language: "vi-VN",
          reviewed_by_human: true,
        },
        status: "COMPLETED",
      },
      taskId: completedTask.id,
      token: allowedToken,
    })

    const completedTaskAfter = await service.retrieveAgentTask(completedTask.id)
    const completedResult = completedTaskAfter.result as Record<string, unknown>
    assert.equal(completedTaskAfter.status, "COMPLETED")
    assert.equal(completedTaskAfter.assigned_to_id, allowedUser.id)
    assert.equal(completedTaskAfter.assigned_to_type, "user")
    assert.equal(completedResult.message_sent, false)
    assert.equal(completedResult.reviewed_by_human, true)
    assert.equal(completedResult.response_body, reviewedResponse)

    const escalationBody = await createSupportTask({
      baseUrl,
      customerId,
      eventId: `${verificationId}:escalation`,
      locale: "vi",
      orderId: order.id,
      question: "Khách yêu cầu ngoại lệ cần quản lý cửa hàng quyết định.",
      token: allowedToken,
    })
    const [escalatedTask] = await service.listAgentTasks({
      incident_id: escalationBody.incident.id,
    })
    assert.ok(escalatedTask)

    const escalationRequestResponse = await postJson(
      `${baseUrl}/admin/agent-operations/actions/requests`,
      {
        correlation_id: `${verificationId}:escalation`,
        idempotency_key: `${verificationId}:escalate-task`,
        incident_id: escalationBody.incident.id,
        input: {
          assigned_to_id: "operations_manager",
          assigned_to_type: "team",
          expected_status: "TODO",
          priority: "HIGH",
          reason: "Khách yêu cầu ngoại lệ cần quản lý cửa hàng quyết định.",
          task_id: escalatedTask.id,
        },
        tenant_id: "default",
        tool_name: "task.escalate",
        tool_version: "1.0.0",
      },
      allowedToken
    )
    const escalationRequestBody =
      (await escalationRequestResponse.json()) as ActionResponseBody
    assert.equal(escalationRequestResponse.status, 202)
    assert.equal(escalationRequestBody.action.status, "PENDING")
    await executeAction(
      baseUrl,
      escalationRequestBody.action.id,
      allowedToken
    )

    const escalatedTaskAfter = await service.retrieveAgentTask(escalatedTask.id)
    assert.equal(escalatedTaskAfter.assigned_to_id, "operations_manager")
    assert.equal(escalatedTaskAfter.assigned_to_type, "team")
    assert.equal(escalatedTaskAfter.priority, "HIGH")
    assert.equal(
      escalatedTaskAfter.escalation_reason,
      "Khách yêu cầu ngoại lệ cần quản lý cửa hàng quyết định."
    )

    const viDemo = await createSupportTask({
      baseUrl,
      customerId,
      eventId: `${verificationId}:demo-vi`,
      locale: "vi",
      orderId: order.id,
      question: "Đơn hàng của tôi đã được thanh toán và khi nào được giao?",
      token: allowedToken,
    })
    const enDemo = await createSupportTask({
      baseUrl,
      customerId,
      eventId: `${verificationId}:demo-en`,
      locale: "en",
      orderId: order.id,
      question: "Has my order been paid and when will it be delivered?",
      token: allowedToken,
    })
    const [viDemoTask] = await service.listAgentTasks({
      incident_id: viDemo.incident.id,
    })
    const [enDemoTask] = await service.listAgentTasks({
      incident_id: enDemo.incident.id,
    })
    assert.ok(viDemoTask)
    assert.ok(enDemoTask)
    assert.equal(viDemoTask.status, "TODO")
    assert.equal(enDemoTask.status, "TODO")

    const testedIncidentIds = [
      allowedBody.incident.id,
      escalationBody.incident.id,
      viDemo.incident.id,
      enDemo.incident.id,
    ]
    let conversationCount = 0
    let messageSendActionCount = 0

    for (const incidentId of testedIncidentIds) {
      conversationCount += (
        await service.listAgentConversations({ incident_id: incidentId })
      ).length
      messageSendActionCount += (
        await service.listAgentActionRequests({
          incident_id: incidentId,
          tool_name: "message.send",
        })
      ).length
    }

    const allowedEvents = await service.listAgentEvents({
      event_id: allowedEventId,
      source: "customer-support-staff-flow-verifier",
    })
    const orderAfter = await orders.retrieveOrder(order.id)

    assert.equal(allowedEvents.length, 1)
    assert.equal(conversationCount, 0)
    assert.equal(messageSendActionCount, 0)
    assert.equal(orderAfter.status, orderBefore.status)
    assert.equal(orderAfter.version, orderBefore.version)
    assert.equal(orderAfter.canceled_at, orderBefore.canceled_at)

    report = {
      approved_knowledge_ids: approvedKnowledgeIds,
      customer_id: customerId,
      demo: {
        en_task_id: enDemoTask.id,
        employee_ui: `${baseUrl}/app/customer-support`,
        order_display_id: order.display_id,
        order_id: order.id,
        vi_task_id: viDemoTask.id,
      },
      employee_flow: {
        assigned_to_user: completedTaskAfter.assigned_to_id === allowedUser.id,
        completed_task_id: completedTaskAfter.id,
        message_sent: completedResult.message_sent,
        reviewed_by_human: completedResult.reviewed_by_human,
        status: completedTaskAfter.status,
      },
      escalation_flow: {
        assigned_to_id: escalatedTaskAfter.assigned_to_id,
        assigned_to_type: escalatedTaskAfter.assigned_to_type,
        priority: escalatedTaskAfter.priority,
        task_id: escalatedTaskAfter.id,
      },
      http_rbac: {
        allowed: allowedResponse.status,
        denied: deniedResponse.status,
        denied_records_created: deniedEvents.length,
        unauthenticated: unauthenticatedResponse.status,
        unauthenticated_records_created: unauthenticatedEvents.length,
      },
      safety: {
        conversations_created: conversationCount,
        message_send_actions_created: messageSendActionCount,
        order_unchanged:
          orderAfter.status === orderBefore.status &&
          orderAfter.version === orderBefore.version &&
          orderAfter.canceled_at === orderBefore.canceled_at,
      },
      status: "CUSTOMER_SUPPORT_STAFF_FLOW_VERIFIED",
    }
  } finally {
    await deleteUsersWorkflow(container).run({
      input: { ids: users.map((user) => user.id) },
    })
  }

  assert.ok(report)
  console.log(
    JSON.stringify(
      { ...report, temporary_users_cleaned_up: true },
      null,
      2
    )
  )
}
