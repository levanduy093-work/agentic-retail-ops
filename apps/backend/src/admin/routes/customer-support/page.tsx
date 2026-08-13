import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Button,
  Container,
  Drawer,
  FocusModal,
  Heading,
  Select,
  StatusBadge,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { sdk } from "../../lib/sdk"

type SupportTaskInput = {
  channel?: string
  conversation_id?: string
  customer_id?: string
  draft?: string
  grounded?: boolean
  order_id?: string
  question?: string
  requires_human_review?: boolean
}

type SupportTask = {
  assigned_to_id: string | null
  assigned_to_type: string | null
  completed_at: string | null
  created_at: string
  due_at: string | null
  id: string
  incident_correlation_id: string | null
  incident_id: string | null
  input: SupportTaskInput | null
  priority: string
  result: Record<string, unknown> | null
  status: string
  support_conversation_channel: string | null
  support_conversation_id: string | null
  support_conversation_title: string | null
  task_type: string
  title: string
  updated_at: string
}

type TaskListResponse = {
  count: number
  tasks: SupportTask[]
}

type ActionRequestResponse = {
  action: {
    id: string
  }
}

type SupportConversationResponse = {
  conversation: {
    channel: string
    id: string
    last_message_at: string
    title: string
  }
  memory: ConversationMemory | null
  messages: Array<{
    body: string
    direction: "INBOUND" | "OUTBOUND"
    id: string
    occurred_at: string
    sender_type: string
    status: string
  }>
  support_tasks: SupportTask[]
}

type ConversationMemory = {
  customer_facts: string[]
  open_questions: string[]
  resolved_topics: string[]
  source_message_count: number
  summarized_at: string
  summary: string
  version: number
}

type SupportConversationListItem = {
  channel: string
  id: string
  last_message_at: string
  latest_message: {
    body: string
    direction: "INBOUND" | "OUTBOUND"
    occurred_at: string
  } | null
  memory: ConversationMemory | null
  requires_human_attention: boolean
  status: string
  support_task: SupportTask | null
  title: string
}

type SupportConversationListResponse = {
  conversations: SupportConversationListItem[]
  count: number
}

type SimulatorOrder = {
  customer_id: string | null
  display_id: number
  email?: string | null
  id: string
}

const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED", "DEAD"]

const isAssignedToManager = (task: SupportTask) =>
  task.assigned_to_type === "team" &&
  task.assigned_to_id === "operations_manager"

const statusColor = (status: string) => {
  if (["COMPLETED", "CAPTURED", "DELIVERED", "FULFILLED"].includes(status)) {
    return "green" as const
  }
  if (["FAILED", "CANCELLED", "DEAD"].includes(status)) {
    return "red" as const
  }
  if (["TODO", "WAITING", "NOT_PAID", "NOT_FULFILLED"].includes(status)) {
    return "orange" as const
  }
  return "blue" as const
}

const customerNameFromConversation = (conversation: {
  title?: string | null
}) => {
  const title = conversation.title?.trim()
  if (title) {
    return title.replace(/^(Telegram|Zalo|Slack|Teams)\s+[—–-]\s+/i, "")
  }

  return "Customer"
}

const customerInitial = (name: string) => name.trim().charAt(0).toUpperCase()

