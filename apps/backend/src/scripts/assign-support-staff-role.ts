import assert from "node:assert/strict"
import {
  assignUserRolesWorkflow,
  removeUserRolesWorkflow,
  updateUsersWorkflow,
} from "@medusajs/core-flows"
import type {
  ExecArgs,
  IRbacModuleService,
  IUserModuleService,
} from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { CUSTOMER_SUPPORT_STAFF_ROLE_NAME } from "../modules/agent-operations/rbac-policies"

export default async function assignSupportStaffRole({ container }: ExecArgs) {
  const email = process.env.AGENT_STAFF_EMAIL?.trim().toLowerCase()
  const firstName = process.env.AGENT_STAFF_FIRST_NAME?.trim() || "Nhân viên"
  const lastName = process.env.AGENT_STAFF_LAST_NAME?.trim() || "Hỗ trợ"

  assert.ok(email, "AGENT_STAFF_EMAIL is required")

  const users = container.resolve<IUserModuleService>(Modules.USER)
  const rbac = container.resolve<IRbacModuleService>(Modules.RBAC)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const user = (await users.listUsers({ email }))[0]
  const role = (
    await rbac.listRbacRoles({ name: CUSTOMER_SUPPORT_STAFF_ROLE_NAME })
  )[0]

  assert.ok(user, `Admin user ${email} does not exist`)
  assert.ok(
    role,
    `${CUSTOMER_SUPPORT_STAFF_ROLE_NAME} role is not bootstrapped`
  )

  const { data: currentData } = await query.graph(
    {
      entity: "user",
      fields: ["id", "rbac_roles.*"],
      filters: { id: user.id },
    },
    { throwIfKeyNotFound: true }
  )
  const currentRoleIds = (
    currentData[0] as { rbac_roles?: Array<{ id: string }> }
  ).rbac_roles?.map((currentRole) => currentRole.id) ?? []

  if (!currentRoleIds.includes(role.id)) {
    await assignUserRolesWorkflow(container).run({
      input: {
        actor_id: user.id,
        role_ids: [role.id],
        user_id: user.id,
      },
    })
  }

  const roleIdsToRemove = currentRoleIds.filter(
    (currentRoleId) => currentRoleId !== role.id
  )
  if (roleIdsToRemove.length) {
    await removeUserRolesWorkflow(container).run({
      input: {
        actor_id: user.id,
        role_ids: roleIdsToRemove,
        user_id: user.id,
      },
    })
  }

  await updateUsersWorkflow(container).run({
    input: {
      updates: [
        {
          first_name: firstName,
          id: user.id,
          last_name: lastName,
          metadata: {
            ...(user.metadata ?? {}),
            employee_experience: "customer_support",
          },
        },
      ],
    },
  })

  const { data } = await query.graph(
    {
      entity: "user",
      fields: ["id", "email", "first_name", "last_name", "rbac_roles.*"],
      filters: { id: user.id },
    },
    { throwIfKeyNotFound: true }
  )
  const assignedUser = data[0] as {
    email: string
    first_name: string | null
    id: string
    last_name: string | null
    rbac_roles?: Array<{ id: string; name: string }>
  }
  const assignedRoleNames =
    assignedUser.rbac_roles?.map((assignedRole) => assignedRole.name) ?? []

  assert.deepEqual(assignedRoleNames, [CUSTOMER_SUPPORT_STAFF_ROLE_NAME])

  console.log(
    JSON.stringify(
      {
        email: assignedUser.email,
        name: [assignedUser.first_name, assignedUser.last_name]
          .filter(Boolean)
          .join(" "),
        role: CUSTOMER_SUPPORT_STAFF_ROLE_NAME,
        status: "SUPPORT_STAFF_ROLE_ASSIGNED",
        user_id: assignedUser.id,
      },
      null,
      2
    )
  )
}
