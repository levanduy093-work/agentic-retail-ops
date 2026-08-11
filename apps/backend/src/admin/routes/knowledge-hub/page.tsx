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
import {
  GooglePickerCredential,
  type GooglePickerSelection,
  openGoogleKnowledgePicker,
} from "./google-picker"

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

const statusColor = (status: KnowledgeDocument["status"]) => {
  if (status === "APPROVED") return "green" as const
  if (status === "RETIRED") return "grey" as const
  return "orange" as const
}

const isoFromLocal = (value: string) => new Date(value).toISOString()

const isVerifierRecord = (ownerId: string) => ownerId.endsWith("-verifier")

const sourceHostname = (sourceUrl: string) => {
  try {
    return new URL(sourceUrl).hostname
  } catch {
    return sourceUrl
  }
}

const sourceTypeTranslationKey = (sourceType: KnowledgeSource["source_type"]) => {
  if (sourceType === "GOOGLE_DOC") return "googleDoc"
  if (sourceType === "GOOGLE_SHEET") return "googleSheet"
  return "googleDrive"
}

const KnowledgeHubPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [createOpen, setCreateOpen] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<
    "documents" | "search" | "sources"
  >("documents")
  const [documentStatus, setDocumentStatus] = useState<
    KnowledgeDocument["status"]
  >("APPROVED")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchLocale, setSearchLocale] = useState("vi")
  const [searchScope, setSearchScope] = useState("customer_support")
  const [pickerLoading, setPickerLoading] = useState(false)
  const [unsupportedGoogleFile, setUnsupportedGoogleFile] = useState<
    Extract<GooglePickerSelection, { supported: false }> | undefined
  >()
  const [form, setForm] = useState({
    citation_locator: "policy://customer-support/",
    content: "",
    document_key: "",
    effective_at: new Date().toISOString().slice(0, 16),
    locale: "vi",
    scope: "customer_support",
    title: "",
    version: "1.0.0",
  })
  const [sourceForm, setSourceForm] = useState({
    locale: "vi",
    name: "",
    scope: "customer_support",
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
        (document) => !isVerifierRecord(document.owner_id)
      ),
    [documents.data?.documents]
  )
  const visibleSources = useMemo(
    () =>
      (sources.data?.sources ?? []).filter(
        (source) => !isVerifierRecord(source.owner_id)
      ),
    [sources.data?.sources]
  )
  const filteredDocuments = useMemo(
    () =>
      visibleDocuments.filter((document) => document.status === documentStatus),
    [documentStatus, visibleDocuments]
  )
  const counts = useMemo(
    () =>
      visibleDocuments.reduce(
        (result, document) => ({
          ...result,
          [document.status]: result[document.status] + 1,
        }),
        { APPROVED: 0, DRAFT: 0, RETIRED: 0 }
      ),
    [visibleDocuments]
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
  const createDocument = useMutation({
    mutationFn: () => {
      const documentKey = `manual-${Date.now()}`
      return sdk.client.fetch("/admin/agent-operations/knowledge", {
        body: {
          ...form,
          citation_locator: `manual://knowledge/${documentKey}`,
          document_key: documentKey,
          effective_at: isoFromLocal(form.effective_at),
          tenant_id: "default",
          version: "1.0.0",
        },
        method: "POST",
      })
    },
    onError: () => toast.error(t("knowledgeHub.messages.actionError")),
    onSuccess: async () => {
      setCreateOpen(false)
      await refresh()
      toast.success(t("knowledgeHub.messages.created"))
    },
  })
  const approveDocument = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/agent-operations/knowledge/${id}/approve`, {
        method: "POST",
      }),
    onError: () => toast.error(t("knowledgeHub.messages.actionError")),
    onSuccess: async () => {
      await refresh()
      toast.success(t("knowledgeHub.messages.approved"))
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
            scope: searchScope,
            tenant_id: "default",
          },
          method: "POST",
        }
      ),
    onError: () => toast.error(t("knowledgeHub.messages.searchError")),
  })
  const createSource = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/agent-operations/knowledge/sources", {
        body: { ...sourceForm, tenant_id: "default" },
        method: "POST",
      }),
    onError: () =>
      toast.error(t("knowledgeHub.sources.messages.createError")),
    onSuccess: async () => {
      setSourceOpen(false)
      setSourceForm({
        locale: "vi",
        name: "",
        scope: "customer_support",
        source_type: "GOOGLE_DRIVE",
        source_url: "",
      })
      setUnsupportedGoogleFile(undefined)
      await refreshSources()
      toast.success(t("knowledgeHub.sources.messages.connected"))
    },
  })
  const syncSource = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<{
        document: KnowledgeDocument | null
        status: "FAILED" | "SUCCEEDED" | "UNCHANGED"
      }>(`/admin/agent-operations/knowledge/sources/${id}/sync`, {
        method: "POST",
      }),
    onError: async () => {
      await refreshSources()
      toast.error(t("knowledgeHub.sources.messages.syncError"))
    },
    onSuccess: async (result) => {
      await Promise.all([refreshSources(), refresh()])
      toast.success(
        t(
          result.status === "UNCHANGED"
            ? "knowledgeHub.sources.messages.unchanged"
            : "knowledgeHub.sources.messages.synced"
        )
      )
    },
  })
  const authorizeGoogle = useMutation({
    mutationFn: () =>
      sdk.client.fetch<GoogleAuthorizationResponse>(
        "/admin/agent-operations/knowledge/sources/google-oauth/authorize",
        { method: "POST" }
      ),
    onError: () =>
      toast.error(t("knowledgeHub.sources.oauth.connectError")),
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
    onError: () =>
      toast.error(t("knowledgeHub.sources.oauth.disconnectError")),
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

      const selection = await openGoogleKnowledgePicker(credential)
      if (!selection) return
      if (!selection.supported) {
        setUnsupportedGoogleFile(selection)
        setSourceForm((current) => ({
          ...current,
          name: "",
          source_type: "GOOGLE_DRIVE",
          source_url: "",
        }))
        return
      }
      setUnsupportedGoogleFile(undefined)
      setSourceForm((current) => ({
        ...current,
        name: selection.name,
        source_type: selection.source_type,
        source_url: selection.source_url,
      }))
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
    setUnsupportedGoogleFile(undefined)
    setSourceForm({
      locale: "vi",
      name: "",
      scope: "customer_support",
      source_type: "GOOGLE_DRIVE",
      source_url: "",
    })
    setSourceOpen(true)
  }

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="p-0">
        <div className="flex items-center justify-between gap-4 px-6 py-5">
          <div className="max-w-2xl">
            <Heading level="h1">{t("knowledgeHub.title")}</Heading>
            <Text className="text-ui-fg-subtle" size="small">
              {t("knowledgeHub.subtitle")}
            </Text>
          </div>
          {activeView === "documents" && (
            <Button size="small" onClick={() => setCreateOpen(true)}>
              {t("knowledgeHub.createAction")}
            </Button>
          )}
          {activeView === "sources" && (
            <Button size="small" onClick={openSourceConnection}>
              {t("knowledgeHub.sources.connectAction")}
            </Button>
          )}
        </div>
        <div className="flex gap-1 border-t px-4 py-2">
          {(["documents", "sources", "search"] as const).map((view) => (
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

      {activeView === "documents" && (
        <Container className="p-0">
          <div className="flex flex-wrap gap-2 border-b px-6 py-3">
            {(["APPROVED", "DRAFT", "RETIRED"] as const).map((status) => (
              <Button
                key={status}
                onClick={() => setDocumentStatus(status)}
                size="small"
                variant={documentStatus === status ? "secondary" : "transparent"}
              >
                {t(`knowledgeHub.status.${status.toLowerCase()}`)} · {counts[status]}
              </Button>
            ))}
          </div>
          <div className="grid min-h-[520px] grid-cols-1 lg:grid-cols-[320px_1fr]">
            <div className="border-b lg:border-b-0 lg:border-r">
              {documents.isLoading && (
                <Text className="px-6 py-6 text-ui-fg-subtle" size="small">
                  {t("knowledgeHub.loading")}
                </Text>
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
                    {t(`knowledgeHub.scopes.${
                      document.scope === "customer_support"
                        ? "customerSupport"
                        : document.scope
                    }`)}
                  </Text>
                </button>
              ))}
              {!documents.isLoading && !filteredDocuments.length && (
                <Text className="px-6 py-8 text-ui-fg-subtle" size="small">
                  {t(`knowledgeHub.emptyStatus.${documentStatus.toLowerCase()}`)}
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
              ) : detail.data ? (
                <div className="mx-auto flex max-w-3xl flex-col gap-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-2">
                      <StatusBadge color={statusColor(detail.data.document.status)}>
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
                          scope: t(`knowledgeHub.scopes.${
                            detail.data.document.scope === "customer_support"
                              ? "customerSupport"
                              : detail.data.document.scope
                          }`),
                        })}
                      </Text>
                    </div>
                    {detail.data.document.status === "DRAFT" && (
                      <Button
                        isLoading={approveDocument.isPending}
                        onClick={() => approveDocument.mutate(selectedId)}
                        size="small"
                      >
                        {t("knowledgeHub.approveAction")}
                      </Button>
                    )}
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
                  <div className="rounded-lg bg-ui-bg-subtle px-5 py-5">
                    <Text leading="compact" size="small" weight="plus">
                      {t("knowledgeHub.guidanceContent")}
                    </Text>
                    <Text className="mt-3 whitespace-pre-wrap" size="small">
                      {detail.data.document.content}
                    </Text>
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
          </Container>
          <Container className="p-0">
          <div className="border-b px-6 py-4">
            <Text leading="compact" size="small" weight="plus">
              {t("knowledgeHub.sources.title")}
            </Text>
            <Text className="text-ui-fg-subtle" leading="compact" size="small">
              {t("knowledgeHub.sources.simpleSubtitle")}
            </Text>
          </div>
          {sources.isLoading ? (
            <Text className="px-6 py-8 text-ui-fg-subtle" size="small">
              {t("knowledgeHub.sources.loading")}
            </Text>
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
                  <div className="min-w-0">
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
                      )} · {sourceHostname(source.source_url)}
                    </Text>
                    <Text className="text-ui-fg-muted" size="xsmall">
                      {t(
                        `knowledgeHub.scopes.${
                          source.scope === "customer_support"
                            ? "customerSupport"
                            : source.scope
                        }`
                      )} · {t(`knowledgeHub.languages.${source.locale}`)}
                    </Text>
                    {source.last_error && (
                      <Text className="mt-1 text-ui-fg-error" size="small">
                        {t("knowledgeHub.sources.connectionErrorHint")}
                      </Text>
                    )}
                  </div>
                  <Button
                    disabled={syncSource.isPending}
                    isLoading={
                      syncSource.isPending && syncSource.variables === source.id
                    }
                    onClick={() => syncSource.mutate(source.id)}
                    size="small"
                    variant="secondary"
                  >
                    {t("knowledgeHub.sources.syncAction")}
                  </Button>
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
          <div className="grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-[1fr_140px_180px_auto]">
            <Input
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("knowledgeHub.searchPlaceholder")}
              value={searchQuery}
            />
            <Select onValueChange={setSearchLocale} value={searchLocale}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="vi">Tiếng Việt</Select.Item>
                <Select.Item value="en">English</Select.Item>
              </Select.Content>
            </Select>
            <Select onValueChange={setSearchScope} value={searchScope}>
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="customer_support">{t("knowledgeHub.scopes.customerSupport")}</Select.Item>
                <Select.Item value="operations">{t("knowledgeHub.scopes.operations")}</Select.Item>
                <Select.Item value="returns">{t("knowledgeHub.scopes.returns")}</Select.Item>
                <Select.Item value="fulfillment">{t("knowledgeHub.scopes.fulfillment")}</Select.Item>
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
              <div className="rounded-lg bg-ui-bg-subtle px-5 py-4" key={`${result.document_id}-${result.citation_locator}`}>
                <Text leading="compact" size="small" weight="plus">
                  {result.title}
                </Text>
                <Text className="mt-2" size="small">{result.excerpt}</Text>
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>{t("knowledgeHub.fields.language")}</Label>
                  <Select onValueChange={(locale) => setForm((current) => ({ ...current, locale }))} value={form.locale}>
                    <Select.Trigger><Select.Value /></Select.Trigger>
                    <Select.Content>
                      <Select.Item value="vi">Tiếng Việt</Select.Item>
                      <Select.Item value="en">English</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t("knowledgeHub.fields.scope")}</Label>
                  <Select onValueChange={(scope) => setForm((current) => ({ ...current, scope }))} value={form.scope}>
                    <Select.Trigger><Select.Value /></Select.Trigger>
                    <Select.Content>
                      <Select.Item value="customer_support">{t("knowledgeHub.scopes.customerSupport")}</Select.Item>
                      <Select.Item value="operations">{t("knowledgeHub.scopes.operations")}</Select.Item>
                      <Select.Item value="returns">{t("knowledgeHub.scopes.returns")}</Select.Item>
                      <Select.Item value="fulfillment">{t("knowledgeHub.scopes.fulfillment")}</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="content">{t("knowledgeHub.fields.content")}</Label>
                <Textarea
                  className="min-h-52"
                  id="content"
                  onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
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

      <Drawer open={sourceOpen} onOpenChange={setSourceOpen}>
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
                      {["Google Docs", "Google Sheets", "TXT", "Markdown", "CSV"].map(
                        (type) => (
                          <span
                            className="rounded-md border bg-ui-bg-base px-2 py-1 text-ui-fg-subtle txt-compact-small"
                            key={type}
                          >
                            {type}
                          </span>
                        )
                      )}
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

                  {sourceForm.source_url ? (
                    <div className="rounded-lg border border-ui-border-interactive bg-ui-bg-base p-4">
                      <Text className="text-ui-fg-subtle" size="xsmall">
                        {t("knowledgeHub.sources.automatic.selectedTitle")}
                      </Text>
                      <Text className="mt-1" weight="plus">
                        {sourceForm.name}
                      </Text>
                      <Text className="text-ui-fg-subtle" size="small">
                        {t(
                          `knowledgeHub.sources.types.${sourceTypeTranslationKey(sourceForm.source_type)}`
                        )}
                      </Text>
                    </div>
                  ) : (
                    <Text className="text-ui-fg-subtle" size="small">
                      {t("knowledgeHub.sources.automatic.noSelection")}
                    </Text>
                  )}

                  <Button
                    disabled={!googleConnector.data?.connected}
                    isLoading={pickerLoading}
                    onClick={chooseGoogleDocument}
                    type="button"
                  >
                    {sourceForm.source_url
                      ? t("knowledgeHub.sources.automatic.changeFileAction")
                      : t("knowledgeHub.sources.oauth.chooseFileAction")}
                  </Button>

              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>{t("knowledgeHub.fields.language")}</Label>
                  <Select
                    onValueChange={(locale) =>
                      setSourceForm((current) => ({ ...current, locale }))
                    }
                    value={sourceForm.locale}
                  >
                    <Select.Trigger><Select.Value /></Select.Trigger>
                    <Select.Content>
                      <Select.Item value="vi">Tiếng Việt</Select.Item>
                      <Select.Item value="en">English</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t("knowledgeHub.fields.scope")}</Label>
                  <Select
                    onValueChange={(scope) =>
                      setSourceForm((current) => ({ ...current, scope }))
                    }
                    value={sourceForm.scope}
                  >
                    <Select.Trigger><Select.Value /></Select.Trigger>
                    <Select.Content>
                      <Select.Item value="customer_support">
                        {t("knowledgeHub.scopes.customerSupport")}
                      </Select.Item>
                      <Select.Item value="operations">
                        {t("knowledgeHub.scopes.operations")}
                      </Select.Item>
                      <Select.Item value="returns">
                        {t("knowledgeHub.scopes.returns")}
                      </Select.Item>
                      <Select.Item value="fulfillment">
                        {t("knowledgeHub.scopes.fulfillment")}
                      </Select.Item>
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
                disabled={createSource.isPending}
                onClick={() => setSourceOpen(false)}
                size="small"
                variant="secondary"
              >
                {t("knowledgeHub.cancel")}
              </Button>
              <Button
                disabled={
                  createSource.isPending ||
                  !sourceForm.name ||
                  !sourceForm.source_url ||
                  !googleConnector.data?.connected
                }
                form="knowledge-source-form"
                isLoading={createSource.isPending}
                size="small"
                type="submit"
              >
                {t("knowledgeHub.sources.saveAction")}
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

    </div>
  )
}

export const config = defineRouteConfig({
  label: "Hướng dẫn / Knowledge",
})

export default KnowledgeHubPage