const CustomerSupportPage = () => {
  const { i18n, t } = useTranslation()
  const queryClient = useQueryClient()
  const [view, setView] = useState<"attention" | "all">("attention")
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null)
  const [reply, setReply] = useState("")
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [simulatorLocale, setSimulatorLocale] = useState<"en" | "vi">("vi")
  const [simulatorOpen, setSimulatorOpen] = useState(false)
  const [simulatorOrderId, setSimulatorOrderId] = useState("")
  const [simulatorQuestion, setSimulatorQuestion] = useState("")
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferReason, setTransferReason] = useState("")
  const locale = i18n.language.startsWith("vi") ? "vi-VN" : "en-US"

  const currentUser = useQuery({
    queryFn: () =>
      sdk.admin.user.me({ fields: "id,email,first_name,last_name" }),
    queryKey: ["current-admin-user"],
  })
  const tasks = useQuery({
    queryFn: () =>
      sdk.client.fetch<TaskListResponse>("/admin/agent-operations/tasks"),
    queryKey: ["customer-support-tasks"],
  })
  const conversations = useQuery({
    queryFn: () =>
      sdk.client.fetch<SupportConversationListResponse>(
        "/admin/agent-operations/conversations?customer_support=true&limit=100",
      ),
    queryKey: ["customer-support-conversations"],
    refetchInterval: 10_000,
  })
  const simulatorOrders = useQuery({
    enabled: simulatorOpen,
    queryFn: () =>
      sdk.admin.order.list({
        limit: 10,
        order: "-created_at",
      }),
    queryKey: ["customer-support-simulator-orders"],
  })
  const supportTasks = useMemo(
    () =>
      (tasks.data?.tasks ?? []).filter(
        (task) => task.task_type === "SUPPORT_RESPONSE_REVIEW",
      ),
    [tasks.data?.tasks],
  )
  const allConversations = conversations.data?.conversations ?? []
  const attentionConversations = allConversations.filter(
    (conversation) => conversation.requires_human_attention,
  )
  const visibleConversations =
    view === "attention" ? attentionConversations : allConversations
  const selectedConversation = allConversations.find(
    (conversation) => conversation.id === selectedConversationId,
  )
  const selectedTask = supportTasks.find(
    (task) => task.support_conversation_id === selectedConversationId,
  )
  const selectedSimulatorOrder = simulatorOrders.data?.orders.find(
    (order) => order.id === simulatorOrderId,
  ) as SimulatorOrder | undefined
  const conversation = useQuery({
    enabled: Boolean(selectedConversationId),
    queryFn: () =>
      sdk.client.fetch<SupportConversationResponse>(
        `/admin/agent-operations/conversations/${selectedConversationId}`,
      ),
    queryKey: ["customer-support-conversation", selectedConversationId],
    refetchInterval: 10_000,
  })

  useEffect(() => {
    if (
      !visibleConversations.some(
        (conversation) => conversation.id === selectedConversationId,
      )
    ) {
      setSelectedConversationId(visibleConversations[0]?.id ?? null)
    }
  }, [selectedConversationId, visibleConversations])

  useEffect(() => {
    const completedReply = selectedTask?.result?.response_body
    setReply(
      typeof completedReply === "string"
        ? completedReply
        : (selectedTask?.input?.draft ?? ""),
    )
    setReleaseOpen(false)
    setSendOpen(false)
    setTransferOpen(false)
    setTransferReason("")
  }, [selectedTask?.id, selectedTask?.input?.draft, selectedTask?.result])

  const customerId = selectedTask?.input?.customer_id
  const customer = useQuery({
    enabled: Boolean(customerId && !customerId.startsWith("telegram:")),
    queryFn: () => sdk.admin.customer.retrieve(customerId!),
    queryKey: ["customer-support-customer", customerId],
  })

  const invalidateSupportData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["customer-support-tasks"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["customer-support-conversations"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["customer-support-conversation"],
      }),
    ])
  }
  const errorMessage = (error: unknown) =>
    error instanceof Error ? error.message : t("supportDesk.actionError")

  const takeTask = useMutation({
    mutationFn: async (task: SupportTask) => {
      const userId = currentUser.data?.user.id
      if (!userId) {
        throw new Error(t("supportDesk.actionError"))
      }
      let status = task.status
      if (status === "TODO") {
        await sdk.client.fetch(
          `/admin/agent-operations/tasks/${task.id}/transition`,
          {
            body: {
              assigned_to_id: userId,
              assigned_to_type: "user",
              expected_status: "TODO",
              status: "CLAIMED",
            },
            method: "POST",
          },
        )
        status = "CLAIMED"
      }
      if (["CLAIMED", "WAITING"].includes(status)) {
        await sdk.client.fetch(
          `/admin/agent-operations/tasks/${task.id}/transition`,
          {
            body: {
              assigned_to_id: userId,
              assigned_to_type: "user",
              expected_status: status,
              status: "IN_PROGRESS",
            },
            method: "POST",
          },
        )
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: async () => {
      toast.success(t("supportDesk.requestTaken"))
      await invalidateSupportData()
    },
  })

  const completeDraft = useMutation({
    mutationFn: async (task: SupportTask) => {
      if (reply.trim().length < 3) {
        throw new Error(t("supportDesk.replyRequired"))
      }
      return sdk.client.fetch(
        `/admin/agent-operations/tasks/${task.id}/transition`,
        {
          body: {
            expected_status: "IN_PROGRESS",
            result: {
              message_sent: false,
              response_body: reply.trim(),
              review_language: locale,
              reviewed_by_human: true,
            },
            status: "COMPLETED",
          },
          method: "POST",
        },
      )
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: async () => {
      toast.success(t("supportDesk.draftCompleted"))
      await invalidateSupportData()
    },
  })

  const releaseTask = useMutation({
    mutationFn: (task: SupportTask) =>
      sdk.client.fetch(`/admin/agent-operations/tasks/${task.id}/release`, {
        body: {},
        method: "POST",
      }),
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: async () => {
      toast.success(t("supportDesk.requestReleased"))
      setReleaseOpen(false)
      await invalidateSupportData()
    },
  })

  const transferToManager = useMutation({
    mutationFn: async (task: SupportTask) => {
      const requested = await sdk.client.fetch<ActionRequestResponse>(
        "/admin/agent-operations/actions/requests",
        {
          body: {
            correlation_id: task.incident_correlation_id ?? task.id,
            idempotency_key: `support-manager-transfer:${task.id}:${task.updated_at}`,
            incident_id: task.incident_correlation_id
              ? (task.incident_id ?? undefined)
              : undefined,
            input: {
              assigned_to_id: "operations_manager",
              assigned_to_type: "team",
              expected_status: task.status,
              priority: "HIGH",
              reason: transferReason.trim(),
              task_id: task.id,
            },
            tenant_id: "default",
            tool_name: "task.escalate",
            tool_version: "1.0.0",
          },
          method: "POST",
        },
      )
      return sdk.client.fetch(
        `/admin/agent-operations/actions/${requested.action.id}/execute`,
        { body: {}, method: "POST" },
      )
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: async () => {
      toast.success(t("supportDesk.requestTransferred"))
      setTransferOpen(false)
      setTransferReason("")
      await invalidateSupportData()
    },
  })

  const createSimulatorMessage = useMutation({
    mutationFn: async () => {
      if (!selectedSimulatorOrder?.customer_id) {
        throw new Error(t("supportDesk.simulatorOrderRequired"))
      }
      if (simulatorQuestion.trim().length < 2) {
        throw new Error(t("supportDesk.simulatorQuestionRequired"))
      }

      return sdk.client.fetch(
        "/admin/agent-operations/support-simulator/messages",
        {
          body: {
            client_message_id: crypto.randomUUID(),
            customer_id: selectedSimulatorOrder.customer_id,
            locale: simulatorLocale,
            order_id: selectedSimulatorOrder.id,
            question: simulatorQuestion.trim(),
          },
          method: "POST",
        },
      )
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: async () => {
      toast.success(t("supportDesk.simulatorCreated"))
      setSimulatorOpen(false)
      setSimulatorOrderId("")
      setSimulatorQuestion("")
      setView("attention")
      await invalidateSupportData()
    },
  })

  const sendReviewedReply = useMutation({
    mutationFn: (task: SupportTask) =>
      sdk.client.fetch(
        `/admin/agent-operations/tasks/${task.id}/send-reviewed-reply`,
        {
          body: { expected_task_updated_at: task.updated_at },
          method: "POST",
        },
      ),
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: async () => {
      toast.success(t("supportDesk.reviewedReplySent"))
      setSendOpen(false)
      await invalidateSupportData()
    },
  })

  const humanStatus = (status: string) =>
    t(`supportDesk.status.${status.toLowerCase()}`, { defaultValue: status })
  const formatDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(value))
      : "—"
  const storedCustomerName = customer.data?.customer
    ? [customer.data.customer.first_name, customer.data.customer.last_name]
        .filter(Boolean)
        .join(" ") || customer.data.customer.email
    : null
  const customerName = selectedConversation
    ? (storedCustomerName ?? customerNameFromConversation(selectedConversation))
    : "—"
  const customerReference =
    customer.data?.customer?.email ??
    selectedConversation?.channel ??
    selectedTask?.input?.channel ??
    "—"
  const assignedToManager = selectedTask
    ? isAssignedToManager(selectedTask)
    : false
  const assignedToOther = Boolean(
    selectedTask?.assigned_to_id &&
    selectedTask.assigned_to_type === "user" &&
    selectedTask.assigned_to_id !== currentUser.data?.user.id,
  )
  const canEdit =
    selectedTask?.status === "IN_PROGRESS" &&
    !assignedToOther &&
    !assignedToManager
  const messageSent = selectedTask?.result?.message_sent === true

  if (tasks.isLoading || conversations.isLoading || currentUser.isLoading) {
    return (
      <Container className="flex min-h-[360px] items-center justify-center">
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          {t("supportDesk.loading")}
        </Text>
      </Container>
    )
  }

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="p-0">
        <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-y-1">
            <Heading level="h1">{t("supportDesk.title")}</Heading>
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              {t("supportDesk.subtitle")}
            </Text>
          </div>
          {import.meta.env.DEV && (
            <Button
              size="small"
              variant="secondary"
              onClick={() => setSimulatorOpen(true)}
            >
              {t("supportDesk.openSimulator")}
            </Button>
          )}
        </div>
      </Container>

      <div className="grid gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Container className="h-fit p-0">
          <div className="flex gap-x-2 border-b border-ui-border-base px-4 py-3">
            <Button
              size="small"
              variant={view === "attention" ? "primary" : "secondary"}
              onClick={() => setView("attention")}
            >
              {t("supportDesk.attentionTab")}
            </Button>
            <Button
              size="small"
              variant={view === "all" ? "primary" : "secondary"}
              onClick={() => setView("all")}
            >
              {t("supportDesk.allConversationsTab")}
            </Button>
          </div>
          <div className="px-4 py-3">
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              {view === "attention"
                ? t("supportDesk.attentionCount", {
                    count: attentionConversations.length,
                  })
                : t("supportDesk.allConversationsCount", {
                    count: allConversations.length,
                  })}
            </Text>
          </div>
          <div className="flex flex-col gap-2 px-3 pb-3">
            {visibleConversations.length === 0 ? (
              <Text
                size="small"
                leading="compact"
                className="px-3 py-8 text-center text-ui-fg-subtle"
              >
                {t(
                  view === "attention"
                    ? "supportDesk.emptyAttention"
                    : "supportDesk.emptyConversations",
                )}
              </Text>
            ) : (
              visibleConversations.map((item) => {
                const itemCustomerName = customerNameFromConversation(item)
                const isSelected = item.id === selectedConversationId

                return (
                  <Button
                    className="h-auto w-full justify-start whitespace-normal rounded-lg px-3 py-3 text-left"
                    key={item.id}
                    size="small"
                    variant={isSelected ? "secondary" : "transparent"}
                    onClick={() => setSelectedConversationId(item.id)}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ui-bg-component shadow-elevation-card-rest">
                        <Text size="small" leading="compact" weight="plus">
                          {customerInitial(itemCustomerName)}
                        </Text>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-y-1">
                        <div className="flex items-center justify-between gap-x-2">
                          <Text size="small" leading="compact" weight="plus">
                            {itemCustomerName}
                          </Text>
                          <Text
                            size="xsmall"
                            leading="compact"
                            className="shrink-0 text-ui-fg-subtle"
                          >
                            {formatDate(item.last_message_at)}
                          </Text>
                        </div>
                        <Text
                          size="small"
                          leading="compact"
                          className="line-clamp-2 text-ui-fg-subtle"
                        >
                          {item.latest_message?.body ??
                            item.memory?.summary ??
                            item.title}
                        </Text>
                        <div className="flex items-center justify-between gap-x-2">
                          <Text
                            size="xsmall"
                            leading="compact"
                            className="text-ui-fg-muted"
                          >
                            {item.channel}
                          </Text>
                          <StatusBadge
                            color={
                              item.requires_human_attention ? "orange" : "green"
                            }
                          >
                            {item.requires_human_attention
                              ? t("supportDesk.needsHuman")
                              : t("supportDesk.aiHandling")}
                          </StatusBadge>
                        </div>
                      </div>
                    </div>
                  </Button>
                )
              })
            )}
          </div>
        </Container>

        <Container className="p-0">
          {!selectedConversation ? (
            <div className="flex min-h-[420px] items-center justify-center px-6 py-12">
              <Text
                size="small"
                leading="compact"
                className="text-ui-fg-subtle"
              >
                {t("supportDesk.selectConversation")}
              </Text>
            </div>
          ) : (
            <div className="divide-y divide-ui-border-base">
              <div className="flex flex-col gap-y-3 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-y-1">
                  <Heading level="h2">{customerName}</Heading>
                  <Text
                    size="small"
                    leading="compact"
                    className="text-ui-fg-subtle"
                  >
                    {customerReference}
                  </Text>
                </div>
                <div className="flex flex-col items-start gap-y-1 sm:items-end">
                  <StatusBadge
                    color={selectedTask ? statusColor(selectedTask.status) : "green"}
                  >
                    {selectedTask
                      ? humanStatus(selectedTask.status)
                      : t("supportDesk.aiHandling")}
                  </StatusBadge>
                  {selectedTask?.due_at && (
                    <Text
                      size="xsmall"
                      leading="compact"
                      className="text-ui-fg-subtle"
                    >
                      {t("supportDesk.due", {
                        time: formatDate(selectedTask.due_at),
                      })}
                    </Text>
                  )}
                </div>
              </div>

              <div className="bg-ui-bg-base px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <Text size="small" leading="compact" weight="plus">
                    {t("supportDesk.conversationMemory")}
                  </Text>
                  {conversation.data?.memory && (
                    <Text
                      size="xsmall"
                      leading="compact"
                      className="text-ui-fg-muted"
                    >
                      {t("supportDesk.memoryVersion", {
                        count: conversation.data.memory.source_message_count,
                        version: conversation.data.memory.version,
                      })}
                    </Text>
                  )}
                </div>
                <Text
                  size="small"
                  leading="compact"
                  className="mt-2 text-ui-fg-subtle"
                >
                  {conversation.data?.memory?.summary ??
                    t("supportDesk.memoryPending")}
                </Text>
                {conversation.data?.memory?.open_questions.length ? (
                  <div className="mt-3 flex flex-col gap-1">
                    <Text size="xsmall" leading="compact" weight="plus">
                      {t("supportDesk.openQuestions")}
                    </Text>
                    {conversation.data.memory.open_questions.map((question) => (
                      <Text
                        className="text-ui-fg-subtle"
                        key={question}
                        leading="compact"
                        size="xsmall"
                      >
                        • {question}
                      </Text>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex min-h-[460px] flex-col bg-ui-bg-subtle">
                <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-5">
                  {conversation.isLoading ? (
                    <Text
                      size="small"
                      leading="compact"
                      className="text-ui-fg-subtle"
                    >
                      {t("supportDesk.loading")}
                    </Text>
                  ) : conversation.data?.messages.length ? (
                    conversation.data.messages.map((message) => {
                      const isCustomerMessage = message.direction === "INBOUND"

                      return (
                        <div
                          className={`flex ${
                            isCustomerMessage ? "justify-start" : "justify-end"
                          }`}
                          key={message.id}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-elevation-card-rest ${
                              isCustomerMessage
                                ? "rounded-tl-sm bg-ui-bg-component"
                                : "rounded-tr-sm border border-ui-border-base bg-ui-bg-base"
                            }`}
                          >
                            <div className="mb-1 flex items-center gap-x-2">
                              <Text
                                size="xsmall"
                                leading="compact"
                                weight="plus"
                              >
                                {isCustomerMessage
                                  ? customerName
                                  : t("supportDesk.simulatorStore")}
                              </Text>
                              <Text
                                size="xsmall"
                                leading="compact"
                                className="text-ui-fg-subtle"
                              >
                                {formatDate(message.occurred_at)}
                              </Text>
                            </div>
                            <Text size="small" leading="compact">
                              {message.body}
                            </Text>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-ui-bg-component px-4 py-3 shadow-elevation-card-rest">
                        <div className="mb-1 flex items-center gap-x-2">
                          <Text size="xsmall" leading="compact" weight="plus">
                            {customerName}
                          </Text>
                          <Text
                            size="xsmall"
                            leading="compact"
                            className="text-ui-fg-subtle"
                          >
                            {formatDate(selectedConversation.last_message_at)}
                          </Text>
                        </div>
                        <Text size="small" leading="compact">
                          {selectedConversation.latest_message?.body ?? "—"}
                        </Text>
                      </div>
                    </div>
                  )}
                </div>

                {selectedTask ? (
                  <div className="border-t border-ui-border-base bg-ui-bg-base px-6 py-4">
                    <Textarea
                      aria-label={t("supportDesk.suggestedReply")}
                      disabled={!canEdit}
                      placeholder={t("supportDesk.suggestedReply")}
                      rows={3}
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                    />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-y-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {!selectedTask && (
                    <Text
                      size="small"
                      leading="compact"
                      className="text-ui-fg-success"
                    >
                      {t("supportDesk.noHumanActionNeeded")}
                    </Text>
                  )}
                  {assignedToManager && (
                    <Text
                      size="small"
                      leading="compact"
                      className="text-ui-fg-warning"
                    >
                      {t("supportDesk.transferred")}
                    </Text>
                  )}
                  {assignedToOther && (
                    <Text
                      size="small"
                      leading="compact"
                      className="text-ui-fg-subtle"
                    >
                      {t("supportDesk.claimedByOther")}
                    </Text>
                  )}
                  {messageSent && (
                    <Text
                      size="small"
                      leading="compact"
                      className="text-ui-fg-success"
                    >
                      {t("supportDesk.simulatorAlreadySent")}
                    </Text>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {selectedTask &&
                    !TERMINAL_STATUSES.includes(selectedTask.status) &&
                    !assignedToManager && (
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={assignedToOther}
                        onClick={() => setTransferOpen(true)}
                      >
                        {t("supportDesk.transferManager")}
                      </Button>
                    )}
                  {selectedTask &&
                    ["TODO", "CLAIMED", "WAITING"].includes(
                      selectedTask.status,
                    ) &&
                    !assignedToManager && (
                      <Button
                        size="small"
                        disabled={assignedToOther}
                        isLoading={takeTask.isPending}
                        onClick={() => takeTask.mutate(selectedTask)}
                      >
                        {selectedTask.status === "TODO"
                          ? t("supportDesk.takeRequest")
                          : t("supportDesk.continueRequest")}
                      </Button>
                    )}
                  {canEdit && selectedTask && (
                    <Button
                      size="small"
                      variant="secondary"
                      disabled={completeDraft.isPending}
                      onClick={() => setReleaseOpen(true)}
                    >
                      {t("supportDesk.releaseRequest")}
                    </Button>
                  )}
                  {canEdit && selectedTask && (
                    <Button
                      size="small"
                      disabled={reply.trim().length < 3}
                      isLoading={completeDraft.isPending}
                      onClick={() => completeDraft.mutate(selectedTask)}
                    >
                      {t("supportDesk.completeDraft")}
                    </Button>
                  )}
                  {selectedTask?.status === "COMPLETED" &&
                    selectedTask.support_conversation_id &&
                    !messageSent && (
                      <Button size="small" onClick={() => setSendOpen(true)}>
                        {t("supportDesk.sendReviewedReply")}
                      </Button>
                    )}
                </div>
              </div>
            </div>
          )}
        </Container>
      </div>

      <FocusModal open={simulatorOpen} onOpenChange={setSimulatorOpen}>
        <FocusModal.Content>
          <div className="flex h-full flex-col overflow-hidden">
            <FocusModal.Header>
              <div className="flex items-center justify-end gap-x-2">
                <FocusModal.Close asChild>
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={createSimulatorMessage.isPending}
                  >
                    {t("supportDesk.cancel")}
                  </Button>
                </FocusModal.Close>
                <Button
                  size="small"
                  disabled={
                    !selectedSimulatorOrder?.customer_id ||
                    simulatorQuestion.trim().length < 2
                  }
                  isLoading={createSimulatorMessage.isPending}
                  onClick={() => createSimulatorMessage.mutate()}
                >
                  {t("supportDesk.simulatorSendQuestion")}
                </Button>
              </div>
            </FocusModal.Header>
            <FocusModal.Body className="flex-1 overflow-auto">
              <div className="mx-auto flex w-full max-w-2xl flex-col gap-y-6 px-6 py-8">
                <div className="flex flex-col gap-y-1">
                  <Heading level="h1">
                    {t("supportDesk.simulatorTitle")}
                  </Heading>
                  <Text
                    size="small"
                    leading="compact"
                    className="text-ui-fg-subtle"
                  >
                    {t("supportDesk.simulatorDescription")}
                  </Text>
                </div>
                <div className="flex flex-col gap-y-2">
                  <Text size="small" leading="compact" weight="plus">
                    {t("supportDesk.simulatorOrder")}
                  </Text>
                  <Select
                    value={simulatorOrderId}
                    onValueChange={setSimulatorOrderId}
                  >
                    <Select.Trigger>
                      <Select.Value
                        placeholder={
                          simulatorOrders.isLoading
                            ? t("supportDesk.loading")
                            : t("supportDesk.simulatorOrderPlaceholder")
                        }
                      />
                    </Select.Trigger>
                    <Select.Content>
                      {(simulatorOrders.data?.orders ?? []).map((order) => (
                        <Select.Item key={order.id} value={order.id}>
                          {t("supportDesk.simulatorOrderOption", {
                            email: order.email ?? "—",
                            number: order.display_id,
                          })}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
                <div className="flex flex-col gap-y-2">
                  <Text size="small" leading="compact" weight="plus">
                    {t("supportDesk.simulatorLanguage")}
                  </Text>
                  <Select
                    value={simulatorLocale}
                    onValueChange={(value) =>
                      setSimulatorLocale(value as "en" | "vi")
                    }
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="vi">
                        {t("supportDesk.simulatorVietnamese")}
                      </Select.Item>
                      <Select.Item value="en">
                        {t("supportDesk.simulatorEnglish")}
                      </Select.Item>
                    </Select.Content>
                  </Select>
                </div>
                <div className="flex flex-col gap-y-2">
                  <Text size="small" leading="compact" weight="plus">
                    {t("supportDesk.simulatorQuestion")}
                  </Text>
                  <Textarea
                    aria-label={t("supportDesk.simulatorQuestion")}
                    placeholder={t("supportDesk.simulatorQuestionPlaceholder")}
                    rows={6}
                    value={simulatorQuestion}
                    onChange={(event) =>
                      setSimulatorQuestion(event.target.value)
                    }
                  />
                </div>
                <Text
                  size="small"
                  leading="compact"
                  className="text-ui-fg-warning"
                >
                  {t("supportDesk.simulatorSafetyNote")}
                </Text>
              </div>
            </FocusModal.Body>
          </div>
        </FocusModal.Content>
      </FocusModal>

      <Drawer open={sendOpen} onOpenChange={setSendOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{t("supportDesk.sendReviewedTitle")}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 p-4">
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              {t("supportDesk.sendReviewedDescription")}
            </Text>
            <div className="rounded-md bg-ui-bg-subtle px-4 py-3">
              <Text size="small" leading="compact">
                {typeof selectedTask?.result?.response_body === "string"
                  ? selectedTask.result.response_body
                  : "—"}
              </Text>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex justify-end gap-x-2">
              <Drawer.Close asChild>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={sendReviewedReply.isPending}
                >
                  {t("supportDesk.cancel")}
                </Button>
              </Drawer.Close>
              <Button
                size="small"
                disabled={!selectedTask}
                isLoading={sendReviewedReply.isPending}
                onClick={() =>
                  selectedTask && sendReviewedReply.mutate(selectedTask)
                }
              >
                {t("supportDesk.confirmReviewedSend")}
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      <Drawer open={transferOpen} onOpenChange={setTransferOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{t("supportDesk.transferTitle")}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 p-4">
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              {t("supportDesk.transferDescription")}
            </Text>
            <div className="flex flex-col gap-y-2">
              <Text size="small" leading="compact" weight="plus">
                {t("supportDesk.transferReason")}
              </Text>
              <Textarea
                aria-label={t("supportDesk.transferReason")}
                placeholder={t("supportDesk.transferPlaceholder")}
                rows={5}
                value={transferReason}
                onChange={(event) => setTransferReason(event.target.value)}
              />
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex justify-end gap-x-2">
              <Drawer.Close asChild>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={transferToManager.isPending}
                >
                  {t("supportDesk.cancel")}
                </Button>
              </Drawer.Close>
              <Button
                size="small"
                disabled={transferReason.trim().length < 3 || !selectedTask}
                isLoading={transferToManager.isPending}
                onClick={() =>
                  selectedTask && transferToManager.mutate(selectedTask)
                }
              >
                {t("supportDesk.confirmTransfer")}
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      <Drawer open={releaseOpen} onOpenChange={setReleaseOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{t("supportDesk.releaseTitle")}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="p-4">
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              {t("supportDesk.releaseDescription")}
            </Text>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex justify-end gap-x-2">
              <Drawer.Close asChild>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={releaseTask.isPending}
                >
                  {t("supportDesk.keepWorking")}
                </Button>
              </Drawer.Close>
              <Button
                size="small"
                isLoading={releaseTask.isPending}
                disabled={!selectedTask}
                onClick={() => selectedTask && releaseTask.mutate(selectedTask)}
              >
                {t("supportDesk.confirmRelease")}
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "supportDesk.navigation",
  rank: 29,
  translationNs: "translation",
})

export default CustomerSupportPage
