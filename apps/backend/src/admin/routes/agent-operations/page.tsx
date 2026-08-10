import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Button,
  Container,
  Heading,
  StatusBadge,
  Tabs,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ReactNode, useState } from "react"
import { sdk } from "../../lib/sdk"

type Readiness = {
  checks: Record<string, boolean>
  code_ready: boolean
  deployment_ready: boolean
}

type Incident = {
  id: string
  priority: string
  status: string
  title: string
}

type Approval = {
  id: string
  incident_id: string
  required_role: string
  status: string
}

type AgentTask = {
  id: string
  priority: string
  status: string
  title: string
}

type KnowledgeDocument = {
  citation_locator: string
  id: string
  status: string
  title: string
  version: string
}

type EvaluationScenario = {
  agent_id: string
  id: string
  name: string
  scenario_key: string
  status: string
}

type CatalogAgent = {
  id: string
  mission: string
  name: string
  status: string
}

const statusColor = (status: string) => {
  if (["ACTIVE", "APPROVED", "COMPLETED", "PASSED", "RESOLVED"].includes(status)) {
    return "green" as const
  }
  if (["FAILED", "DEAD", "REJECTED", "PROHIBITED"].includes(status)) {
    return "red" as const
  }
  if (["PENDING", "AWAITING_APPROVAL", "WAITING"].includes(status)) {
    return "orange" as const
  }
  return "grey" as const
}

const StateBadge = ({ value }: { value: string }) => (
  <StatusBadge color={statusColor(value)}>{value}</StatusBadge>
)

const Empty = ({ children }: { children: string }) => (
  <Text className="py-8 text-center" size="small" leading="compact">
    {children}
  </Text>
)

