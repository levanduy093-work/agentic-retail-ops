import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  StatusBadge,
  Text,
  Textarea,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { sdk } from "../../lib/sdk"
import { AiConnectionsContent } from "../ai-connections/page"
import { CustomerSupportContent } from "../customer-support/page"
import { ChatChannelsContent } from "./chat-channels"
import { PromptsConfigContent } from "./prompts-config"
import {
  GooglePickerCredential,
  type GooglePickerSelection,
  openGoogleKnowledgePicker,
} from "./google-picker"
import {
  findKnowledgeDocumentSource,
  isKnowledgeVerificationArtifact,
} from "./knowledge-hub-utils"

type KnowledgeDocument = {
  citation_locator: string
  content: string
  created_at: string
  document_key: string
  effective_at: string
  expires_at: string | null
  id: string
  locale: string
  owner_id: string
  scope: string
  status: "APPROVED" | "DRAFT" | "RETIRED"
  title: string
  version: string
}

type KnowledgeChunk = {
  chunk_index: number
  citation_locator: string
  content: string
  id: string
  word_count: number
}

type KnowledgeListResponse = {
  count: number
  documents: KnowledgeDocument[]
}

type KnowledgeDetailResponse = {
  chunks: KnowledgeChunk[]
  document: KnowledgeDocument
}

type KnowledgeCreateResponse = {
  chunk_count: number
  document: KnowledgeDocument
  duplicate: boolean
}

type KnowledgeApprovalResponse = {
  document: KnowledgeDocument
  duplicate: boolean
  rag_index: {
    error?: string
    indexed_chunks: number
    provider: string
    status: "DISABLED" | "FAILED" | "INDEXED" | "SKIPPED"
  }
}

type KnowledgeSearchResponse = {
  results: Array<{
    citation_locator: string
    document_id: string
    excerpt: string
    score: number
    title: string
    version: string
  }>
  total_candidates: number
}

type KnowledgeSource = {
  id: string
  last_document_id: string | null
  last_error: string | null
  last_sync_status: "FAILED" | "NEVER" | "SUCCEEDED" | "UNCHANGED"
  locale: string
  name: string
  owner_id: string
  scope: string
  source_type: "GOOGLE_DOC" | "GOOGLE_DRIVE" | "GOOGLE_SHEET"
  source_url: string
}

type KnowledgeSourceListResponse = {
  count: number
  sources: KnowledgeSource[]
}

type GoogleConnectorStatus = {
  account_email: string | null
  connected: boolean
  platform_ready: boolean
  uses_dedicated_encryption_key: boolean
}

type GoogleAuthorizationResponse = {
  authorization_url: string
}

type KnowledgeSourceSyncResponse = {
  document: KnowledgeDocument | null
  source: KnowledgeSource
  status: "FAILED" | "SUCCEEDED" | "UNCHANGED"
}

type KnowledgeSourcePrepareResponse = {
  document: KnowledgeDocument
  rag_index: {
    error?: string
    indexed_chunks: number
    provider: string
    status: "DISABLED" | "FAILED" | "INDEXED" | "SKIPPED"
  }
  source: KnowledgeSource
}

type SupportedGooglePickerSelection = Extract<
  GooglePickerSelection,
  { supported: true }
>

type BatchSourceOutcome = {
  error?: string
  selection: SupportedGooglePickerSelection
  source_created: boolean
}

type SourceProcessingStage =
  | "connecting"
  | "embedding"
  | "failed"
  | "ready"
  | "syncing"

type SourceProcessingState = {
  progress: number
  source_id: string | null
  stage: SourceProcessingStage
}

const statusColor = (status: KnowledgeDocument["status"]) => {
  if (status === "APPROVED") return "green" as const
  if (status === "RETIRED") return "grey" as const
  return "orange" as const
}

const isoFromLocal = (value: string) => new Date(value).toISOString()

const sourceHostname = (sourceUrl: string) => {
  try {
    return new URL(sourceUrl).hostname
  } catch {
    return sourceUrl
  }
}

const sourceTypeTranslationKey = (
  sourceType: KnowledgeSource["source_type"]
) => {
  if (sourceType === "GOOGLE_DOC") return "googleDoc"
  if (sourceType === "GOOGLE_SHEET") return "googleSheet"
  return "googleDrive"
}

