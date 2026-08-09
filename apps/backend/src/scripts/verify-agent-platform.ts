import assert from "node:assert/strict"
import { ExecArgs, IRbacModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { AGENT_CATALOG } from "../modules/agent-operations/catalog-registry"
import { isKnowledgeEligible } from "../modules/agent-operations/knowledge"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { AgentTaskStatus } from "../modules/agent-operations/types"
import { approveKnowledgeDocumentWorkflow } from "../workflows/agent-operations/approve-knowledge-document"
import { createAgentTaskWorkflow } from "../workflows/agent-operations/create-agent-task"
import { createKnowledgeDocumentWorkflow } from "../workflows/agent-operations/create-knowledge-document"
import { runAgentEvaluationWorkflow } from "../workflows/agent-operations/run-agent-evaluation"
import { transitionAgentTaskWorkflow } from "../workflows/agent-operations/transition-agent-task"

export default async function verifyAgentPlatform({ container }: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const rbac = container.resolve<IRbacModuleService>(Modules.RBAC)
  const verificationId = `verify-agent-platform-${Date.now()}`

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
  const { result: taskDuplicate } = await createAgentTaskWorkflow(container).run({
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

  const knowledgeInput = {
    citation_locator: `policy://verification/${verificationId}`,
    content: "This content is approved only for platform runtime verification.",
    document_key: verificationId,
    effective_at: new Date(Date.now() - 1_000).toISOString(),
    owner_id: "platform-verifier",
    title: "Platform verification knowledge",
    version: "1.0.0",
  }
  const { result: knowledgeCreated } =
    await createKnowledgeDocumentWorkflow(container).run({
      input: knowledgeInput,
    })
  assert.equal(knowledgeCreated.document.status, "DRAFT")
  const { result: knowledgeApproved } =
    await approveKnowledgeDocumentWorkflow(container).run({
      input: {
        actor_id: "platform-verifier",
        document_id: knowledgeCreated.document.id,
      },
    })
  assert.equal(knowledgeApproved.document.status, "APPROVED")
  assert.equal(isKnowledgeEligible(knowledgeApproved.document), true)

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
  assert.equal(rolePolicies.length, 20)
  assert.equal(
    (await service.listAgentPolicyDefinitions({ status: "ACTIVE" })).length,
    1
  )
  assert.equal(
    (await service.listAgentPromptTemplates({ status: "ACTIVE" })).length,
    1
  )
  assert.equal(
    (await service.listAgentChannelConnections({ status: "ACTIVE" })).length,
    1
  )

  console.log(
    JSON.stringify(
      {
        catalog_agents: AGENT_CATALOG.length,
        evaluation_status: evaluation.run.status,
        knowledge_status: knowledgeApproved.document.status,
        operations_manager_policies: rolePolicies.length,
        task_status: completedTask.status,
      },
      null,
      2
    )
  )
}