const Row = ({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) => (
  <div className="flex items-center justify-between gap-x-4 border-b border-ui-border-base px-6 py-4 last:border-b-0">
    <Text size="small" weight="plus">
      {title}
    </Text>
    <div className="flex items-center gap-x-2">{children}</div>
  </div>
)

const AgentOperationsPage = () => {
  const queryClient = useQueryClient()
  const [selectedApproval, setSelectedApproval] = useState<string | null>(null)
  const [decisionReason, setDecisionReason] = useState("")

  const readiness = useQuery({
    queryKey: ["agent-platform-readiness"],
    queryFn: () =>
      sdk.client.fetch<Readiness>(
        "/admin/agent-operations/platform/readiness"
      ),
  })
  const incidents = useQuery({
    queryKey: ["agent-incidents"],
    queryFn: () =>
      sdk.client.fetch<{ incidents: Incident[] }>(
        "/admin/agent-operations/incidents?limit=100"
      ),
  })
  const approvals = useQuery({
    queryKey: ["agent-approvals"],
    queryFn: () =>
      sdk.client.fetch<{ approvals: Approval[] }>(
        "/admin/agent-operations/approvals?limit=100"
      ),
  })
  const tasks = useQuery({
    queryKey: ["agent-tasks"],
    queryFn: () =>
      sdk.client.fetch<{ tasks: AgentTask[] }>(
        "/admin/agent-operations/tasks"
      ),
  })
  const knowledge = useQuery({
    queryKey: ["agent-knowledge"],
    queryFn: () =>
      sdk.client.fetch<{ documents: KnowledgeDocument[] }>(
        "/admin/agent-operations/knowledge"
      ),
  })
  const scenarios = useQuery({
    queryKey: ["agent-evaluation-scenarios"],
    queryFn: () =>
      sdk.client.fetch<{ scenarios: EvaluationScenario[] }>(
        "/admin/agent-operations/evaluations/scenarios"
      ),
  })
  const catalog = useQuery({
    queryKey: ["agent-catalog"],
    queryFn: () =>
      sdk.client.fetch<{ agents: CatalogAgent[] }>(
        "/admin/agent-operations/catalog"
      ),
  })

  const bootstrap = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/agent-operations/platform/bootstrap", {
        body: {},
        method: "POST",
      }),
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      toast.success("Agent platform foundation initialized")
      await queryClient.invalidateQueries({ queryKey: ["agent-platform-readiness"] })
      await queryClient.invalidateQueries({ queryKey: ["agent-evaluation-scenarios"] })
    },
  })

  const decideApproval = useMutation({
    mutationFn: ({ decision, id }: { decision: "APPROVED" | "REJECTED"; id: string }) =>
      sdk.client.fetch(`/admin/agent-operations/approvals/${id}/decision`, {
        body: { decision, reason: decisionReason },
        method: "POST",
      }),
    onError: (error) => toast.error(error.message),
    onSuccess: async () => {
      toast.success("Approval decision recorded")
      setDecisionReason("")
      setSelectedApproval(null)
      await queryClient.invalidateQueries({ queryKey: ["agent-approvals"] })
      await queryClient.invalidateQueries({ queryKey: ["agent-incidents"] })
    },
  })

  const loading = [readiness, incidents, approvals, tasks, knowledge, scenarios, catalog].some(
    (query) => query.isLoading
  )
  const pendingApprovals = approvals.data?.approvals.filter(
    (approval) => approval.status === "PENDING"
  ) ?? []

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1">Agent Operations</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Control plane for governed retail agents
            </Text>
          </div>
          <Button
            size="small"
            variant="secondary"
            isLoading={bootstrap.isPending}
            onClick={() => bootstrap.mutate()}
          >
            Initialize foundation
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-px bg-ui-border-base md:grid-cols-4">
          {[
            ["Incidents", incidents.data?.incidents.length ?? 0],
            ["Pending approvals", pendingApprovals.length],
            ["Open tasks", tasks.data?.tasks.filter((task) => !["COMPLETED", "CANCELLED", "DEAD"].includes(task.status)).length ?? 0],
            ["Active scenarios", scenarios.data?.scenarios.filter((scenario) => scenario.status === "ACTIVE").length ?? 0],
          ].map(([label, value]) => (
            <div className="bg-ui-bg-base px-6 py-5" key={label}>
              <Text size="small" className="text-ui-fg-subtle">{label}</Text>
              <Heading level="h2" className="mt-1">{value}</Heading>
            </div>
          ))}
        </div>
      </Container>

      <Container className="p-0">
        {loading ? (
          <Empty>Loading agent control plane...</Empty>
        ) : (
          <Tabs defaultValue="readiness">
            <Tabs.List className="px-6 pt-2">
              <Tabs.Trigger value="readiness">Readiness</Tabs.Trigger>
              <Tabs.Trigger value="incidents">Incidents</Tabs.Trigger>
              <Tabs.Trigger value="approvals">Approvals</Tabs.Trigger>
              <Tabs.Trigger value="tasks">Tasks</Tabs.Trigger>
              <Tabs.Trigger value="knowledge">Knowledge</Tabs.Trigger>
              <Tabs.Trigger value="evaluation">Evaluation</Tabs.Trigger>
              <Tabs.Trigger value="catalog">Catalog</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="readiness">
              <div className="px-6 py-5">
                <div className="mb-4 flex gap-x-2">
                  <StateBadge value={readiness.data?.code_ready ? "CODE READY" : "SETUP REQUIRED"} />
                  <StateBadge value={readiness.data?.deployment_ready ? "DEPLOYMENT READY" : "DEPLOYMENT GATES OPEN"} />
                </div>
                {Object.entries(readiness.data?.checks ?? {}).map(([check, passed]) => (
                  <Row key={check} title={check.replaceAll("_", " ")}>
                    <StateBadge value={passed ? "READY" : "MISSING"} />
                  </Row>
                ))}
              </div>
            </Tabs.Content>

            <Tabs.Content value="incidents">
              {incidents.data?.incidents.length ? incidents.data.incidents.map((incident) => (
                <Row key={incident.id} title={incident.title}>
                  <Text size="xsmall" className="text-ui-fg-subtle">{incident.priority}</Text>
                  <StateBadge value={incident.status} />
                </Row>
              )) : <Empty>No incidents recorded.</Empty>}
            </Tabs.Content>

            <Tabs.Content value="approvals">
              {pendingApprovals.length ? pendingApprovals.map((approval) => (
                <div className="border-b border-ui-border-base p-6" key={approval.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <Text size="small" weight="plus">{approval.id}</Text>
                      <Text size="xsmall" className="text-ui-fg-subtle">Role: {approval.required_role}</Text>
                    </div>
                    <Button size="small" variant="secondary" onClick={() => setSelectedApproval(approval.id)}>
                      Review
                    </Button>
                  </div>
                  {selectedApproval === approval.id && (
                    <div className="mt-4 flex flex-col gap-y-3">
                      <Textarea
                        aria-label="Decision reason"
                        placeholder="Required decision reason"
                        value={decisionReason}
                        onChange={(event) => setDecisionReason(event.target.value)}
                      />
                      <div className="flex justify-end gap-x-2">
                        <Button size="small" variant="danger" disabled={decisionReason.trim().length < 3} onClick={() => decideApproval.mutate({ decision: "REJECTED", id: approval.id })}>
                          Reject
                        </Button>
                        <Button size="small" disabled={decisionReason.trim().length < 3} onClick={() => decideApproval.mutate({ decision: "APPROVED", id: approval.id })}>
                          Approve
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )) : <Empty>No pending approvals.</Empty>}
            </Tabs.Content>

            <Tabs.Content value="tasks">
              {tasks.data?.tasks.length ? tasks.data.tasks.map((task) => (
                <Row key={task.id} title={task.title}>
                  <Text size="xsmall" className="text-ui-fg-subtle">{task.priority}</Text>
                  <StateBadge value={task.status} />
                </Row>
              )) : <Empty>No operational tasks.</Empty>}
            </Tabs.Content>

            <Tabs.Content value="knowledge">
              {knowledge.data?.documents.length ? knowledge.data.documents.map((document) => (
                <Row key={document.id} title={`${document.title} · ${document.version}`}>
                  <Text size="xsmall" className="text-ui-fg-subtle">{document.citation_locator}</Text>
                  <StateBadge value={document.status} />
                </Row>
              )) : <Empty>No governed knowledge documents.</Empty>}
            </Tabs.Content>

            <Tabs.Content value="evaluation">
              {scenarios.data?.scenarios.length ? scenarios.data.scenarios.map((scenario) => (
                <Row key={scenario.id} title={`${scenario.scenario_key} · ${scenario.name}`}>
                  <Text size="xsmall" className="text-ui-fg-subtle">{scenario.agent_id}</Text>
                  <StateBadge value={scenario.status} />
                </Row>
              )) : <Empty>No evaluation scenarios. Initialize the foundation first.</Empty>}
            </Tabs.Content>

            <Tabs.Content value="catalog">
              {catalog.data?.agents.map((agent) => (
                <div className="border-b border-ui-border-base px-6 py-4" key={agent.id}>
                  <div className="flex items-center justify-between gap-x-4">
                    <Text size="small" weight="plus">{agent.name}</Text>
                    <StateBadge value={agent.status.toUpperCase()} />
                  </div>
                  <Text size="xsmall" className="mt-1 text-ui-fg-subtle">{agent.mission}</Text>
                </div>
              ))}
            </Tabs.Content>
          </Tabs>
        )}
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({})

export default AgentOperationsPage