const SourceProgress = ({
  label,
  progress,
  stage,
}: SourceProcessingState & { label: string }) => (
  <div className="mt-3 max-w-xl">
    <div className="mb-1 flex items-center justify-between gap-3">
      <Text className="text-ui-fg-subtle" size="xsmall">
        {label}
      </Text>
      <Text className="text-ui-fg-muted" size="xsmall">
        {progress}%
      </Text>
    </div>
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={progress}
      className="h-1.5 overflow-hidden rounded-full bg-ui-bg-component-pressed"
      role="progressbar"
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${
          stage === "failed" ? "bg-ui-fg-error" : "bg-ui-fg-interactive"
        }`}
        style={{ width: `${progress}%` }}
      />
    </div>
  </div>
)

const KnowledgeHubPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [createOpen, setCreateOpen] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<
    "ai" | "channels" | "conversations" | "documents" | "prompts" | "search" | "sources"
  >("conversations")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchLocale, setSearchLocale] = useState("vi")
  const [pickerLoading, setPickerLoading] = useState(false)
  const [sourceProcessing, setSourceProcessing] =
    useState<SourceProcessingState | null>(null)
  const [unsupportedGoogleFile, setUnsupportedGoogleFile] = useState<
    Extract<GooglePickerSelection, { supported: false }> | undefined
  >()
  const [selectedGoogleFiles, setSelectedGoogleFiles] = useState<
    SupportedGooglePickerSelection[]
  >([])
  const [batchFailures, setBatchFailures] = useState<
    Array<Pick<BatchSourceOutcome, "error" | "selection">>
  >([])
  const [form, setForm] = useState({
    citation_locator: "policy://customer-support/",
    content: "",
    document_key: "",
    effective_at: new Date().toISOString().slice(0, 16),
    locale: "vi",
    title: "",
    version: "1.0.0",
  })
  const [sourceForm, setSourceForm] = useState({
    locale: "vi",
    name: "",
    source_type: "GOOGLE_DRIVE" as KnowledgeSource["source_type"],
    source_url: "",
  })

  const documents = useQuery({
    queryFn: () =>
      sdk.client.fetch<KnowledgeListResponse>(
        "/admin/agent-operations/knowledge"
      ),
    queryKey: ["knowledge-documents"],
  })
  const detail = useQuery({
    enabled: Boolean(selectedId),
    queryFn: () =>
      sdk.client.fetch<KnowledgeDetailResponse>(
        `/admin/agent-operations/knowledge/${selectedId}`
      ),
    queryKey: ["knowledge-document", selectedId],
  })
  const sources = useQuery({
    queryFn: () =>
      sdk.client.fetch<KnowledgeSourceListResponse>(
        "/admin/agent-operations/knowledge/sources"
      ),
    queryKey: ["knowledge-sources"],
  })
  const googleConnector = useQuery({
    queryFn: () =>
      sdk.client.fetch<GoogleConnectorStatus>(
        "/admin/agent-operations/knowledge/sources/google-status"
      ),
    queryKey: ["knowledge-google-connector-status"],
  })
  const visibleDocuments = useMemo(
    () =>
      (documents.data?.documents ?? []).filter(
        (document) => !isKnowledgeVerificationArtifact(document)
      ),
    [documents.data?.documents]
  )
  const visibleSources = useMemo(
    () =>
      (sources.data?.sources ?? []).filter(
        (source) => !source.owner_id.endsWith("-verifier")
      ),
    [sources.data?.sources]
  )
  const detailSource = useMemo(
    () =>
      detail.data
        ? findKnowledgeDocumentSource(detail.data.document, visibleSources)
        : undefined,
    [detail.data, visibleSources]
  )
  const filteredDocuments = useMemo(
    () => visibleDocuments.filter((document) => document.status === "APPROVED"),
    [visibleDocuments]
  )
  const sourcePipelineBusy = Boolean(
    sourceProcessing &&
    sourceProcessing.stage !== "failed" &&
    sourceProcessing.stage !== "ready"
  )

  useEffect(() => {
    if (activeView !== "documents") return
    if (!filteredDocuments.some((document) => document.id === selectedId)) {
      setSelectedId(filteredDocuments[0]?.id ?? null)
    }
  }, [activeView, filteredDocuments, selectedId])

  useEffect(() => {
    const url = new URL(window.location.href)
    const googleResult = url.searchParams.get("google")
    if (!googleResult) return
    if (googleResult === "connected") {
      toast.success(t("knowledgeHub.sources.oauth.connectedMessage"))
      queryClient.invalidateQueries({
        queryKey: ["knowledge-google-connector-status"],
      })
    } else if (googleResult === "cancelled") {
      toast.info(t("knowledgeHub.sources.oauth.cancelledMessage"))
    }
    url.searchParams.delete("google")
    window.history.replaceState({}, "", url.toString())
  }, [queryClient, t])

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] })
    await queryClient.invalidateQueries({ queryKey: ["knowledge-document"] })
  }
  const refreshSources = async () => {
    await queryClient.invalidateQueries({ queryKey: ["knowledge-sources"] })
  }
  const runSourcePipeline = async (
    sourceId: string,
    progressRange = { end: 100, start: 0 }
  ) => {
    const progressAt = (percentage: number) =>
      Math.round(
        progressRange.start +
          (progressRange.end - progressRange.start) * percentage
      )
    setSourceProcessing({
      progress: progressAt(0.35),
      source_id: sourceId,
      stage: "syncing",
    })
    const syncResult = await sdk.client.fetch<KnowledgeSourceSyncResponse>(
      `/admin/agent-operations/knowledge/sources/${sourceId}/sync`,
      { method: "POST" }
    )

    setSourceProcessing({
      progress: progressAt(0.7),
      source_id: sourceId,
      stage: "embedding",
    })
    const prepareResult =
      await sdk.client.fetch<KnowledgeSourcePrepareResponse>(
        `/admin/agent-operations/knowledge/sources/${sourceId}/prepare`,
        { method: "POST" }
      )
    if (prepareResult.rag_index.status !== "INDEXED") {
      throw new Error(
        prepareResult.rag_index.error ?? "Knowledge embedding failed."
      )
    }

    setSourceProcessing({
      progress: progressRange.end,
      source_id: sourceId,
      stage: "ready",
    })
    return { prepareResult, syncResult }
  }
  const createDocument = useMutation({
    mutationFn: async () => {
      const documentKey = `manual-${Date.now()}`
      const creation = await sdk.client.fetch<KnowledgeCreateResponse>(
        "/admin/agent-operations/knowledge",
        {
          body: {
            ...form,
          citation_locator: `manual://knowledge/${documentKey}`,
          document_key: documentKey,
          effective_at: isoFromLocal(form.effective_at),
            tenant_id: "default",
            version: "1.0.0",
          },
          method: "POST",
        }
      )
      const approval = await sdk.client.fetch<KnowledgeApprovalResponse>(
        `/admin/agent-operations/knowledge/${creation.document.id}/approve`,
        { method: "POST" }
      )
      return { approval, document: creation.document }
    },
    onError: () => toast.error(t("knowledgeHub.messages.actionError")),
    onSuccess: async (result) => {
      setCreateOpen(false)
      setSelectedId(result.document.id)
      await refresh()
      if (result.approval.rag_index.status === "INDEXED") {
        toast.success(
          t("knowledgeHub.messages.approvedIndexed", {
            chunks: result.approval.rag_index.indexed_chunks,
          })
        )
        return
      }
      toast.error(
        t("knowledgeHub.messages.approvedIndexWarning", {
          status: result.approval.rag_index.status,
        })
      )
    },
  })
  const retireDocument = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/agent-operations/knowledge/${id}/retire`, {
        body: { reason: t("knowledgeHub.retireReason") },
        method: "POST",
      }),
    onError: () => toast.error(t("knowledgeHub.messages.actionError")),
    onSuccess: async () => {
      await refresh()
      toast.success(t("knowledgeHub.messages.retired"))
    },
  })
  const search = useMutation({
    mutationFn: () =>
      sdk.client.fetch<KnowledgeSearchResponse>(
        "/admin/agent-operations/knowledge/search",
        {
          body: {
            limit: 5,
            locale: searchLocale,
            query: searchQuery,
            tenant_id: "default",
          },
          method: "POST",
        }
      ),
    onError: () => toast.error(t("knowledgeHub.messages.searchError")),
  })
  const createSource = useMutation({
    mutationFn: async () => {
      const selections = [...selectedGoogleFiles]
      if (!selections.length) {
        throw new Error("Select at least one Google Drive document.")
      }

      const outcomes: BatchSourceOutcome[] = []
      for (const [index, selection] of selections.entries()) {
        let sourceCreated = false
        const start = Math.round((index / selections.length) * 100)
        const end = Math.round(((index + 1) / selections.length) * 100)
        setSourceProcessing({
          progress: Math.round(start + (end - start) * 0.1),
          source_id: null,
          stage: "connecting",
        })
        try {
          const created = await sdk.client.fetch<{
            duplicate: boolean
            source: KnowledgeSource
          }>("/admin/agent-operations/knowledge/sources", {
            body: {
              ...sourceForm,
              name: selection.name,
              source_type: selection.source_type,
              source_url: selection.source_url,
              tenant_id: "default",
            },
            method: "POST",
          })
          sourceCreated = true
          await refreshSources()
          await runSourcePipeline(created.source.id, { end, start })
          outcomes.push({ selection, source_created: true })
        } catch (error) {
          outcomes.push({
            error:
              error instanceof Error
                ? error.message
                : "Knowledge source processing failed.",
            selection,
            source_created: sourceCreated,
          })
        }
      }
      return outcomes
    },
    onError: async () => {
      setSourceProcessing((current) => ({
        progress: current?.progress ?? 10,
        source_id: current?.source_id ?? null,
        stage: "failed",
      }))
      await Promise.all([refreshSources(), refresh()])
      toast.error(t("knowledgeHub.sources.messages.processingError"))
    },
    onSuccess: async (outcomes) => {
      const failures = outcomes.filter((outcome) => outcome.error)
      setBatchFailures(failures)
      setSelectedGoogleFiles(
        failures
          .filter((outcome) => !outcome.source_created)
          .map((outcome) => outcome.selection)
      )
      await Promise.all([refreshSources(), refresh()])
      if (failures.length) {
        toast.error(
          t("knowledgeHub.sources.messages.batchPartial", {
            failed: failures.length,
            processed: outcomes.length - failures.length,
          })
        )
        return
      }
      setSourceProcessing(null)
      setSourceOpen(false)
      setSourceForm({
        locale: "vi",
        name: "",
        source_type: "GOOGLE_DRIVE",
        source_url: "",
      })
      setSelectedGoogleFiles([])
      setUnsupportedGoogleFile(undefined)
      toast.success(
        t("knowledgeHub.sources.messages.batchPrepared", {
          count: outcomes.length,
        })
      )
    },
  })
  const syncSource = useMutation({
    mutationFn: runSourcePipeline,
    onError: async () => {
      setSourceProcessing((current) => ({
        progress: current?.progress ?? 35,
        source_id: current?.source_id ?? null,
        stage: "failed",
      }))
      await refreshSources()
      toast.error(t("knowledgeHub.sources.messages.syncError"))
    },
    onSuccess: async ({ prepareResult, syncResult }) => {
      await Promise.all([refreshSources(), refresh()])
      setSourceProcessing(null)
      toast.success(
        t(
          syncResult.status === "UNCHANGED"
            ? "knowledgeHub.sources.messages.unchanged"
            : "knowledgeHub.sources.messages.prepared",
          { chunks: prepareResult.rag_index.indexed_chunks }
        )
      )
    },
  })
  const deleteSource = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<{
        chunk_count: number
        deleted: true
        document_count: number
        source_id: string
      }>(`/admin/agent-operations/knowledge/sources/${id}`, {
        method: "DELETE",
      }),
    onError: () => toast.error(t("knowledgeHub.sources.messages.deleteError")),
    onSuccess: async (result) => {
      await Promise.all([refreshSources(), refresh()])
      toast.success(
        t("knowledgeHub.sources.messages.deleted", {
          chunks: result.chunk_count,
          documents: result.document_count,
        })
      )
    },
  })
  const authorizeGoogle = useMutation({
    mutationFn: () =>
      sdk.client.fetch<GoogleAuthorizationResponse>(
        "/admin/agent-operations/knowledge/sources/google-oauth/authorize",
        { method: "POST" }
      ),
    onError: () => toast.error(t("knowledgeHub.sources.oauth.connectError")),
    onSuccess: ({ authorization_url }) => {
      window.location.assign(authorization_url)
    },
  })
  const disconnectGoogle = useMutation({
    mutationFn: () =>
      sdk.client.fetch(
        "/admin/agent-operations/knowledge/sources/google-oauth/disconnect",
        { method: "POST" }
      ),
    onError: () => toast.error(t("knowledgeHub.sources.oauth.disconnectError")),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["knowledge-google-connector-status"],
      })
      toast.success(t("knowledgeHub.sources.oauth.disconnectedMessage"))
    },
  })

  const confirmDisconnectGoogle = async () => {
    const confirmed = await prompt({
      cancelText: t("knowledgeHub.cancel"),
      confirmText: t("knowledgeHub.sources.oauth.disconnectAction"),
      description: t("knowledgeHub.sources.oauth.disconnectConfirmation"),
      title: t("knowledgeHub.sources.oauth.disconnectTitle"),
      variant: "danger",
    })
    if (confirmed) disconnectGoogle.mutate()
  }

  const confirmDeleteSource = async (source: KnowledgeSource) => {
    const confirmed = await prompt({
      cancelText: t("knowledgeHub.cancel"),
      confirmText: t("knowledgeHub.sources.deleteAction"),
      description: t("knowledgeHub.sources.deleteConfirmation", {
        name: source.name,
      }),
      title: t("knowledgeHub.sources.deleteTitle"),
      variant: "danger",
    })
    if (confirmed) deleteSource.mutate(source.id)
  }

  const chooseGoogleDocument = async () => {
    setPickerLoading(true)
    let shouldReopenSourceDrawer = false
    try {
      const credential = await sdk.client.fetch<GooglePickerCredential>(
        "/admin/agent-operations/knowledge/sources/google-oauth/picker-token",
        { method: "POST" }
      )

      // Google Picker renders its own top-level modal. Fully close the Radix
      // Drawer first so its focus and pointer lock cannot block Picker's iframe.
      shouldReopenSourceDrawer = true
      setSourceOpen(false)
      await new Promise<void>((resolve) => window.setTimeout(resolve, 220))

      const selections = await openGoogleKnowledgePicker(credential)
      if (!selections) return
      const unsupported = selections.find((selection) => !selection.supported)
      const supported = selections.filter(
        (selection): selection is SupportedGooglePickerSelection =>
          selection.supported
      )
      setUnsupportedGoogleFile(unsupported)
      setSelectedGoogleFiles(supported)
      setBatchFailures([])
    } catch {
      toast.error(t("knowledgeHub.sources.oauth.pickerError"))
    } finally {
      if (shouldReopenSourceDrawer) setSourceOpen(true)
      setPickerLoading(false)
    }
  }
  const submitCreate = (event: FormEvent) => {
    event.preventDefault()
    createDocument.mutate()
  }

  const submitSource = (event: FormEvent) => {
    event.preventDefault()
    createSource.mutate()
  }

  const openSourceConnection = () => {
    setSourceProcessing(null)
    setUnsupportedGoogleFile(undefined)
    setSelectedGoogleFiles([])
    setBatchFailures([])
    setSourceForm({
      locale: "vi",
      name: "",
      source_type: "GOOGLE_DRIVE",
      source_url: "",
    })
    setSourceOpen(true)
  }

  const closeSourceConnection = () => {
    setSourceOpen(false)
    if (createSource.isPending) {
      toast.info(t("knowledgeHub.sources.messages.processingInBackground"))
    }
  }

  const openSourceDocument = (source: KnowledgeSource) => {
    if (!source.last_document_id) return
    setSelectedId(source.last_document_id)
    setActiveView("documents")
  }

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="p-0">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <Heading level="h1">{t("knowledgeHub.title")}</Heading>
          {activeView === "documents" && (
            <Button size="small" onClick={() => setCreateOpen(true)}>
              {t("knowledgeHub.createAction")}
            </Button>
          )}
          {activeView === "sources" && (
            <Button
              disabled={createSource.isPending || sourcePipelineBusy}
              onClick={openSourceConnection}
              size="small"
            >
              {t("knowledgeHub.sources.connectAction")}
            </Button>
          )}
        </div>
        <div className="flex gap-1 border-t px-4 py-2">
          {(
            [
              "conversations",
              "documents",
              "sources",
              "search",
              "channels",
              "prompts",
              "ai",
            ] as const
          ).map((view) => (
            <Button
              key={view}
              onClick={() => setActiveView(view)}
              size="small"
              variant={activeView === view ? "secondary" : "transparent"}
            >
              {t(`knowledgeHub.views.${view}`)}
            </Button>
          ))}
        </div>
      </Container>

      {activeView === "conversations" && <CustomerSupportContent embedded />}

      {activeView === "channels" && <ChatChannelsContent embedded />}

      {activeView === "prompts" && <PromptsConfigContent />}

      {activeView === "ai" && <AiConnectionsContent embedded />}

      {activeView === "documents" && (
        <Container className="p-0">
          <div className="border-b px-6 py-3">
            <Text leading="compact" size="small" weight="plus">
              {t("knowledgeHub.status.approved")} · {filteredDocuments.length}
            </Text>
          </div>
          <div className="grid min-h-[520px] grid-cols-1 lg:grid-cols-[320px_1fr]">
            <div className="border-b lg:border-b-0 lg:border-r">
              {documents.isLoading && (
                <Text className="px-6 py-6 text-ui-fg-subtle" size="small">
                  {t("knowledgeHub.loading")}
                </Text>
              )}
              {documents.isError && !documents.data && (
                <div className="flex flex-col items-start gap-3 px-6 py-6">
                  <Text className="text-ui-fg-error" size="small">
                    {t("knowledgeHub.listError")}
                  </Text>
                  <Button
                    onClick={() => void documents.refetch()}
                    size="small"
                    variant="secondary"
                  >
                    {t("knowledgeHub.retryAction")}
                  </Button>
                </div>
              )}
              {filteredDocuments.map((document) => (
                <button
                  className={`w-full border-b px-6 py-4 text-left transition-colors hover:bg-ui-bg-subtle-hover ${
                    selectedId === document.id ? "bg-ui-bg-subtle" : ""
                  }`}
                  key={document.id}
                  onClick={() => setSelectedId(document.id)}
                  type="button"
                >
                  <Text leading="compact" size="small" weight="plus">
                    {document.title}
                  </Text>
                  <Text
                    className="mt-1 text-ui-fg-subtle"
                    leading="compact"
                    size="small"
                  >
                    {t(
                      `knowledgeHub.scopes.${
                        document.scope === "customer_support"
                          ? "customerSupport"
                          : document.scope
                      }`
                    )}
                  </Text>
                </button>
              ))}
              {!documents.isLoading && !documents.isError && !filteredDocuments.length && (
                <Text className="px-6 py-8 text-ui-fg-subtle" size="small">
                  {t("knowledgeHub.emptyStatus.approved")}
                </Text>
              )}
            </div>

            <div className="px-6 py-6">
              {!selectedId ? (
                <Text className="text-ui-fg-subtle" size="small">
                  {t("knowledgeHub.selectDocument")}
                </Text>
              ) : detail.isLoading ? (
                <Text className="text-ui-fg-subtle" size="small">
                  {t("knowledgeHub.loading")}
                </Text>
              ) : detail.isError ? (
                <div className="flex max-w-lg flex-col items-start gap-3 rounded-lg border border-ui-border-error bg-ui-bg-base px-5 py-5">
                  <Text className="text-ui-fg-error" size="small">
                    {t("knowledgeHub.detailError")}
                  </Text>
                  <Button
                    onClick={() => detail.refetch()}
                    size="small"
                    variant="secondary"
                  >
                    {t("knowledgeHub.retryAction")}
                  </Button>
                </div>
              ) : detail.data ? (
                <div className="mx-auto flex max-w-3xl flex-col gap-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-2">
                      <StatusBadge
                        color={statusColor(detail.data.document.status)}
                      >
                        {t(
                          `knowledgeHub.status.${detail.data.document.status.toLowerCase()}`
                        )}
                      </StatusBadge>
                      <Heading level="h2">{detail.data.document.title}</Heading>
                      <Text className="text-ui-fg-subtle" size="small">
                        {t("knowledgeHub.usedFor", {
                          language: t(
                            `knowledgeHub.languages.${detail.data.document.locale}`
                          ),
                          scope: t(
                            `knowledgeHub.scopes.${
                              detail.data.document.scope === "customer_support"
                                ? "customerSupport"
                                : detail.data.document.scope
                            }`
                          ),
                        })}
                      </Text>
                      <Text className="text-ui-fg-muted" size="xsmall">
                        {t("knowledgeHub.detailSummary", {
                          chunks: detail.data.chunks.length,
                          version: detail.data.document.version,
                        })}
                      </Text>
                    </div>
                    {detail.data.document.status === "APPROVED" && (
                      <Button
                        isLoading={retireDocument.isPending}
                        onClick={() => retireDocument.mutate(selectedId)}
                        size="small"
                        variant="secondary"
                      >
                        {t("knowledgeHub.retireAction")}
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-ui-border-base bg-ui-bg-base px-4 py-4">
                      <Text size="small" weight="plus">
                        {t("knowledgeHub.source")}
                      </Text>
                      <Text className="mt-2" size="small">
                        {detailSource
                          ? t("knowledgeHub.sourceConnected", {
                              name: detailSource.name,
                            })
                          : t("knowledgeHub.sourceManual")}
                      </Text>
                      <Text
                        className="mt-1 break-all text-ui-fg-muted"
                        size="xsmall"
                      >
                        {detail.data.document.citation_locator}
                      </Text>
                    </div>
                    <div className="rounded-lg border border-ui-border-base bg-ui-bg-base px-4 py-4">
                      <Text size="small" weight="plus">
                        {t("knowledgeHub.knowledgeStatus")}
                      </Text>
                      <div className="mt-2">
                        <StatusBadge
                          color={statusColor(detail.data.document.status)}
                        >
                          {t(
                            `knowledgeHub.knowledgeAvailability.${detail.data.document.status.toLowerCase()}`
                          )}
                        </StatusBadge>
                      </div>
                      <Text className="mt-2 text-ui-fg-muted" size="xsmall">
                        {t(
                          `knowledgeHub.knowledgeAvailabilityHint.${detail.data.document.status.toLowerCase()}`
                        )}
                      </Text>
                    </div>
                  </div>
                  <div className="rounded-lg bg-ui-bg-subtle px-5 py-5">
                    <Text leading="compact" size="small" weight="plus">
                      {t("knowledgeHub.guidanceContent")}
                    </Text>
                    <Text className="mt-3 whitespace-pre-wrap" size="small">
                      {detail.data.document.content}
                    </Text>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Text size="small" weight="plus">
                      {t("knowledgeHub.searchableSections")}
                    </Text>
                    {detail.data.chunks.map((chunk) => (
                      <div
                        className="rounded-lg border border-ui-border-base bg-ui-bg-base px-4 py-4"
                        key={chunk.id}
                      >
                        <Text className="text-ui-fg-muted" size="xsmall">
                          {t("knowledgeHub.sectionMeta", {
                            number: chunk.chunk_index + 1,
                            words: chunk.word_count,
                          })}
                        </Text>
                        <Text className="mt-2 whitespace-pre-wrap" size="small">
                          {chunk.content}
                        </Text>
                        <Text
                          className="mt-2 break-all text-ui-fg-muted"
                          size="xsmall"
                        >
                          {chunk.citation_locator}
                        </Text>
                      </div>
                    ))}
                    {!detail.data.chunks.length && (
                      <Text className="text-ui-fg-error" size="small">
                        {t("knowledgeHub.noSearchableSections")}
                      </Text>
                    )}
                  </div>
                  <Text className="text-ui-fg-muted" size="xsmall">
                    {t("knowledgeHub.approvalExplanation")}
                  </Text>
                </div>
              ) : null}
            </div>
          </div>
        </Container>
      )}

      {activeView === "sources" && (
        <div className="flex flex-col gap-3">
          <Container className="p-0">
            <div className="flex flex-col justify-between gap-4 px-6 py-5 md:flex-row md:items-center">
              <div className="flex items-start gap-3">
                <StatusBadge
                  color={googleConnector.data?.connected ? "green" : "orange"}
                >
                  {googleConnector.data?.connected
                    ? t("knowledgeHub.sources.oauth.connected")
                    : t("knowledgeHub.sources.oauth.notConnected")}
                </StatusBadge>
                <div>
                  <Text leading="compact" size="small" weight="plus">
                    Google Drive
                  </Text>
                  <Text className="text-ui-fg-subtle" size="small">
                    {googleConnector.data?.connected
                      ? t("knowledgeHub.sources.oauth.connectedAs", {
                          email: googleConnector.data.account_email,
                        })
                      : googleConnector.data?.platform_ready
                        ? t("knowledgeHub.sources.oauth.connectHint")
                        : t("knowledgeHub.sources.oauth.platformNotReady")}
                  </Text>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {googleConnector.data?.connected && (
                  <Button
                    disabled={disconnectGoogle.isPending}
                    isLoading={disconnectGoogle.isPending}
                    onClick={confirmDisconnectGoogle}
                    size="small"
                    variant="secondary"
                  >
                    {t("knowledgeHub.sources.oauth.disconnectAction")}
                  </Button>
                )}
                <Button
                  disabled={
                    authorizeGoogle.isPending ||
                    !googleConnector.data?.platform_ready
                  }
                  isLoading={authorizeGoogle.isPending}
                  onClick={() => authorizeGoogle.mutate()}
                  size="small"
                >
                  {googleConnector.data?.connected
                    ? t("knowledgeHub.sources.oauth.changeAccountAction")
                    : t("knowledgeHub.sources.oauth.connectAction")}
                </Button>
              </div>
            </div>
            {googleConnector.isError && !googleConnector.data && (
              <div className="flex flex-wrap items-center gap-3 border-t px-6 py-4">
                <Text className="text-ui-fg-error" size="small">
                  {t("knowledgeHub.sources.connectorLoadError")}
                </Text>
                <Button
                  onClick={() => void googleConnector.refetch()}
                  size="small"
                  variant="secondary"
                >
                  {t("knowledgeHub.retryAction")}
                </Button>
              </div>
            )}
          </Container>
          <Container className="p-0">
            <div className="border-b px-6 py-4">
              <Text leading="compact" size="small" weight="plus">
                {t("knowledgeHub.sources.title")}
              </Text>
              <Text
                className="text-ui-fg-subtle"
                leading="compact"
                size="small"
              >
                {t("knowledgeHub.sources.simpleSubtitle")}
              </Text>
            </div>
            {sources.isLoading ? (
              <Text className="px-6 py-8 text-ui-fg-subtle" size="small">
                {t("knowledgeHub.sources.loading")}
              </Text>
            ) : sources.isError && !sources.data ? (
              <div className="flex flex-col items-start gap-3 px-6 py-8">
                <Text className="text-ui-fg-error" size="small">
                  {t("knowledgeHub.sources.listError")}
                </Text>
                <Button
                  onClick={() => void sources.refetch()}
                  size="small"
                  variant="secondary"
                >
                  {t("knowledgeHub.retryAction")}
                </Button>
              </div>
            ) : !visibleSources.length ? (
              <Text className="px-6 py-8 text-ui-fg-subtle" size="small">
                {t("knowledgeHub.sources.empty")}
              </Text>
            ) : (
              <div className="divide-y">
                {visibleSources.map((source) => (
                  <div
                    className="flex items-center justify-between gap-4 px-6 py-5"
                    key={source.id}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Text leading="compact" size="small" weight="plus">
                          {source.name}
                        </Text>
                        <StatusBadge
                          color={
                            source.last_sync_status === "FAILED"
                              ? "red"
                              : source.last_sync_status === "SUCCEEDED"
                                ? "green"
                                : source.last_sync_status === "UNCHANGED"
                                  ? "blue"
                                  : "orange"
                          }
                        >
                          {t(
                            `knowledgeHub.sources.status.${source.last_sync_status.toLowerCase()}`
                          )}
                        </StatusBadge>
                      </div>
                      <Text className="mt-1 text-ui-fg-subtle" size="small">
                        {t(
                          `knowledgeHub.sources.types.${sourceTypeTranslationKey(source.source_type)}`
                        )}{" "}
                        · {sourceHostname(source.source_url)}
                      </Text>
                      <Text className="text-ui-fg-muted" size="xsmall">
                        {t(
                          `knowledgeHub.scopes.${
                            source.scope === "customer_support"
                              ? "customerSupport"
                              : source.scope
                          }`
                        )}{" "}
                        · {t(`knowledgeHub.languages.${source.locale}`)}
                      </Text>
                      {source.last_error && (
                        <Text className="mt-1 text-ui-fg-error" size="small">
                          {t("knowledgeHub.sources.connectionErrorHint")}
                        </Text>
                      )}
                      {sourcePipelineBusy &&
                        sourceProcessing?.source_id === source.id && (
                        <SourceProgress
                          {...sourceProcessing}
                          label={t(
                            `knowledgeHub.sources.processing.${sourceProcessing.stage}`
                          )}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {source.last_document_id &&
                        source.last_sync_status !== "FAILED" && (
                          <Button
                            disabled={sourcePipelineBusy}
                            onClick={() => openSourceDocument(source)}
                            size="small"
                            variant="secondary"
                          >
                            {t("knowledgeHub.sources.openDocumentAction")}
                          </Button>
                        )}
                      <Button
                        disabled={sourcePipelineBusy || deleteSource.isPending}
                        isLoading={
                          syncSource.isPending &&
                          syncSource.variables === source.id
                        }
                        onClick={() => syncSource.mutate(source.id)}
                        size="small"
                        variant="secondary"
                      >
                        {t("knowledgeHub.sources.syncAction")}
                      </Button>
                      <Button
                        disabled={sourcePipelineBusy || deleteSource.isPending}
                        isLoading={
                          deleteSource.isPending &&
                          deleteSource.variables === source.id
                        }
                        onClick={() => confirmDeleteSource(source)}
                        size="small"
                        variant="danger"
                      >
                        {t("knowledgeHub.sources.deleteAction")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Container>
        </div>
      )}

      {activeView === "search" && (
        <Container className="flex flex-col gap-5 px-6 py-6">
          <div className="max-w-2xl">
            <Heading level="h2">{t("knowledgeHub.testSearch")}</Heading>
            <Text className="text-ui-fg-subtle" size="small">
              {t("knowledgeHub.testSearchHint")}
            </Text>
          </div>
          <div className="grid max-w-3xl grid-cols-1 gap-3 md:grid-cols-[1fr_140px_auto]">
            <Input
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("knowledgeHub.searchPlaceholder")}
              value={searchQuery}
            />
            <Select onValueChange={setSearchLocale} value={searchLocale}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="vi">Tiếng Việt</Select.Item>
                <Select.Item value="en">English</Select.Item>
              </Select.Content>
            </Select>
            <Button
              disabled={searchQuery.trim().length < 2}
              isLoading={search.isPending}
              onClick={() => search.mutate()}
              size="small"
            >
              {t("knowledgeHub.searchAction")}
            </Button>
          </div>
          <div className="flex max-w-4xl flex-col gap-3">
            {search.data?.results.map((result) => (
              <div
                className="rounded-lg bg-ui-bg-subtle px-5 py-4"
                key={`${result.document_id}-${result.citation_locator}`}
              >
                <Text leading="compact" size="small" weight="plus">
                  {result.title}
                </Text>
                <Text className="mt-2" size="small">
                  {result.excerpt}
                </Text>
              </div>
            ))}
            {search.isSuccess && !search.data.results.length && (
              <Text className="text-ui-fg-subtle" size="small">
                {t("knowledgeHub.noMatch")}
              </Text>
            )}
          </div>
        </Container>
      )}

      <Drawer open={createOpen} onOpenChange={setCreateOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{t("knowledgeHub.createTitle")}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="overflow-y-auto">
            <form
              className="flex flex-col gap-5"
              id="knowledge-create-form"
              onSubmit={submitCreate}
            >
              <Text className="text-ui-fg-subtle" size="small">
                {t("knowledgeHub.createHint")}
              </Text>
              <div className="flex flex-col gap-2">
                <Label htmlFor="title">{t("knowledgeHub.fields.title")}</Label>
                <Input
                  id="title"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  required
                  value={form.title}
                />
              </div>
              <div className="max-w-48">
                <div className="flex flex-col gap-2">
                  <Label>{t("knowledgeHub.fields.language")}</Label>
                  <Select
                    onValueChange={(locale) =>
                      setForm((current) => ({ ...current, locale }))
                    }
                    value={form.locale}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="vi">Tiếng Việt</Select.Item>
                      <Select.Item value="en">English</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="content">
                  {t("knowledgeHub.fields.content")}
                </Label>
                <Textarea
                  className="min-h-52"
                  id="content"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      content: event.target.value,
                    }))
                  }
                  required
                  value={form.content}
                />
                <Text className="text-ui-fg-subtle" size="xsmall">
                  {t("knowledgeHub.fields.contentHint")}
                </Text>
              </div>
            </form>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex w-full items-center justify-end gap-2">
              <Button
                disabled={createDocument.isPending}
                onClick={() => setCreateOpen(false)}
                size="small"
                variant="secondary"
              >
                {t("knowledgeHub.cancel")}
              </Button>
              <Button
                form="knowledge-create-form"
                isLoading={createDocument.isPending}
                size="small"
                type="submit"
              >
                {t("knowledgeHub.saveDraft")}
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      <Drawer
        open={sourceOpen}
        onOpenChange={(open) => {
          if (open) setSourceOpen(true)
          else closeSourceConnection()
        }}
      >
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{t("knowledgeHub.sources.createTitle")}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="overflow-y-auto">
            <form
              className="flex flex-col gap-5"
              id="knowledge-source-form"
              onSubmit={submitSource}
            >
              <Text className="text-ui-fg-subtle" size="small">
                {t("knowledgeHub.sources.createHint")}
              </Text>
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border bg-ui-bg-subtle p-4">
                  <Text weight="plus">
                    {t("knowledgeHub.sources.automatic.supportedTitle")}
                  </Text>
                  <Text className="mt-1 text-ui-fg-subtle" size="small">
                    {t("knowledgeHub.sources.automatic.supportedHint")}
                  </Text>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      "Google Docs",
                      "Google Sheets",
                      "DOCX",
                      "TXT",
                      "Markdown",
                      "CSV",
                    ].map((type) => (
                      <span
                        className="rounded-md border bg-ui-bg-base px-2 py-1 text-ui-fg-subtle txt-compact-small"
                        key={type}
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>

                {unsupportedGoogleFile && (
                  <div className="rounded-lg border border-ui-border-error bg-ui-bg-subtle p-4">
                    <Text className="text-ui-fg-error" weight="plus">
                      {t("knowledgeHub.sources.automatic.unsupportedTitle")}
                    </Text>
                    <Text className="mt-1 text-ui-fg-subtle" size="small">
                      {t("knowledgeHub.sources.automatic.unsupportedHint", {
                        name: unsupportedGoogleFile.name,
                      })}
                    </Text>
                  </div>
                )}

                {selectedGoogleFiles.length ? (
                  <div className="rounded-lg border border-ui-border-interactive bg-ui-bg-base p-4">
                    <Text className="text-ui-fg-subtle" size="xsmall">
                      {t("knowledgeHub.sources.automatic.selectedTitle")}
                    </Text>
                    <Text className="mt-1" size="small" weight="plus">
                      {t("knowledgeHub.sources.automatic.selectedCount", {
                        count: selectedGoogleFiles.length,
                      })}
                    </Text>
                    <div className="mt-3 flex flex-col gap-2">
                      {selectedGoogleFiles.map((selection) => (
                        <div
                          className="rounded-md bg-ui-bg-subtle px-3 py-2"
                          key={selection.source_url}
                        >
                          <Text size="small" weight="plus">
                            {selection.name}
                          </Text>
                          <Text className="text-ui-fg-subtle" size="xsmall">
                            {t(
                              `knowledgeHub.sources.types.${sourceTypeTranslationKey(selection.source_type)}`
                            )}
                          </Text>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Text className="text-ui-fg-subtle" size="small">
                    {t("knowledgeHub.sources.automatic.noSelection")}
                  </Text>
                )}

                {!!batchFailures.length && (
                  <div className="rounded-lg border border-ui-border-error bg-ui-bg-subtle p-4">
                    <Text className="text-ui-fg-error" size="small" weight="plus">
                      {t("knowledgeHub.sources.automatic.failedTitle")}
                    </Text>
                    <div className="mt-2 flex flex-col gap-1">
                      {batchFailures.map((failure) => (
                        <Text key={failure.selection.source_url} size="small">
                          {failure.selection.name}
                        </Text>
                      ))}
                    </div>
                  </div>
                )}

                  {sourceProcessing &&
                    (createSource.isPending ||
                      sourceProcessing.stage === "failed") && (
                  <SourceProgress
                    {...sourceProcessing}
                    label={t(
                      `knowledgeHub.sources.processing.${sourceProcessing.stage}`
                    )}
                  />
                )}

                <Button
                  disabled={
                    createSource.isPending || !googleConnector.data?.connected
                  }
                  isLoading={pickerLoading}
                  onClick={chooseGoogleDocument}
                  type="button"
                >
                  {selectedGoogleFiles.length
                    ? t("knowledgeHub.sources.automatic.changeFileAction")
                    : t("knowledgeHub.sources.oauth.chooseFileAction")}
                </Button>
              </div>
              <div className="max-w-48">
                <div className="flex flex-col gap-2">
                  <Label>{t("knowledgeHub.fields.language")}</Label>
                  <Select
                    onValueChange={(locale) =>
                      setSourceForm((current) => ({ ...current, locale }))
                    }
                    value={sourceForm.locale}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="vi">Tiếng Việt</Select.Item>
                      <Select.Item value="en">English</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
              </div>
              <div className="rounded-lg border bg-ui-bg-subtle p-4">
                {googleConnector.data?.connected ? (
                  <>
                    <Text weight="plus">
                      {t("knowledgeHub.sources.googleReadyTitle")}
                    </Text>
                    <Text className="text-ui-fg-subtle" size="small">
                      {t("knowledgeHub.sources.oauth.pickerHint", {
                        email: googleConnector.data.account_email,
                      })}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text className="text-ui-fg-error" weight="plus">
                      {t("knowledgeHub.sources.googleNotReadyTitle")}
                    </Text>
                    <Text className="text-ui-fg-subtle" size="small">
                      {t("knowledgeHub.sources.googleNotReadyHint")}
                    </Text>
                  </>
                )}
              </div>
            </form>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex w-full items-center justify-end gap-2">
              <Button
                onClick={closeSourceConnection}
                size="small"
                variant="secondary"
              >
                {t("knowledgeHub.cancel")}
              </Button>
              <Button
                disabled={
                  createSource.isPending ||
                  !selectedGoogleFiles.length ||
                  !googleConnector.data?.connected
                }
                form="knowledge-source-form"
                isLoading={createSource.isPending}
                size="small"
                type="submit"
              >
                {t("knowledgeHub.sources.saveAction", {
                  count: selectedGoogleFiles.length,
                })}
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "knowledgeHub.navigation",
  translationNs: "translation",
})

export default KnowledgeHubPage
