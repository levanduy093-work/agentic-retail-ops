import assert from "node:assert/strict"
import { createUsersWorkflow, deleteUsersWorkflow } from "@medusajs/core-flows"
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

type HttpConfig = {
  jwtExpiresIn?: string | number
  jwtOptions?: Record<string, unknown>
  jwtSecret: string
}

function createAdminToken(userId: string, roleId: string, http: HttpConfig) {
  return generateJwtToken(
    {
      actor_id: userId,
      actor_type: "user",
      app_metadata: { roles: [roleId], user_id: userId },
      auth_identity_id: "support-simulator-verifier",
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
  token: string
) {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    method: "POST",
  })
  const payload = (await response.json()) as Record<string, any>

  return { payload, response }
}

export default async function verifySupportSimulator({ container }: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
  const rbac = container.resolve<IRbacModuleService>(Modules.RBAC)
  const config = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as {
    projectConfig: { http: HttpConfig }
  }
  const baseUrl = process.env.AGENT_HTTP_BASE_URL ?? "http://localhost:9000"
  const verificationId = `support-simulator-${Date.now()}`
  const role = (await rbac.listRbacRoles({ name: "customer_support_staff" }))[0]
  const order = (
    await orders.listOrders({}, { order: { created_at: "DESC" }, take: 100 })
  ).find((candidate) => Boolean(candidate.customer_id))

  assert.ok(role, "customer_support_staff role must be bootstrapped")
  assert.ok(order?.customer_id, "an order linked to a customer is required")

  const { result: users } = await createUsersWorkflow(container).run({
    input: {
      users: [
        {
          email: `${verificationId}@local.invalid`,
          first_name: "Support Simulator",
          last_name: "Verifier",
          metadata: { purpose: "support-simulator-verification" },
          roles: [role.id],
        },
        {
          email: `${verificationId}-other@local.invalid`,
          first_name: "Other Support",
          last_name: "Verifier",
          metadata: { purpose: "support-simulator-ownership-verification" },
          roles: [role.id],
        },
      ],
    },
  })
  const user = users[0]
  const otherUser = users[1]

  try {
    const token = createAdminToken(
      user.id,
      role.id,
      config.projectConfig.http
    )
    const otherToken = createAdminToken(
      otherUser.id,
      role.id,
      config.projectConfig.http
    )
    const create = await postJson(
      `${baseUrl}/admin/agent-operations/support-simulator/messages`,
      {
        client_message_id: verificationId,
        customer_id: order.customer_id,
        locale: "vi",
        order_id: order.id,
        question: "Đơn hàng của tôi đã thanh toán chưa và khi nào được giao?",
      },
      token
    )

    assert.equal(create.response.status, 201, JSON.stringify(create.payload))
    assert.equal(create.payload.message.direction, "INBOUND")
    assert.equal(create.payload.conversation.channel, "IN_APP")
    assert.equal(create.payload.action.status, "SUCCEEDED")

    const [task] = await service.listAgentTasks({
      incident_id: create.payload.incident.id,
    })
    assert.ok(task)

    const prematureSend = await postJson(
      `${baseUrl}/admin/agent-operations/tasks/${task.id}/send-simulator-reply`,
      { expected_task_updated_at: new Date(task.updated_at).toISOString() },
      token
    )
    assert.equal(prematureSend.response.status, 400)

    for (const transition of [
      {
        assigned_to_id: user.id,
        assigned_to_type: "user",
        expected_status: "TODO",
        status: "CLAIMED",
      },
      { expected_status: "CLAIMED", status: "IN_PROGRESS" },
    ]) {
      const result = await postJson(
        `${baseUrl}/admin/agent-operations/tasks/${task.id}/transition`,
        transition,
        token
      )
      assert.equal(result.response.status, 200, JSON.stringify(result.payload))
    }

    const reviewedResponse =
      "Đơn hàng đang chờ xử lý và chưa thanh toán. Nhân viên đã kiểm tra thông tin này trên hệ thống."
    const complete = await postJson(
      `${baseUrl}/admin/agent-operations/tasks/${task.id}/transition`,
      {
        expected_status: "IN_PROGRESS",
        result: {
          message_sent: false,
          response_body: reviewedResponse,
          review_language: "vi-VN",
          reviewed_by_human: true,
        },
        status: "COMPLETED",
      },
      token
    )
    assert.equal(complete.response.status, 200, JSON.stringify(complete.payload))
    const completedTask = await service.retrieveAgentTask(task.id)
    const expectedUpdatedAt = new Date(completedTask.updated_at).toISOString()

    const otherEmployeeSend = await postJson(
      `${baseUrl}/admin/agent-operations/tasks/${task.id}/send-simulator-reply`,
      { expected_task_updated_at: expectedUpdatedAt },
      otherToken
    )
    assert.equal(otherEmployeeSend.response.status, 400)

    const send = await postJson(
      `${baseUrl}/admin/agent-operations/tasks/${task.id}/send-simulator-reply`,
      { expected_task_updated_at: expectedUpdatedAt },
      token
    )
    assert.equal(send.response.status, 201, JSON.stringify(send.payload))
    assert.equal(send.payload.action.status, "SUCCEEDED")
    assert.equal(send.payload.sent, true)
    assert.equal(send.payload.task.result.message_sent, true)

    const duplicate = await postJson(
      `${baseUrl}/admin/agent-operations/tasks/${task.id}/send-simulator-reply`,
      { expected_task_updated_at: expectedUpdatedAt },
      token
    )
    assert.equal(duplicate.response.status, 200, JSON.stringify(duplicate.payload))
    assert.equal(duplicate.payload.duplicate, true)

    const messages = await service.listAgentMessages(
      { conversation_id: create.payload.conversation.id },
      { order: { occurred_at: "ASC" } }
    )
    const outbound = messages.filter((message) => message.direction === "OUTBOUND")
    const sendActions = await service.listAgentActionRequests({
      incident_id: create.payload.incident.id,
      tool_name: "message.send",
    })

    assert.equal(messages.length, 2)
    assert.equal(outbound.length, 1)
    assert.equal(outbound[0].body, reviewedResponse)
    assert.equal(sendActions.length, 1)

    console.log(
      JSON.stringify(
        {
          conversation_id: create.payload.conversation.id,
          duplicate_send_prevented: true,
          other_employee_send_blocked: true,
          premature_send_blocked: true,
          inbound_messages: 1,
          outbound_messages: outbound.length,
          real_external_delivery: false,
          status: "SUPPORT_SIMULATOR_VERIFIED",
          task_id: task.id,
        },
        null,
        2
      )
    )
  } finally {
    await deleteUsersWorkflow(container).run({
      input: { ids: users.map((candidate) => candidate.id) },
    })
  }
}
