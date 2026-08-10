import assert from "node:assert/strict"
import {
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

type HttpConfig = {
  jwtExpiresIn?: string | number
  jwtOptions?: Record<string, unknown>
  jwtSecret: string
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
      auth_identity_id: "agent-http-rbac-verifier",
      user_metadata: {},
    },
    {
      expiresIn: http.jwtExpiresIn ?? "5m",
      jwtOptions: http.jwtOptions,
      secret: http.jwtSecret,
    }
  )
}

async function postOrderException(
  baseUrl: string,
  eventId: string,
  orderId: string,
  token?: string
) {
  return fetch(`${baseUrl}/admin/agent-operations/order-exceptions`, {
    body: JSON.stringify({
      correlation_id: eventId,
      event_id: eventId,
      event_type: "order.exception",
      event_version: 1,
      occurred_at: new Date().toISOString(),
      payload: {
        detected_at: new Date().toISOString(),
        exception_type: "MANUAL_REVIEW",
        order_id: orderId,
      },
      source: "agent-http-rbac-verifier",
      subject_id: orderId,
      subject_type: "order",
      tenant_id: "default",
    }),
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
    },
    method: "POST",
  })
}

export default async function verifyAgentHttpRbac({ container }: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
  const rbac = container.resolve<IRbacModuleService>(Modules.RBAC)
  const config = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as {
    projectConfig: { http: HttpConfig }
  }
  const baseUrl = process.env.AGENT_HTTP_BASE_URL ?? "http://localhost:9000"
  const verificationId = `verify-agent-http-rbac-${Date.now()}`
  const role = (await rbac.listRbacRoles({ name: "operations_manager" }))[0]
  const candidateOrders = await orders.listOrders({}, { take: 100 })
  const order = candidateOrders.find(
    (candidate) =>
      !["archived", "canceled", "completed"].includes(candidate.status)
  )

  assert.ok(role, "operations_manager role must be bootstrapped")
  assert.ok(order, "a non-terminal order is required for HTTP verification")

  const { result: users } = await createUsersWorkflow(container).run({
    input: {
      users: [
        {
          email: `${verificationId}-allow@local.invalid`,
          first_name: "Agent RBAC",
          last_name: "Allowed",
          metadata: { purpose: "agent-http-rbac-verification" },
          roles: [role.id],
        },
        {
          email: `${verificationId}-deny@local.invalid`,
          first_name: "Agent RBAC",
          last_name: "Denied",
          metadata: { purpose: "agent-http-rbac-verification" },
        },
      ],
    },
  })
  const allowedUser = users[0]
  const deniedUser = users[1]

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
    const allowedEventId = `${verificationId}:allowed`
    const deniedEventId = `${verificationId}:denied`
    const unauthenticatedEventId = `${verificationId}:unauthenticated`
    const allowedResponse = await postOrderException(
      baseUrl,
      allowedEventId,
      order.id,
      allowedToken
    )
    const deniedResponse = await postOrderException(
      baseUrl,
      deniedEventId,
      order.id,
      deniedToken
    )
    const unauthenticatedResponse = await postOrderException(
      baseUrl,
      unauthenticatedEventId,
      order.id
    )

    assert.equal(allowedResponse.status, 201)
    assert.equal(deniedResponse.status, 403)
    assert.equal(unauthenticatedResponse.status, 401)

    const allowedBody = (await allowedResponse.json()) as {
      action_request?: { id: string; status: string; tool_name: string }
      incident?: { id: string }
    }
    assert.equal(allowedBody.action_request?.status, "PENDING")
    assert.equal(allowedBody.action_request?.tool_name, "task.create")
    assert.ok(allowedBody.incident?.id)
    assert.ok(allowedBody.action_request?.id)

    const executeResponse = await fetch(
      `${baseUrl}/admin/agent-operations/actions/${allowedBody.action_request.id}/execute`,
      {
        headers: { authorization: `Bearer ${allowedToken}` },
        method: "POST",
      }
    )
    assert.equal(executeResponse.status, 202)
    const executeBody = (await executeResponse.json()) as {
      action: { status: string }
    }
    assert.equal(executeBody.action.status, "SUCCEEDED")

    const allowedEvents = await service.listAgentEvents({
      event_id: allowedEventId,
      source: "agent-http-rbac-verifier",
    })
    const deniedEvents = await service.listAgentEvents({
      event_id: deniedEventId,
      source: "agent-http-rbac-verifier",
    })
    const unauthenticatedEvents = await service.listAgentEvents({
      event_id: unauthenticatedEventId,
      source: "agent-http-rbac-verifier",
    })
    const tasks = await service.listAgentTasks({
      incident_id: allowedBody.incident.id,
    })
    const toolCalls = await service.listAgentToolCalls({
      action_request_id: allowedBody.action_request.id,
    })

    assert.equal(allowedEvents.length, 1)
    assert.equal(deniedEvents.length, 0)
    assert.equal(unauthenticatedEvents.length, 0)
    assert.equal(tasks.length, 1)
    assert.equal(toolCalls.length, 1)

    console.log(
      JSON.stringify(
        {
          action_request_id: allowedBody.action_request?.id,
          allowed_http_status: allowedResponse.status,
          allowed_records_created: allowedEvents.length,
          denied_http_status: deniedResponse.status,
          denied_records_created: deniedEvents.length,
          execute_http_status: executeResponse.status,
          executed_action_status: executeBody.action.status,
          incident_id: allowedBody.incident?.id,
          status: "VERIFIED",
          temporary_users_cleaned_up: true,
          tasks_created: tasks.length,
          tool_calls_created: toolCalls.length,
          unauthenticated_http_status: unauthenticatedResponse.status,
          unauthenticated_records_created: unauthenticatedEvents.length,
        },
        null,
        2
      )
    )
  } finally {
    await deleteUsersWorkflow(container).run({
      input: { ids: users.map((user) => user.id) },
    })
  }
}
