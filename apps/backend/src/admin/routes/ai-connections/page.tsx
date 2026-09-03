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
import { FormEvent, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { sdk } from "../../lib/sdk"

type AiProvider = "DEEPSEEK" | "GEMINI" | "OPENAI"

type AiProviderStatus = {
  configured: boolean
  embedding_dimensions: number | null
  embedding_enabled: boolean
  embedding_model: string
  generation_enabled: boolean
  generation_model: string
  provider: AiProvider
  secret_hint: string | null
  supports_embedding: boolean
  supports_generation: boolean
  updated_at: string | null
}

type AiProviderListResponse = {
  providers: AiProviderStatus[]
}

type ProviderUsage = {
  average_tokens_per_request: number
  input_tokens: number
  output_tokens: number
  provider: AiProvider
  runs: number
  total_tokens: number
  tracked_runs: number
}

type ModelRunUsageResponse = {
  usage_summary: {
    by_provider: ProviderUsage[]
    sampled_runs: number
  }
}

type AiPromptConfiguration = {
  customized: boolean
  default_system_prompt: string
  max_tokens: number
  prompt_key: string
  system_prompt: string
  updated_at: string | null
  version: string
}

type AiPromptResponse = {
  prompt: AiPromptConfiguration
}

type AiModelOption = {
  description: string | null
  id: string
  label: string
}

type AiModelCatalog = {
  embedding_models: AiModelOption[]
  generation_models: AiModelOption[]
  provider: AiProvider
}

type Purpose = "answers" | "both" | "search"

const purposeOf = (provider: AiProviderStatus): Purpose => {
  if (!provider.supports_embedding) return "answers"
  if (provider.embedding_enabled && provider.generation_enabled) return "both"
  return provider.embedding_enabled ? "search" : "answers"
}

const PROVIDER_LABELS: Record<AiProvider, string> = {
  DEEPSEEK: "DeepSeek",
  GEMINI: "Google Gemini",
  OPENAI: "OpenAI",
}

const providerLabel = (provider: AiProvider) =>
  PROVIDER_LABELS[provider] ?? provider

const formatInteger = (value: number) => new Intl.NumberFormat("vi-VN").format(value)

const includeCurrentModel = (
  models: AiModelOption[],
  currentModel: string
) => {
  if (!currentModel || models.some((model) => model.id === currentModel)) {
    return models
  }
  return [
    { description: null, id: currentModel, label: currentModel },
    ...models,
  ]
}

type AiConnectionsContentProps = {
  embedded?: boolean
}

export const AiConnectionsContent = ({
  embedded = false,
}: AiConnectionsContentProps) => {
  const { t } = useTranslation()
  const confirm = usePrompt()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<AiProviderStatus | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptForm, setPromptForm] = useState({
    max_tokens: 1200,
    system_prompt: "",
  })
  const [modelCatalog, setModelCatalog] = useState<AiModelCatalog | null>(null)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState(false)
  const modelRequest = useRef(0)
  const [form, setForm] = useState({
    api_key: "",
    embedding_model: "",
    generation_model: "",
    purpose: "both" as Purpose,
  })

  const providers = useQuery({
    queryFn: () =>
      sdk.client.fetch<AiProviderListResponse>(
        "/admin/agent-operations/ai/providers"
      ),
    queryKey: ["agent-ai-providers"],
  })

  const aiPrompt = useQuery({
    queryFn: () =>
      sdk.client.fetch<AiPromptResponse>(
        "/admin/agent-operations/ai/prompt"
      ),
    queryKey: ["agent-ai-prompt"],
  })

  const usage = useQuery({
    queryFn: () =>
      sdk.client.fetch<ModelRunUsageResponse>(
        "/admin/agent-operations/model-runs"
      ),
    queryKey: ["agent-model-run-usage"],
  })

  useEffect(() => {
    const apiKey = form.api_key.trim()
    const canUseStoredKey = Boolean(selected?.configured && !apiKey)
    const canUseEnteredKey = apiKey.length >= 20
    const requestId = ++modelRequest.current

    if (!selected || (!canUseStoredKey && !canUseEnteredKey)) {
      setModelCatalog(null)
      setModelsError(false)
      setModelsLoading(false)
      return
    }

    const timeout = window.setTimeout(async () => {
      setModelsLoading(true)
      setModelsError(false)
      try {
        const catalog = await sdk.client.fetch<AiModelCatalog>(
          `/admin/agent-operations/ai/providers/${selected.provider.toLowerCase()}/models`,
          {
            body: apiKey ? { api_key: apiKey } : {},
            method: "POST",
          }
        )
        if (modelRequest.current !== requestId) return
        setModelCatalog(catalog)
      } catch {
        if (modelRequest.current !== requestId) return
        setModelCatalog(null)
        setModelsError(true)
      } finally {
        if (modelRequest.current === requestId) setModelsLoading(false)
      }
    }, 700)

    return () => window.clearTimeout(timeout)
  }, [form.api_key, selected])

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["agent-ai-providers"] })

  const savePrompt = useMutation({
    mutationFn: () =>
      sdk.client.fetch<AiPromptResponse>(
        "/admin/agent-operations/ai/prompt",
        {
          body: promptForm,
          method: "POST",
        }
      ),
    onError: () => toast.error(t("aiProviders.promptSaveError")),
    onSuccess: async () => {
      setPromptOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["agent-ai-prompt"] })
      toast.success(t("aiProviders.promptSaved"))
    },
  })

  const saveProvider = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("No provider selected")
      return sdk.client.fetch(
        `/admin/agent-operations/ai/providers/${selected.provider.toLowerCase()}`,
        {
          body: {
            ...(form.api_key.trim() ? { api_key: form.api_key.trim() } : {}),
            embedding_dimensions: selected.embedding_dimensions,
            embedding_enabled:
              form.purpose === "both" || form.purpose === "search",
            embedding_model: form.embedding_model,
            generation_enabled:
              form.purpose === "both" || form.purpose === "answers",
            generation_model: form.generation_model,
          },
          method: "POST",
        }
      )
    },
    onError: () => toast.error(t("aiProviders.saveError")),
    onSuccess: async () => {
      setSelected(null)
      setForm((current) => ({ ...current, api_key: "" }))
      await refresh()
      toast.success(t("aiProviders.saved"))
    },
  })

  const disconnectProvider = useMutation({
    mutationFn: (provider: AiProvider) =>
      sdk.client.fetch(
        `/admin/agent-operations/ai/providers/${provider.toLowerCase()}`,
        { method: "DELETE" }
      ),
    onError: () => toast.error(t("aiProviders.disconnectError")),
    onSuccess: async () => {
      await refresh()
      toast.success(t("aiProviders.disconnected"))
    },
  })

  const openProvider = (provider: AiProviderStatus) => {
    setModelCatalog(null)
    setModelsError(false)
    setSelected(provider)
    setForm({
      api_key: "",
      embedding_model: provider.embedding_model,
      generation_model: provider.generation_model,
      purpose: purposeOf(provider),
    })
  }

  const openPrompt = () => {
    if (!aiPrompt.data?.prompt) return
    setPromptForm({
      max_tokens: aiPrompt.data.prompt.max_tokens,
      system_prompt: aiPrompt.data.prompt.system_prompt,
    })
    setPromptOpen(true)
  }

  const confirmDisconnect = async (provider: AiProviderStatus) => {
    const confirmed = await confirm({
      cancelText: t("aiProviders.cancel"),
      confirmText: t("aiProviders.disconnect"),
      description: t("aiProviders.disconnectDescription"),
      title: t("aiProviders.disconnectTitle", { provider: provider.provider }),
      variant: "danger",
    })
    if (confirmed) disconnectProvider.mutate(provider.provider)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!selected?.configured && !form.api_key.trim()) {
      toast.error(t("aiProviders.saveError"))
      return
    }
    saveProvider.mutate()
  }

  const modelsReady = Boolean(
    modelCatalog &&
      (form.purpose === "answers" || modelCatalog.embedding_models.length) &&
      (form.purpose === "search" || modelCatalog.generation_models.length)
  )

  return (
    <div className="flex flex-col gap-3">
      {!embedded && (
        <Container className="px-6 py-5">
          <Heading>{t("aiProviders.title")}</Heading>
          <Text className="mt-1 text-ui-fg-subtle" size="small">
            {t("aiProviders.subtitle")}
          </Text>
        </Container>
      )}

      <Container className="px-6 py-4">
        <Text size="small">{t("aiProviders.security")}</Text>
      </Container>

      <Container className="px-6 py-5">
        <div className="flex flex-col gap-1">
          <Heading level="h2">Token usage trả lời khách hàng</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Tổng hợp theo 100 lượt gọi model mới nhất. Trung bình chỉ tính các lượt đã nhận usage từ provider.
          </Text>
        </div>
        {usage.isLoading && (
          <Text className="mt-4 text-ui-fg-subtle" size="small">
            Đang tải thống kê token...
          </Text>
        )}
        {usage.isError && (
          <Text className="mt-4 text-ui-fg-error" size="small">
            Không thể tải thống kê token.
          </Text>
        )}
        {usage.data && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {usage.data.usage_summary.by_provider.map((provider) => (
                <div
                  className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4"
                  key={provider.provider}
                >
                  <Text leading="compact" size="small" weight="plus">
                    {providerLabel(provider.provider)}
                  </Text>
                  <Text className="mt-3" leading="compact" size="xsmall">
                    {formatInteger(provider.total_tokens)} token tổng
                  </Text>
                  <Text className="mt-1 text-ui-fg-subtle" leading="compact" size="xsmall">
                    Trung bình {formatInteger(provider.average_tokens_per_request)} token / request
                  </Text>
                  <Text className="mt-3 text-ui-fg-subtle" leading="compact" size="xsmall">
                    Input {formatInteger(provider.input_tokens)} · Output {formatInteger(provider.output_tokens)}
                  </Text>
                  <Text className="mt-1 text-ui-fg-subtle" leading="compact" size="xsmall">
                    {formatInteger(provider.tracked_runs)} lượt đã đo / {formatInteger(provider.runs)} lượt gọi
                  </Text>
                </div>
              ))}
            </div>
            <Text className="mt-3 text-ui-fg-muted" leading="compact" size="xsmall">
              Mẫu thống kê: {formatInteger(usage.data.usage_summary.sampled_runs)} lượt gọi gần nhất.
            </Text>
          </>
        )}
      </Container>

      {providers.isLoading && (
        <Container className="px-6 py-8">
          <Text className="text-ui-fg-subtle" size="small">
            {t("aiProviders.loading")}
          </Text>
        </Container>
      )}
      {providers.isError && (
        <Container className="px-6 py-8">
          <Text className="text-ui-fg-error" size="small">
            {t("aiProviders.loadError")}
          </Text>
        </Container>
      )}
      {providers.data?.providers.map((provider) => (
        <Container className="px-6 py-5" key={provider.provider}>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Heading level="h2">
                  {providerLabel(provider.provider)}
                </Heading>
                <StatusBadge color={provider.configured ? "green" : "grey"}>
                  {t(
                    provider.configured
                      ? "aiProviders.configured"
                      : "aiProviders.notConfigured"
                  )}
                </StatusBadge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {provider.embedding_enabled && (
                  <StatusBadge color="blue">
                    {t("aiProviders.usedForSearch")}
                  </StatusBadge>
                )}
                {provider.generation_enabled && (
                  <StatusBadge color="purple">
                    {t("aiProviders.usedForAnswers")}
                  </StatusBadge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {provider.configured && (
                <Button
                  disabled={disconnectProvider.isPending}
                  onClick={() => confirmDisconnect(provider)}
                  size="small"
                  variant="secondary"
                >
                  {t("aiProviders.disconnect")}
                </Button>
              )}
              <Button onClick={() => openProvider(provider)} size="small">
                {t(
                  provider.configured
                    ? "aiProviders.edit"
                    : "aiProviders.connect"
                )}
              </Button>
            </div>
          </div>
        </Container>
      ))}

      <Container className="px-6 py-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Heading level="h2">{t("aiProviders.promptTitle")}</Heading>
              {aiPrompt.data?.prompt && (
                <StatusBadge
                  color={aiPrompt.data.prompt.customized ? "orange" : "green"}
                >
                  {t(
                    aiPrompt.data.prompt.customized
                      ? "aiProviders.promptCustomized"
                      : "aiProviders.promptDefault"
                  )}
                </StatusBadge>
              )}
            </div>
            <Text className="mt-1 text-ui-fg-subtle" size="small">
              {t("aiProviders.promptDescription")}
            </Text>
            {aiPrompt.data?.prompt && (
              <>
                <Text className="mt-3 text-ui-fg-subtle" size="xsmall">
                  {t("aiProviders.promptVersion", {
                    tokens: aiPrompt.data.prompt.max_tokens,
                    version: aiPrompt.data.prompt.version,
                  })}
                </Text>
                <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4">
                  <Text className="whitespace-pre-wrap" size="small">
                    {aiPrompt.data.prompt.system_prompt}
                  </Text>
                </div>
              </>
            )}
            {aiPrompt.isLoading && (
              <Text className="mt-3 text-ui-fg-subtle" size="small">
                {t("aiProviders.promptLoading")}
              </Text>
            )}
            {aiPrompt.isError && (
              <Text className="mt-3 text-ui-fg-error" size="small">
                {t("aiProviders.promptLoadError")}
              </Text>
            )}
          </div>
          <Button
            disabled={!aiPrompt.data?.prompt}
            onClick={openPrompt}
            size="small"
            variant="secondary"
          >
            {t("aiProviders.customizePrompt")}
          </Button>
        </div>
      </Container>

      <Drawer open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              {t("aiProviders.drawerTitle", {
                provider: selected ? providerLabel(selected.provider) : "",
              })}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="overflow-y-auto">
            <form className="flex flex-col gap-5" id="ai-provider-form" onSubmit={submit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="provider-api-key">{t("aiProviders.apiKey")}</Label>
                <Input
                  autoComplete="new-password"
                  id="provider-api-key"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, api_key: event.target.value }))
                  }
                  required={!selected?.configured}
                  type="password"
                  value={form.api_key}
                />
                <Text className="text-ui-fg-subtle" size="xsmall">
                  {selected?.configured
                    ? t("aiProviders.apiKeyEditHint", {
                        hint: selected.secret_hint ?? "----",
                      })
                    : t("aiProviders.apiKeyNewHint", {
                        provider: selected?.provider,
                      })}
                </Text>
              </div>

              <div className="flex flex-col gap-2">
                <Label>{t("aiProviders.purpose")}</Label>
                {selected?.supports_embedding ? (
                  <Select
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        purpose: value as Purpose,
                      }))
                    }
                    value={form.purpose}
                  >
                    <Select.Trigger><Select.Value /></Select.Trigger>
                    <Select.Content>
                      <Select.Item value="both">{t("aiProviders.purposeBoth")}</Select.Item>
                      <Select.Item value="search">{t("aiProviders.purposeSearch")}</Select.Item>
                      <Select.Item value="answers">{t("aiProviders.purposeAnswers")}</Select.Item>
                    </Select.Content>
                  </Select>
                ) : (
                  <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
                    <Text size="small" weight="plus">
                      {t("aiProviders.purposeAnswers")}
                    </Text>
                    <Text className="mt-1 text-ui-fg-subtle" size="xsmall">
                      {t("aiProviders.generationOnlyHint")}
                    </Text>
                  </div>
                )}
              </div>

              {modelsLoading && (
                <Text className="text-ui-fg-subtle" size="small">
                  {t("aiProviders.loadingModels")}
                </Text>
              )}
              {modelsError && (
                <Text className="text-ui-fg-error" size="small">
                  {t("aiProviders.modelLoadError")}
                </Text>
              )}
              {!selected?.configured && form.api_key.trim().length < 20 && (
                <Text className="text-ui-fg-subtle" size="small">
                  {t("aiProviders.modelWaitingForKey")}
                </Text>
              )}

              {(form.purpose === "both" || form.purpose === "search") && (
                <div className="flex flex-col gap-2">
                  <Label>{t("aiProviders.embeddingModel")}</Label>
                  <Select
                    disabled={!modelCatalog?.embedding_models.length}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        embedding_model: value,
                      }))
                    }
                    value={form.embedding_model}
                  >
                    <Select.Trigger>
                      <Select.Value
                        placeholder={t("aiProviders.modelPlaceholder")}
                      />
                    </Select.Trigger>
                    <Select.Content>
                      {includeCurrentModel(
                        modelCatalog?.embedding_models ?? [],
                        form.embedding_model
                      ).map((model) => (
                        <Select.Item key={model.id} value={model.id}>
                          {model.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              )}

              {(form.purpose === "both" || form.purpose === "answers") && (
                <div className="flex flex-col gap-2">
                  <Label>{t("aiProviders.generationModel")}</Label>
                  <Select
                    disabled={!modelCatalog?.generation_models.length}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        generation_model: value,
                      }))
                    }
                    value={form.generation_model}
                  >
                    <Select.Trigger>
                      <Select.Value
                        placeholder={t("aiProviders.modelPlaceholder")}
                      />
                    </Select.Trigger>
                    <Select.Content>
                      {includeCurrentModel(
                        modelCatalog?.generation_models ?? [],
                        form.generation_model
                      ).map((model) => (
                        <Select.Item key={model.id} value={model.id}>
                          {model.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                  <Text className="text-ui-fg-subtle" size="xsmall">
                    {t("aiProviders.modelHint")}
                  </Text>
                </div>
              )}
            </form>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex w-full justify-end gap-2">
              <Button
                disabled={saveProvider.isPending}
                onClick={() => setSelected(null)}
                size="small"
                variant="secondary"
              >
                {t("aiProviders.cancel")}
              </Button>
              <Button
                form="ai-provider-form"
                isLoading={saveProvider.isPending}
                disabled={saveProvider.isPending || !modelsReady}
                size="small"
                type="submit"
              >
                {t("aiProviders.save")}
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      <Drawer open={promptOpen} onOpenChange={setPromptOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{t("aiProviders.promptDrawerTitle")}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="overflow-y-auto">
            <form
              className="flex flex-col gap-5"
              id="ai-prompt-form"
              onSubmit={(event) => {
                event.preventDefault()
                savePrompt.mutate()
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="system-prompt">
                  {t("aiProviders.systemPrompt")}
                </Label>
                <Textarea
                  id="system-prompt"
                  onChange={(event) =>
                    setPromptForm((current) => ({
                      ...current,
                      system_prompt: event.target.value,
                    }))
                  }
                  required
                  rows={18}
                  value={promptForm.system_prompt}
                />
                <Text className="text-ui-fg-subtle" size="xsmall">
                  {t("aiProviders.systemPromptHint")}
                </Text>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="prompt-max-tokens">
                  {t("aiProviders.maxTokens")}
                </Label>
                <Input
                  id="prompt-max-tokens"
                  max={8192}
                  min={128}
                  onChange={(event) =>
                    setPromptForm((current) => ({
                      ...current,
                      max_tokens: Number(event.target.value),
                    }))
                  }
                  required
                  type="number"
                  value={promptForm.max_tokens}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>{t("aiProviders.defaultPromptTitle")}</Label>
                  <Button
                    onClick={() =>
                      setPromptForm((current) => ({
                        ...current,
                        system_prompt:
                          aiPrompt.data?.prompt.default_system_prompt ?? "",
                      }))
                    }
                    size="small"
                    type="button"
                    variant="secondary"
                  >
                    {t("aiProviders.restoreDefault")}
                  </Button>
                </div>
                <Textarea
                  readOnly
                  rows={12}
                  value={aiPrompt.data?.prompt.default_system_prompt ?? ""}
                />
              </div>
            </form>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex w-full justify-end gap-2">
              <Button
                disabled={savePrompt.isPending}
                onClick={() => setPromptOpen(false)}
                size="small"
                variant="secondary"
              >
                {t("aiProviders.cancel")}
              </Button>
              <Button
                form="ai-prompt-form"
                isLoading={savePrompt.isPending}
                size="small"
                type="submit"
              >
                {t("aiProviders.savePrompt")}
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}

const AiConnectionsPage = () => <AiConnectionsContent />

export default AiConnectionsPage
