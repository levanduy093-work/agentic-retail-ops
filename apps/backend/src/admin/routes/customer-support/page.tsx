import {
  Badge,
  Button,
  Container,
  Drawer,
  DropdownMenu,
  FocusModal,
  Heading,
  IconButton,
  Select,
  StatusBadge,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  BrainIcon,
  EllipsisHorizontalIcon,
  FacebookIcon,
  FacebookMessengerIcon,
  GlobeIcon,
  MailIcon,
  SendIcon,
  TelegramIcon,
  TrashIcon,
  UserIcon,
  ZaloIcon,
} from "../../lib/icons"
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
  conversation_id?: string | null
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
    metadata?: Record<string, unknown> | null
    title: string
  }
  customer_preferences?: Array<{
    preference_type: string
    status: string
    value: string
  }>
  customer_profile?: {
    channel?: string | null
    customer_tier?: string | null
    email?: string | null
    name?: string | null
    orders_count?: number | null
    phone?: string | null
    shipping_city?: string | null
  } | null
  memory: ConversationMemory | null
  messages: Array<{
    body: string
    direction: "INBOUND" | "OUTBOUND"
    id: string
    image_attachments: Array<{
      id: string
      url: string
    }>
    occurred_at: string
    product_media: Array<{
      image_url: string
      product_id: string
      product_url: string | null
      title: string
    }>
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
  metadata?: Record<string, unknown> | null
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

const customerNameFromConversation = (
  conversation: {
    title?: string | null
  },
  t?: (key: any, ...args: any[]) => any,
) => {
  const title = conversation.title?.trim()
  if (title) {
    const customerName = title.replace(
      /^(Telegram|Zalo|Slack|Teams|Messenger|Facebook|Email|Gmail)\s+[—–-]\s+/i,
      "",
    )

    return /^(customer-chat-eval-\d+|qa retained customer-chat evaluation)/i.test(
      customerName,
    )
      ? (t ? t("supportDesk.testCustomer", "Khách hàng (kiểm thử)") : "Khách hàng (kiểm thử)")
      : customerName
  }

  return t ? t("supportDesk.customer", "Customer") : "Customer"
}

const getChannelIcon = (channel?: string | null, size = 16) => {
  const norm = (channel ?? "").toUpperCase()
  if (norm.includes("TELEGRAM")) {
    return <TelegramIcon size={size} className="shrink-0 text-[#229ED9]" />
  }
  if (norm.includes("ZALO")) {
    return <ZaloIcon size={size} className="shrink-0 text-[#0068FF]" />
  }
  if (norm.includes("MESSENGER")) {
    return <FacebookMessengerIcon size={size} className="shrink-0 text-[#0084FF]" />
  }
  if (norm.includes("FACEBOOK")) {
    return <FacebookIcon size={size} className="shrink-0 text-[#1877F2]" />
  }
  if (norm.includes("EMAIL") || norm.includes("GMAIL") || norm.includes("MAIL")) {
    return <MailIcon size={size} className="shrink-0 text-[#EA4335]" />
  }
  return <GlobeIcon size={size} className="shrink-0 text-ui-fg-muted" />
}

const getChannelLabel = (channel?: string | null, t?: (key: any, ...args: any[]) => any) => {
  const norm = (channel ?? "").toLowerCase()
  if (norm.includes("telegram")) return t ? t("supportDesk.channels.telegram", { defaultValue: "Telegram" }) : "Telegram"
  if (norm.includes("zalo")) return t ? t("supportDesk.channels.zalo", { defaultValue: "Zalo OA" }) : "Zalo OA"
  if (norm.includes("messenger") || norm.includes("facebook")) return t ? t("supportDesk.channels.messenger", { defaultValue: "Facebook Messenger" }) : "Facebook Messenger"
  if (norm.includes("email") || norm.includes("gmail") || norm.includes("mail")) return t ? t("supportDesk.channels.email", { defaultValue: "Gmail / Email" }) : "Gmail / Email"
  return t ? t("supportDesk.channels.in_app", { defaultValue: "Storefront Web" }) : "Storefront Web"
}

type CustomerSupportContentProps = {
  embedded?: boolean
}

export const CustomerSupportContent = ({
  embedded = false,
}: CustomerSupportContentProps) => {
  const { i18n, t } = useTranslation()
  const queryClient = useQueryClient()
  const [view, setView] = useState<"attention" | "all">("attention")
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null)
  const [reply, setReply] = useState("")
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false)
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [simulatorLocale, setSimulatorLocale] = useState<"en" | "vi">("vi")
  const [simulatorOpen, setSimulatorOpen] = useState(false)
  const [simulatorOrderId, setSimulatorOrderId] = useState("")
  const [simulatorQuestion, setSimulatorQuestion] = useState("")
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferReason, setTransferReason] = useState("")
  const locale = i18n.language.startsWith("vi") ? "vi-VN" : "en-US"

  const [isLiveConnected, setIsLiveConnected] = useState(false)

  useEffect(() => {
    let eventSource: EventSource | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

    const connectSSE = () => {
      try {
        eventSource = new EventSource(
          "/admin/agent-operations/conversations/stream",
          { withCredentials: true }
        )

        eventSource.onopen = () => {
          setIsLiveConnected(true)
        }

        eventSource.addEventListener("conversation.updated", () => {
          queryClient.invalidateQueries({
            queryKey: ["customer-support-conversations"],
          })
          queryClient.invalidateQueries({
            queryKey: ["customer-support-tasks"],
          })
        })

        eventSource.addEventListener("message.created", () => {
          queryClient.invalidateQueries({
            queryKey: ["customer-support-conversations"],
          })
          queryClient.invalidateQueries({
            queryKey: ["customer-support-conversation"],
          })
        })

        eventSource.addEventListener("task.updated", () => {
          queryClient.invalidateQueries({
            queryKey: ["customer-support-tasks"],
          })
          queryClient.invalidateQueries({
            queryKey: ["customer-support-conversation"],
          })
          queryClient.invalidateQueries({
            queryKey: ["customer-support-conversations"],
          })
        })

        eventSource.onerror = () => {
          setIsLiveConnected(false)
          eventSource?.close()
          reconnectTimeout = setTimeout(connectSSE, 5000)
        }
      } catch {
        setIsLiveConnected(false)
        reconnectTimeout = setTimeout(connectSSE, 5000)
      }
    }

    connectSSE()

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (eventSource) eventSource.close()
    }
  }, [queryClient])

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
    refetchInterval: isLiveConnected ? 5_000 : 3_000,
    refetchIntervalInBackground: true,
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
  const conversation = useQuery({
    enabled: Boolean(selectedConversationId),
    queryFn: () =>
      sdk.client.fetch<SupportConversationResponse>(
        `/admin/agent-operations/conversations/${selectedConversationId}`,
      ),
    queryKey: ["customer-support-conversation", selectedConversationId],
    refetchInterval: isLiveConnected ? 5_000 : 3_000,
    refetchIntervalInBackground: true,
  })
  const selectedSimulatorOrder = simulatorOrders.data?.orders.find(
    (order) => order.id === simulatorOrderId,
  ) as SimulatorOrder | undefined

  const activeConversationTasks = conversation.data?.support_tasks ?? []
  const selectedTask =
    activeConversationTasks.find(
      (task) => !TERMINAL_STATUSES.includes(task.status),
    ) ??
    (selectedConversation?.support_task &&
    !TERMINAL_STATUSES.includes(selectedConversation.support_task.status)
      ? selectedConversation.support_task
      : null) ??
    supportTasks.find(
      (task) =>
        (task.support_conversation_id === selectedConversationId ||
          task.conversation_id === selectedConversationId) &&
        !TERMINAL_STATUSES.includes(task.status),
    ) ??
    activeConversationTasks[0] ??
    selectedConversation?.support_task ??
    supportTasks.find(
      (task) =>
        task.support_conversation_id === selectedConversationId ||
        task.conversation_id === selectedConversationId,
    ) ??
    null

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

  const submitAndSendReply = useMutation({
    mutationFn: async (task: SupportTask) => {
      const text = reply.trim()
      const existingResponseBody =
        typeof task.result?.response_body === "string"
          ? task.result.response_body.trim()
          : ""
      const messageBody = text.length >= 3 ? text : existingResponseBody
      if (messageBody.length < 3) {
        throw new Error(t("supportDesk.replyRequired"))
      }

      const userId = currentUser.data?.user.id
      let currentTask = task
      let status = currentTask.status

      if (status === "TODO") {
        const claimed = await sdk.client.fetch<{ task: SupportTask }>(
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
        currentTask = claimed.task ?? { ...currentTask, status: "CLAIMED" }
        status = "CLAIMED"
      }
      if (["CLAIMED", "WAITING"].includes(status)) {
        const inProgress = await sdk.client.fetch<{ task: SupportTask }>(
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
        currentTask = inProgress.task ?? { ...currentTask, status: "IN_PROGRESS" }
        status = "IN_PROGRESS"
      }
      if (
        status === "IN_PROGRESS" ||
        (status !== "COMPLETED" && !TERMINAL_STATUSES.includes(status))
      ) {
        const completed = await sdk.client.fetch<{ task: SupportTask }>(
          `/admin/agent-operations/tasks/${task.id}/transition`,
          {
            body: {
              expected_status: "IN_PROGRESS",
              result: {
                message_sent: false,
                response_body: messageBody,
                review_language: locale,
                reviewed_by_human: true,
              },
              status: "COMPLETED",
            },
            method: "POST",
          },
        )
        currentTask = completed.task
      }

      return sdk.client.fetch(
        `/admin/agent-operations/tasks/${task.id}/send-reviewed-reply`,
        {
          body: { expected_task_updated_at: currentTask.updated_at },
          method: "POST",
        },
      )
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: async () => {
      toast.success(t("supportDesk.reviewedReplySent"))
      setSendOpen(false)
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

  const clearConversationHistory = useMutation({
    mutationFn: (conversationId: string) =>
      sdk.client.fetch(
        `/admin/agent-operations/conversations/${conversationId}/clear-history`,
        {
          body: { idempotency_key: crypto.randomUUID() },
          method: "POST",
        },
      ),
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: async () => {
      toast.success(t("supportDesk.historyCleared"))
      setClearHistoryOpen(false)
      setSelectedConversationId(null)
      await invalidateSupportData()
    },
  })

  const sendDirectMessage = useMutation({
    mutationFn: async ({
      conversationId,
      body,
    }: {
      conversationId: string
      body: string
    }) => {
      const text = body.trim()
      if (text.length < 1) {
        throw new Error(t("supportDesk.replyRequired", { defaultValue: "Vui lòng nhập nội dung tin nhắn." }))
      }
      return sdk.client.fetch(
        `/admin/agent-operations/conversations/${conversationId}/direct-message`,
        {
          body: { body: text, client_message_id: crypto.randomUUID() },
          method: "POST",
        }
      )
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: async () => {
      toast.success(t("supportDesk.directSendSuccess", { defaultValue: "Đã gửi tin nhắn cho khách hàng." }))
      setReply("")
      await invalidateSupportData()
    },
  })

  const toggleConversationAi = useMutation({
    mutationFn: async ({
      conversationId,
      paused,
    }: {
      conversationId: string
      paused: boolean
    }) => {
      return sdk.client.fetch(
        `/admin/agent-operations/conversations/${conversationId}/toggle-ai`,
        {
          body: { paused },
          method: "POST",
        }
      )
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: async (_, variables) => {
      toast.success(
        variables.paused
          ? t("supportDesk.aiPausedSuccess", { defaultValue: "Đã tạm dừng AI cho cuộc hội thoại này." })
          : t("supportDesk.aiResumedSuccess", { defaultValue: "Đã bật lại AI hỗ trợ." })
      )
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
    ? (storedCustomerName ?? customerNameFromConversation(selectedConversation, t))
    : "—"
  const customerReference =
    customer.data?.customer?.email ??
    selectedConversation?.channel ??
    selectedTask?.input?.channel ??
    "—"
  const conversationMetadata = (selectedConversation?.metadata ?? {}) as Record<string, unknown>
  const isAiPaused = conversationMetadata.ai_paused === true
  const isSending = submitAndSendReply.isPending || sendDirectMessage.isPending
  const isTogglingAi = toggleConversationAi.isPending

  const assignedToManager = selectedTask
    ? isAssignedToManager(selectedTask)
    : false
  const assignedToOther = Boolean(
    selectedTask?.assigned_to_id &&
    selectedTask.assigned_to_type === "user" &&
    selectedTask.assigned_to_id !== currentUser.data?.user.id,
  )
  const messageSent = selectedTask?.result?.message_sent === true
  const canEdit =
    Boolean(selectedTask) &&
    !["CANCELLED", "DEAD"].includes(selectedTask!.status) &&
    !assignedToManager &&
    !messageSent
  const canSend =
    Boolean(selectedConversation) &&
    !assignedToManager &&
    !assignedToOther &&
    !isSending &&
    reply.trim().length >= 1
  const canClearHistory = Boolean(selectedConversation)

  const handleSend = () => {
    if (!selectedConversation || reply.trim().length < 1 || isSending) return

    if (
      selectedTask &&
      !TERMINAL_STATUSES.includes(selectedTask.status) &&
      !messageSent
    ) {
      submitAndSendReply.mutate(selectedTask)
    } else {
      sendDirectMessage.mutate({
        conversationId: selectedConversation.id,
        body: reply.trim(),
      })
    }
  }

  if (tasks.isLoading || conversations.isLoading || currentUser.isLoading) {
    return (
      <Container className="flex min-h-[360px] items-center justify-center">
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          {t("supportDesk.loading")}
        </Text>
      </Container>
    )
  }

  if (
    (tasks.isError && !tasks.data) ||
    (conversations.isError && !conversations.data) ||
    (currentUser.isError && !currentUser.data)
  ) {
    return (
      <Container className="flex min-h-[360px] flex-col items-start justify-center gap-3">
        <Text className="text-ui-fg-error" size="small" leading="compact">
          {t("supportDesk.loadError")}
        </Text>
        <Text className="text-ui-fg-subtle" size="small" leading="compact">
          {t("supportDesk.loadErrorDesc")}
        </Text>
        <Button
          onClick={() => {
            void Promise.all([currentUser.refetch(), tasks.refetch(), conversations.refetch()])
          }}
          size="small"
          variant="secondary"
        >
          {t("supportDesk.retryAction")}
        </Button>
      </Container>
    )
  }

  return (
    <div className="flex flex-col gap-y-3">
      {!embedded && (
        <Container className="p-0">
          <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-y-1">
              <div className="flex items-center gap-x-2">
                <Heading level="h1">{t("supportDesk.title")}</Heading>
                <Badge color="green" size="small">Native Loop Dispatch</Badge>
              </div>
              <Text
                size="small"
                leading="compact"
                className="text-ui-fg-subtle"
              >
                {t("supportDesk.subtitle")}
              </Text>
            </div>
            <div className="flex items-center gap-x-3">
              <div className="flex items-center gap-x-2 text-xs text-ui-fg-subtle">
                <div className="flex flex-col items-end">
                  <span className="font-medium text-ui-fg-base">
                    {allConversations.length} hội thoại
                  </span>
                  <span>{attentionConversations.length} cần chú ý</span>
                </div>
                <div className="h-6 w-px bg-ui-border-base" />
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-ui-fg-interactive">
                    {allConversations.length > 0
                      ? `${Math.round(((allConversations.length - attentionConversations.length) / allConversations.length) * 100)}%`
                      : "100%"}
                  </span>
                  <span>Containment</span>
                </div>
              </div>
              {window.location.hostname === "localhost" && (
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => setSimulatorOpen(true)}
                >
                  {t("supportDesk.openSimulator")}
                </Button>
              )}
            </div>
          </div>
        </Container>
      )}

      <div className="grid gap-3 md:h-[calc(100dvh-14rem)] md:min-h-[520px] md:grid-cols-[380px_minmax(0,1fr)]">
        <Container className="p-0 md:grid md:h-full md:min-h-0 md:grid-rows-[auto_auto_minmax(0,1fr)] md:overflow-hidden">
          <div className="flex items-center justify-between border-b border-ui-border-base px-4 py-3">
            <div className="flex gap-x-2">
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
          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain px-3 py-3 [scrollbar-gutter:stable]">
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
                const itemCustomerName = customerNameFromConversation(item, t)
                const isSelected = item.id === selectedConversationId
                const itemChannel = item.channel || item.support_task?.input?.channel || "IN_APP"
                const isAiPausedItem = (item.metadata as Record<string, unknown> | null)?.ai_paused === true
                const isUnreplied = item.latest_message?.direction === "INBOUND" || item.requires_human_attention
                const isAnswered = !isUnreplied && Boolean(item.latest_message)

                return (
                  <Button
                    className={`h-auto w-full shrink-0 justify-start rounded-lg border px-3 py-3 text-left transition-all ${
                      isSelected
                        ? "border-ui-border-interactive bg-ui-bg-highlight shadow-elevation-card-rest hover:bg-ui-bg-highlight"
                        : isUnreplied
                        ? "border-ui-border-base bg-ui-bg-base shadow-elevation-card-rest hover:bg-ui-bg-component-hover"
                        : "border-ui-border-base/60 bg-ui-bg-subtle/50 opacity-75 hover:bg-ui-bg-component-hover hover:opacity-100"
                    }`}
                    key={item.id}
                    size="small"
                    variant="transparent"
                    onClick={() => setSelectedConversationId(item.id)}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-y-1.5">
                      <div className="flex min-w-0 items-center justify-between gap-x-2">
                        <div className="flex min-w-0 items-center gap-x-1.5">
                          {getChannelIcon(itemChannel, 14)}
                          <Text
                            className={`truncate ${isUnreplied ? "text-ui-fg-base" : "text-ui-fg-subtle"}`}
                            size="small"
                            leading="compact"
                            weight={isUnreplied ? "plus" : "regular"}
                          >
                            {itemCustomerName}
                          </Text>
                        </div>
                        {item.requires_human_attention ? (
                          <Badge
                            color="red"
                            size="2xsmall"
                            className="shrink-0 font-medium"
                          >
                            {t("supportDesk.needsHuman")}
                          </Badge>
                        ) : isAiPausedItem ? (
                          <Badge
                            color="purple"
                            size="2xsmall"
                            className="shrink-0 font-medium"
                          >
                            {t("supportDesk.aiPaused", { defaultValue: "AI đã tạm dừng" })}
                          </Badge>
                        ) : item.latest_message?.direction === "INBOUND" ? (
                          <Badge
                            color="green"
                            size="2xsmall"
                            className="shrink-0 font-medium"
                          >
                            {t("supportDesk.newMessage", { defaultValue: "Tin mới" })}
                          </Badge>
                        ) : null}
                      </div>
                      <Text
                        className={`line-clamp-2 ${
                          isUnreplied ? "text-ui-fg-base font-medium" : "text-ui-fg-muted"
                        }`}
                        size="small"
                        leading="compact"
                      >
                        {item.latest_message?.body ??
                          item.memory?.summary ??
                          item.title}
                      </Text>
                      <div className="flex items-center justify-between text-ui-fg-muted">
                        <Text size="xsmall" leading="compact">
                          {getChannelLabel(itemChannel, t)}
                        </Text>
                        <Text size="xsmall" leading="compact">
                          {formatDate(item.last_message_at)}
                        </Text>
                      </div>
                    </div>
                  </Button>
                )
              })
            )}
          </div>
        </Container>

        <Container className="p-0 md:h-full md:min-h-0 md:overflow-hidden">
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
            <div className="divide-y divide-ui-border-base md:flex md:h-full md:min-h-0 md:flex-col">
              <div className="flex shrink-0 flex-col gap-y-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-x-3">
                  {getChannelIcon(selectedConversation.channel || selectedTask?.input?.channel, 20)}
                  <div className="flex flex-col gap-y-0.5">
                    <Heading level="h2">{customerName}</Heading>
                    <Text
                      size="xsmall"
                      leading="compact"
                      className="text-ui-fg-subtle"
                    >
                      {getChannelLabel(selectedConversation.channel || selectedTask?.input?.channel, t)} · {customerReference}
                    </Text>
                  </div>
                </div>
                <div className="flex items-center gap-x-2">
                  <StatusBadge
                    color={
                      selectedTask
                        ? statusColor(selectedTask.status)
                        : isAiPaused
                        ? "purple"
                        : "green"
                    }
                  >
                    {selectedTask
                      ? humanStatus(selectedTask.status)
                      : isAiPaused
                      ? t("supportDesk.aiPaused", { defaultValue: "AI đã tạm dừng" })
                      : t("supportDesk.aiHandling", { defaultValue: "AI đang hỗ trợ" })}
                  </StatusBadge>
                  {selectedTask?.due_at && (
                    <Text
                      size="xsmall"
                      leading="compact"
                      className="text-ui-fg-subtle hidden sm:inline"
                    >
                      {t("supportDesk.due", {
                        time: formatDate(selectedTask.due_at),
                      })}
                    </Text>
                  )}

                  {/* Customer Memory & Profile Button */}
                  {selectedConversation && (
                    <Button
                      size="small"
                      variant="secondary"
                      className="text-xsmall"
                      onClick={() => setMemoryOpen(true)}
                    >
                      <BrainIcon size={14} className="mr-1.5 text-ui-fg-subtle" />
                      {t("supportDesk.customerMemoryBtn", { defaultValue: "Bộ nhớ & Thông tin" })}
                    </Button>
                  )}

                  {/* Pause / Resume AI Button */}
                  {selectedConversation && (
                    <Button
                      size="small"
                      variant="secondary"
                      className="text-xsmall"
                      isLoading={isTogglingAi}
                      onClick={() =>
                        toggleConversationAi.mutate({
                          conversationId: selectedConversation.id,
                          paused: !isAiPaused,
                        })
                      }
                    >
                      {isAiPaused
                        ? t("supportDesk.resumeAi", { defaultValue: "Bật lại AI" })
                        : t("supportDesk.pauseAi", { defaultValue: "Tạm dừng AI" })}
                    </Button>
                  )}

                  {/* 3-dots Dropdown Menu */}
                  <DropdownMenu>
                    <DropdownMenu.Trigger asChild>
                      <IconButton
                        variant="transparent"
                        size="small"
                        aria-label={t("supportDesk.actionsMenu", "Thao tác")}
                        className="text-ui-fg-subtle hover:text-ui-fg-base"
                      >
                        <EllipsisHorizontalIcon size={16} />
                      </IconButton>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end" className="min-w-[180px]">
                      {selectedTask &&
                        !TERMINAL_STATUSES.includes(selectedTask.status) &&
                        !assignedToManager && (
                          <DropdownMenu.Item
                            onClick={() => setTransferOpen(true)}
                            disabled={assignedToOther}
                            className="cursor-pointer"
                          >
                            {t("supportDesk.transferManager")}
                          </DropdownMenu.Item>
                        )}
                      {selectedTask &&
                        !TERMINAL_STATUSES.includes(selectedTask.status) &&
                        !assignedToManager && <DropdownMenu.Separator />}
                      {selectedConversation && (
                        <DropdownMenu.Item
                          onClick={() =>
                            toggleConversationAi.mutate({
                              conversationId: selectedConversation.id,
                              paused: !isAiPaused,
                            })
                          }
                          className="cursor-pointer"
                          disabled={isTogglingAi}
                        >
                          {isAiPaused
                            ? t("supportDesk.resumeAi", { defaultValue: "Bật lại AI" })
                            : t("supportDesk.pauseAi", { defaultValue: "Tạm dừng AI" })}
                        </DropdownMenu.Item>
                      )}
                      {selectedConversation && <DropdownMenu.Separator />}
                      <DropdownMenu.Item
                        className="cursor-pointer text-ui-fg-error focus:bg-ui-bg-base-hover"
                        onClick={() => setClearHistoryOpen(true)}
                        disabled={!canClearHistory || clearConversationHistory.isPending}
                      >
                        <TrashIcon className="mr-2" size={14} />
                        {t("supportDesk.clearHistory")}
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex min-h-[460px] flex-col bg-ui-bg-subtle md:min-h-0 md:flex-1">
                <div
                  className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-6 py-5"
                  key={selectedConversationId}
                >
                  {conversation.isLoading ? (
                    <Text
                      size="small"
                      leading="compact"
                      className="text-ui-fg-subtle"
                    >
                      {t("supportDesk.loading")}
                    </Text>
                  ) : conversation.isError && !conversation.data ? (
                    <div className="flex flex-col items-start gap-3 rounded-lg border border-ui-border-error bg-ui-bg-base p-4">
                      <Text className="text-ui-fg-error" size="small">
                        {t("supportDesk.conversationLoadError")}
                      </Text>
                      <Button
                        onClick={() => void conversation.refetch()}
                        size="small"
                        variant="secondary"
                      >
                        {t("supportDesk.retryAction")}
                      </Button>
                    </div>
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
                            <Text
                              className="whitespace-pre-wrap break-words"
                              size="small"
                              leading="compact"
                            >
                              {message.body}
                            </Text>
                            {message.image_attachments.length > 0 && (
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                {message.image_attachments.map((attachment) => (
                                  <a
                                    href={attachment.url}
                                    key={attachment.id}
                                    rel="noreferrer"
                                    target="_blank"
                                    title={t("supportDesk.openAttachment", "Mở ảnh gốc")}
                                  >
                                    <img
                                      alt={t("supportDesk.customerAttachment", "Ảnh khách gửi")}
                                      className="h-24 w-24 rounded-md border border-ui-border-base object-cover transition-opacity hover:opacity-80"
                                      loading="lazy"
                                      src={attachment.url}
                                    />
                                  </a>
                                ))}
                              </div>
                            )}
                            {message.product_media.length > 0 && (
                              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                {message.product_media.map((media) => {
                                  const image = (
                                    <img
                                      alt={media.title}
                                      className="aspect-square w-full rounded-md border border-ui-border-base object-cover transition-opacity hover:opacity-80"
                                      loading="lazy"
                                      src={media.image_url}
                                    />
                                  )

                                  return media.product_url ? (
                                    <a
                                      href={media.product_url}
                                      key={`${media.product_id}:${media.image_url}`}
                                      rel="noreferrer"
                                      target="_blank"
                                      title={media.title}
                                    >
                                      {image}
                                    </a>
                                  ) : (
                                    <div key={`${media.product_id}:${media.image_url}`}>
                                      {image}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
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
                        <Text
                          className="whitespace-pre-wrap break-words"
                          size="small"
                          leading="compact"
                        >
                          {selectedConversation.latest_message?.body ?? "—"}
                        </Text>
                      </div>
                    </div>
                  )}
                </div>

                {/* Direct Message Input Bar */}
                <div className="border-t border-ui-border-base bg-ui-bg-base px-4 py-3 sm:px-6">
                  {/* Status hint if AI handling or assigned */}
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      {!selectedTask && isAiPaused && (
                        <Text
                          size="xsmall"
                          leading="compact"
                          className="text-ui-fg-warning font-medium"
                        >
                          {t("supportDesk.aiPausedDesc")}
                        </Text>
                      )}
                      {!selectedTask && !isAiPaused && (
                        <Text
                          size="xsmall"
                          leading="compact"
                          className="text-ui-fg-subtle"
                        >
                          {t("supportDesk.aiActiveDesc")}
                        </Text>
                      )}
                      {assignedToManager && (
                        <Text
                          size="xsmall"
                          leading="compact"
                          className="text-ui-fg-warning font-medium"
                        >
                          {t("supportDesk.transferred")}
                        </Text>
                      )}
                      {assignedToOther && (
                        <Text
                          size="xsmall"
                          leading="compact"
                          className="text-ui-fg-subtle"
                        >
                          {t("supportDesk.claimedByOther")}
                        </Text>
                      )}
                      {messageSent && (
                        <Text
                          size="xsmall"
                          leading="compact"
                          className="text-ui-fg-success"
                        >
                          {t("supportDesk.simulatorAlreadySent")}
                        </Text>
                      )}
                    </div>
                  </div>

                  <div className="flex items-end gap-x-2">
                    <Textarea
                      className="min-h-[48px] max-h-[140px] flex-1 resize-none cursor-text text-small"
                      placeholder={t("supportDesk.replyDirectPlaceholder", {
                        defaultValue: "Nhập tin nhắn phản hồi cho khách... (Enter để gửi, Shift+Enter để xuống dòng)",
                      })}
                      rows={2}
                      disabled={assignedToManager || assignedToOther || isSending}
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault()
                          if (canSend) {
                            handleSend()
                          }
                        }
                      }}
                    />
                    <Button
                      size="small"
                      variant="primary"
                      className="h-[48px] px-4 shrink-0"
                      disabled={!canSend}
                      isLoading={isSending}
                      onClick={handleSend}
                    >
                      <SendIcon className="mr-1.5" size={14} />
                      {t("supportDesk.directSend", { defaultValue: "Gửi tin nhắn" })}
                    </Button>
                  </div>
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

      <Drawer open={clearHistoryOpen} onOpenChange={setClearHistoryOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{t("supportDesk.clearHistoryTitle")}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="p-4">
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              {t("supportDesk.clearHistoryDescription")}
            </Text>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex justify-end gap-x-2">
              <Drawer.Close asChild>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={clearConversationHistory.isPending}
                >
                  {t("supportDesk.cancel")}
                </Button>
              </Drawer.Close>
              <Button
                size="small"
                variant="danger"
                disabled={!selectedConversation || clearConversationHistory.isPending}
                isLoading={clearConversationHistory.isPending}
                onClick={() =>
                  selectedConversation &&
                  clearConversationHistory.mutate(selectedConversation.id)
                }
              >
                {t("supportDesk.confirmClearHistory")}
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      {/* Customer Memory & Profile Drawer */}
      <Drawer open={memoryOpen} onOpenChange={setMemoryOpen}>
        <Drawer.Content className="max-w-md">
          <Drawer.Header>
            <div className="flex items-center gap-x-2">
              <BrainIcon size={20} className="text-ui-fg-interactive" />
              <Drawer.Title>
                {t("supportDesk.customerMemoryDrawerTitle", {
                  defaultValue: "Hồ sơ & Bộ nhớ AI (Customer Memory)",
                })}
              </Drawer.Title>
            </div>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-5 p-5 overflow-y-auto">
            {/* Customer Profile Section */}
            <div className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
              <div className="flex items-center gap-x-2 mb-3">
                <UserIcon size={16} className="text-ui-fg-subtle" />
                <Heading level="h3" className="text-small font-semibold">
                  {t("supportDesk.customerProfileTitle", { defaultValue: "Thông tin khách hàng" })}
                </Heading>
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-small">
                <Text size="xsmall" className="text-ui-fg-subtle">{t("supportDesk.customerName", { defaultValue: "Họ tên" })}:</Text>
                <Text size="xsmall" weight="plus" className="text-ui-fg-base">{customerName}</Text>
                <Text size="xsmall" className="text-ui-fg-subtle">{t("supportDesk.customerChannel", { defaultValue: "Kênh" })}:</Text>
                <Text size="xsmall" className="text-ui-fg-base">{getChannelLabel(selectedConversation?.channel, t)}</Text>
                {conversation.data?.customer_profile?.phone && (
                  <>
                    <Text size="xsmall" className="text-ui-fg-subtle">SĐT:</Text>
                    <Text size="xsmall" className="text-ui-fg-base">{conversation.data.customer_profile.phone}</Text>
                  </>
                )}
                {conversation.data?.customer_profile?.email && (
                  <>
                    <Text size="xsmall" className="text-ui-fg-subtle">Email:</Text>
                    <Text size="xsmall" className="text-ui-fg-base">{conversation.data.customer_profile.email}</Text>
                  </>
                )}
                {conversation.data?.customer_profile?.customer_tier && (
                  <>
                    <Text size="xsmall" className="text-ui-fg-subtle">Hạng thành viên:</Text>
                    <Text size="xsmall" weight="plus" className="text-ui-fg-interactive">{conversation.data.customer_profile.customer_tier}</Text>
                  </>
                )}
              </div>
            </div>

            {/* AI Stated Facts */}
            <div className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
              <div className="flex items-center justify-between mb-3">
                <Heading level="h3" className="text-small font-semibold">
                  {t("supportDesk.aiFactsTitle", { defaultValue: "Dữ liệu AI đã ghi nhớ (Customer Facts)" })}
                </Heading>
                {conversation.data?.memory && (
                  <Badge size="2xsmall" color="blue">
                    {t("supportDesk.memoryVersion", {
                      version: conversation.data.memory.version,
                      count: conversation.data.memory.source_message_count,
                    })}
                  </Badge>
                )}
              </div>
              {conversation.data?.memory?.customer_facts?.length ? (
                <ul className="list-disc list-inside flex flex-col gap-y-1.5">
                  {conversation.data.memory.customer_facts.map((fact, index) => (
                    <li key={index} className="text-xsmall text-ui-fg-base leading-relaxed">
                      {fact}
                    </li>
                  ))}
                </ul>
              ) : (
                <Text size="xsmall" className="text-ui-fg-subtle italic">
                  {t("supportDesk.noFactsYet", { defaultValue: "Chưa có dữ liệu cố định nào được ghi nhận." })}
                </Text>
              )}
            </div>

            {/* Preferences */}
            {conversation.data?.customer_preferences?.length ? (
              <div className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
                <Heading level="h3" className="text-small font-semibold mb-3">
                  {t("supportDesk.preferencesTitle", { defaultValue: "Sở thích & Thông số (Preferences)" })}
                </Heading>
                <div className="flex flex-wrap gap-2">
                  {conversation.data.customer_preferences.map((pref, idx) => (
                    <Badge key={idx} size="small" color="grey">
                      {pref.preference_type}: {pref.value}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Conversation Summary & Progress */}
            <div className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
              <Heading level="h3" className="text-small font-semibold mb-2">
                {t("supportDesk.summaryTitle", { defaultValue: "Tóm tắt tiến trình hội thoại" })}
              </Heading>
              <Text size="xsmall" className="text-ui-fg-base leading-relaxed mb-3">
                {conversation.data?.memory?.summary ?? t("supportDesk.memoryPending")}
              </Text>

              {conversation.data?.memory?.open_questions?.length ? (
                <div className="mt-3">
                  <Text size="xsmall" weight="plus" className="text-ui-fg-warning mb-1">
                    {t("supportDesk.openQuestions")}:
                  </Text>
                  <ul className="list-disc list-inside flex flex-col gap-y-1">
                    {conversation.data.memory.open_questions.map((q, idx) => (
                      <li key={idx} className="text-xsmall text-ui-fg-subtle">
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {conversation.data?.memory?.resolved_topics?.length ? (
                <div className="mt-3">
                  <Text size="xsmall" weight="plus" className="text-ui-fg-success mb-1">
                    {t("supportDesk.resolvedMilestones", { defaultValue: "Mốc đã hoàn tất" })}:
                  </Text>
                  <ul className="list-disc list-inside flex flex-col gap-y-1">
                    {conversation.data.memory.resolved_topics.map((item, idx) => (
                      <li key={idx} className="text-xsmall text-ui-fg-subtle">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex justify-end gap-x-2">
              <Drawer.Close asChild>
                <Button size="small" variant="secondary">
                  {t("supportDesk.close", { defaultValue: "Đóng" })}
                </Button>
              </Drawer.Close>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}

const CustomerSupportPage = () => <CustomerSupportContent />

export default CustomerSupportPage
