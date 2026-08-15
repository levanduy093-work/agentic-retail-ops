import assert from "node:assert/strict"
import { ExecArgs, IRbacModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { AGENT_CATALOG } from "../modules/agent-operations/catalog-registry"
import {
  CUSTOMER_SUPPORT_PROMPT_KEY,
  CUSTOMER_SUPPORT_PROMPT_VERSION,
} from "../modules/agent-operations/customer-support-prompt"
import { isKnowledgeEligible } from "../modules/agent-operations/knowledge"
import { AGENT_RBAC_POLICY_DEFINITIONS } from "../modules/agent-operations/rbac-policies"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import {
  TASK_ASSIGN_TOOL,
  TASK_CREATE_TOOL,
  TASK_ESCALATE_TOOL,
  TaskCommandOutput,
} from "../modules/agent-operations/tools/task-tools"
import { KNOWLEDGE_PROPOSE_TOOL } from "../modules/agent-operations/tools/platform-command-tools"
import { AgentTaskStatus } from "../modules/agent-operations/types"
import { approveKnowledgeDocumentWorkflow } from "../workflows/agent-operations/approve-knowledge-document"
import { createAgentTaskWorkflow } from "../workflows/agent-operations/create-agent-task"
import { executeAgentActionWorkflow } from "../workflows/agent-operations/execute-agent-action"
import { retireKnowledgeDocumentWorkflow } from "../workflows/agent-operations/retire-knowledge-document"
import { requestAgentActionWorkflow } from "../workflows/agent-operations/request-agent-action"
import { runAgentEvaluationWorkflow } from "../workflows/agent-operations/run-agent-evaluation"
import { transitionAgentTaskWorkflow } from "../workflows/agent-operations/transition-agent-task"

export default async function verifyAgentPlatform({ container }: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const rbac = container.resolve<IRbacModuleService>(Modules.RBAC)
  const verificationId = `verify-agent-platform-${Date.now()}`
  const staleKnowledgeArtifacts = (
    await service.listAgentKnowledgeDocuments({}, { take: 10_000 })
  ).filter(
    (document) =>
      document.status === "APPROVED" &&
      document.title === "Platform verification knowledge" &&
      document.document_key.startsWith("verify-agent-platform-")
  )

  for (const document of staleKnowledgeArtifacts) {
    await retireKnowledgeDocumentWorkflow(container).run({
      input: {
        actor_id: "platform-verifier",
        document_id: document.id,
        reason: "Clean up a completed platform verification artifact",
      },
    })
  }

  assert.equal(AGENT_CATALOG.length, 17)

  const taskInput = {
    created_by_id: "platform-verifier",
    created_by_type: "system" as const,
    idempotency_key: `${verificationId}:task`,
    priority: "HIGH" as const,
    task_type: "VERIFICATION",
    title: "Verify governed task lifecycle",
  }
  const { result: taskCreated } = await createAgentTaskWorkflow(container).run({
    input: taskInput,
  })
  assert.equal(taskCreated.duplicate, false)
  const { result: taskDuplicate } = await createAgentTaskWorkflow(
    container
  ).run({
    input: taskInput,
  })
  assert.equal(taskDuplicate.duplicate, true)

  let taskStatus: AgentTaskStatus = "TODO"
  for (const status of ["CLAIMED", "IN_PROGRESS", "COMPLETED"] as const) {
    const { result: task } = await transitionAgentTaskWorkflow(container).run({
      input: {
        actor_id: "platform-verifier",
        assigned_to_id: "platform-verifier",
        assigned_to_type: "user",
        expected_status: taskStatus,
        status,
        task_id: taskCreated.task.id,
      },
    })
    taskStatus = task.status
  }
  const completedTask = await service.retrieveAgentTask(taskCreated.task.id)
  assert.equal(completedTask.status, "COMPLETED")

  const gatewayCorrelationId = `${verificationId}:task-gateway`
  const noPolicyIdempotencyKey = `${verificationId}:action:no-policy`
  await assert.rejects(
    requestAgentActionWorkflow(container).run({
      input: {
        correlation_id: `${gatewayCorrelationId}:no-policy`,
        granted_permissions: [TASK_CREATE_TOOL.permission],
        idempotency_key: noPolicyIdempotencyKey,
        input: {
          priority: "LOW",
          task_type: "GATEWAY_VERIFICATION",
          title: "This request must fail closed",
        },
        requested_by_id: "workforce-coordinator-agent",
        requested_by_type: "agent",
        tenant_id: "tenant-without-policy",
        tool_name: TASK_CREATE_TOOL.name,
        tool_version: TASK_CREATE_TOOL.version,
      },
    })
  )
  assert.equal(
    (
      await service.listAgentActionRequests({
        idempotency_key: noPolicyIdempotencyKey,
      })
    ).length,
    0
  )
  const taskCreateRequestInput = {
    correlation_id: gatewayCorrelationId,
    granted_permissions: [TASK_CREATE_TOOL.permission],
    idempotency_key: `${verificationId}:action:task-create`,
    input: {
      priority: "HIGH",
      task_type: "GATEWAY_VERIFICATION",
      title: "Verify task command gateway",
    },
    requested_by_id: "workforce-coordinator-agent",
    requested_by_type: "agent" as const,
    tool_name: TASK_CREATE_TOOL.name,
    tool_version: TASK_CREATE_TOOL.version,
  }
  const { result: taskCreateRequest } = await requestAgentActionWorkflow(
    container
  ).run({ input: taskCreateRequestInput })
  assert.equal(taskCreateRequest.duplicate, false)
  const { result: duplicateTaskCreateRequest } =
    await requestAgentActionWorkflow(container).run({
      input: taskCreateRequestInput,
    })
  assert.equal(duplicateTaskCreateRequest.duplicate, true)
  const { result: taskCreateExecution } = await executeAgentActionWorkflow(
    container
  ).run({
    input: {
      action_request_id: taskCreateRequest.action.id,
      actor_id: "platform-action-worker",
      actor_type: "worker",
      worker_id: "platform-action-worker",
    },
  })
  const taskCreateOutput = taskCreateExecution.action
    .result as unknown as TaskCommandOutput
  assert.equal(taskCreateOutput.outcome, "SUCCEEDED")
  const gatewayTaskId = taskCreateOutput.task.task_id

  const { result: taskAssignRequest } = await requestAgentActionWorkflow(
    container
  ).run({
    input: {
      correlation_id: gatewayCorrelationId,
      granted_permissions: [TASK_ASSIGN_TOOL.permission],
      idempotency_key: `${verificationId}:action:task-assign`,
      input: {
        assigned_to_id: "agent_shift_lead",
        assigned_to_type: "agent",
        expected_status: "TODO",
        task_id: gatewayTaskId,
      },
      requested_by_id: "workforce-coordinator-agent",
      requested_by_type: "agent",
      tool_name: TASK_ASSIGN_TOOL.name,
      tool_version: TASK_ASSIGN_TOOL.version,
    },
  })
  const { result: taskAssignExecution } = await executeAgentActionWorkflow(
    container
  ).run({
    input: {
      action_request_id: taskAssignRequest.action.id,
      actor_id: "platform-action-worker",
      actor_type: "worker",
      worker_id: "platform-action-worker",
    },
  })
  const taskAssignOutput = taskAssignExecution.action
    .result as unknown as TaskCommandOutput
  assert.equal(taskAssignOutput.outcome, "SUCCEEDED")
  assert.equal(taskAssignOutput.task.status, "CLAIMED")

  const { result: taskEscalateRequest } = await requestAgentActionWorkflow(
    container
  ).run({
    input: {
      correlation_id: gatewayCorrelationId,
      granted_permissions: [TASK_ESCALATE_TOOL.permission],
      idempotency_key: `${verificationId}:action:task-escalate`,
      input: {
        assigned_to_id: "team_operations_manager",
        assigned_to_type: "team",
        expected_status: "CLAIMED",
        priority: "CRITICAL",
        reason: "Runtime verification escalation",
        task_id: gatewayTaskId,
      },
      requested_by_id: "workforce-coordinator-agent",
      requested_by_type: "agent",
      tool_name: TASK_ESCALATE_TOOL.name,
      tool_version: TASK_ESCALATE_TOOL.version,
    },
  })
  const { result: taskEscalateExecution } = await executeAgentActionWorkflow(
    container
  ).run({
    input: {
      action_request_id: taskEscalateRequest.action.id,
      actor_id: "platform-action-worker",
      actor_type: "worker",
      worker_id: "platform-action-worker",
    },
  })
  const taskEscalateOutput = taskEscalateExecution.action
    .result as unknown as TaskCommandOutput
  assert.equal(taskEscalateOutput.outcome, "SUCCEEDED")
  assert.equal(taskEscalateOutput.task.priority, "CRITICAL")
  assert.equal(taskEscalateOutput.task.assigned_to_type, "team")

  const { result: taskConflictRequest } = await requestAgentActionWorkflow(
    container
  ).run({
    input: {
      correlation_id: gatewayCorrelationId,
      granted_permissions: [TASK_ASSIGN_TOOL.permission],
      idempotency_key: `${verificationId}:action:task-conflict`,
      input: {
        assigned_to_id: "agent_other",
        assigned_to_type: "agent",
        expected_status: "TODO",
        task_id: gatewayTaskId,
      },
      requested_by_id: "workforce-coordinator-agent",
      requested_by_type: "agent",
      tool_name: TASK_ASSIGN_TOOL.name,
      tool_version: TASK_ASSIGN_TOOL.version,
    },
  })
  const { result: taskConflictExecution } = await executeAgentActionWorkflow(
    container
  ).run({
    input: {
      action_request_id: taskConflictRequest.action.id,
      actor_id: "platform-action-worker",
      actor_type: "worker",
      worker_id: "platform-action-worker",
    },
  })
  const taskConflictOutput = taskConflictExecution.action
    .result as unknown as TaskCommandOutput
  assert.equal(taskConflictOutput.outcome, "CONFLICT")
  assert.equal(taskConflictExecution.action.status, "CONFLICT")

  const gatewayAuditEvents = await service.listAgentAuditEvents({
    correlation_id: gatewayCorrelationId,
  })
  assert.ok(gatewayAuditEvents.length >= 8)
  const gatewayToolCalls = await Promise.all(
    [
      taskCreateRequest.action.id,
      taskAssignRequest.action.id,
      taskEscalateRequest.action.id,
      taskConflictRequest.action.id,
    ].map((actionRequestId) =>
      service.listAgentToolCalls({ action_request_id: actionRequestId })
    )
  )
  assert.deepEqual(
    gatewayToolCalls.map((calls) => calls.length),
    [1, 1, 1, 1]
  )

  const knowledgeInput = {
    citation_locator: `policy://verification/${verificationId}`,
    content: "This content is approved only for platform runtime verification.",
    document_key: verificationId,
    effective_at: new Date(Date.now() - 1_000).toISOString(),
    locale: "en",
    scope: "platform_verification",
    title: "Platform verification knowledge",
    version: "1.0.0",
  }
  const { result: knowledgeRequest } = await requestAgentActionWorkflow(
    container
  ).run({
    input: {
      correlation_id: `${verificationId}:knowledge`,
      granted_permissions: [KNOWLEDGE_PROPOSE_TOOL.permission],
      idempotency_key: `${verificationId}:action:knowledge-propose`,
      input: knowledgeInput,
      requested_by_id: "knowledge-curator-agent",
      requested_by_type: "agent",
      tool_name: KNOWLEDGE_PROPOSE_TOOL.name,
      tool_version: KNOWLEDGE_PROPOSE_TOOL.version,
    },
  })
  const { result: knowledgeExecution } = await executeAgentActionWorkflow(
    container
  ).run({
    input: {
      action_request_id: knowledgeRequest.action.id,
      actor_id: "platform-action-worker",
      actor_type: "worker",
      worker_id: "platform-action-worker",
    },
  })
  const knowledgeOutput = knowledgeExecution.action.result as unknown as {
    document_id: string
    outcome: "SUCCEEDED"
    status: "DRAFT"
  }
  assert.equal(knowledgeOutput.outcome, "SUCCEEDED")
  assert.equal(knowledgeOutput.status, "DRAFT")
  const { result: knowledgeApproved } = await approveKnowledgeDocumentWorkflow(
    container
  ).run({
    input: {
      actor_id: "platform-verifier",
      document_id: knowledgeOutput.document_id,
    },
  })
  assert.equal(knowledgeApproved.document.status, "APPROVED")
  assert.equal(isKnowledgeEligible(knowledgeApproved.document), true)
  const { result: knowledgeRetired } =
    await retireKnowledgeDocumentWorkflow(container).run({
      input: {
        actor_id: "platform-verifier",
        document_id: knowledgeApproved.document.id,
        reason: "Completed platform runtime verification",
      },
    })
  assert.equal(knowledgeRetired.document.status, "RETIRED")

  const scenarios = await service.listAgentEvaluationCases({
    scenario_key: "SHIP-001",
    status: "ACTIVE",
  })
  assert.equal(scenarios.length, 1)
  const evaluationInput = {
    idempotency_key: `${verificationId}:evaluation`,
    observed: {
      mutation_executed: false,
      requires_approval: true,
      risk_level: "HIGH",
    },
    scenario_id: scenarios[0].id,
  }
  const { result: evaluation } = await runAgentEvaluationWorkflow(
    container
  ).run({ input: evaluationInput })
  assert.equal(evaluation.run.status, "PASSED")
  assert.equal(evaluation.run.score, 10_000)
  const { result: duplicateEvaluation } = await runAgentEvaluationWorkflow(
    container
  ).run({ input: evaluationInput })
  assert.equal(duplicateEvaluation.duplicate, true)

  const roles = await rbac.listRbacRoles({ name: "operations_manager" })
  assert.equal(roles.length, 1)
  const rolePolicies = await rbac.listPoliciesForRole(roles[0].id)
  assert.equal(rolePolicies.length, AGENT_RBAC_POLICY_DEFINITIONS.length)
  const activePolicyKeys = new Set(
    (await service.listAgentPolicyDefinitions({ status: "ACTIVE" })).map(
      (policy) => policy.policy_key
    )
  )
  const requiredPolicyKeys = [
    "inventory.transfer.requires-operations-manager",
    "task.create.agent-authorized",
    "task.assign.agent-authorized",
    "task.escalate.agent-authorized",
    "incident.create.agent-authorized",
    "incident.update.agent-authorized",
    "approval.request.agent-authorized",
    "approval.decide.operations-manager",
    "knowledge.propose.agent-authorized",
    "message.send.agent-authorized",
  ]
  assert.ok(requiredPolicyKeys.every((key) => activePolicyKeys.has(key)))
  assert.equal(
    (
      await service.listAgentPromptTemplates({
        prompt_key: CUSTOMER_SUPPORT_PROMPT_KEY,
        status: "ACTIVE",
        version: CUSTOMER_SUPPORT_PROMPT_VERSION,
      })
    ).length,
    1
  )
  assert.equal(
    (
      await service.listAgentChannelConnections({
        account_ref: "default-admin",
        channel: "IN_APP",
        status: "ACTIVE",
        tenant_id: "default",
      })
    ).length,
    1
  )

  console.log(
    JSON.stringify(
      {
        catalog_agents: AGENT_CATALOG.length,
        evaluation_status: evaluation.run.status,
        cleaned_knowledge_artifacts: staleKnowledgeArtifacts.length,
        knowledge_status: "APPROVED_THEN_RETIRED",
        knowledge_tool_status: knowledgeExecution.action.status,
        operations_manager_policies: rolePolicies.length,
        task_gateway_statuses: [
          taskCreateExecution.action.status,
          taskAssignExecution.action.status,
          taskEscalateExecution.action.status,
          taskConflictExecution.action.status,
        ],
        task_status: completedTask.status,
      },
      null,
      2
    )
  )
}
