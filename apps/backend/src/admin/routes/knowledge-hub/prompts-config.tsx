import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  StatusBadge,
  Text,
  Textarea,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { sdk } from "../../lib/sdk"

export type AssistantSettings = {
  bot_role: string
  brand_name: string
  clarify_message_en: string
  clarify_message_vi: string
  greeting_message_en: string
  greeting_message_vi: string
  review_ack_message_en: string
  review_ack_message_vi: string
}

export type ManagedPromptItem = {
  customized: boolean
  default_max_tokens: number
  default_system_prompt: string
  description: string
  max_tokens: number
  prompt_key: string
  system_prompt: string
  title: string
  updated_at: string | null
  version: string
}

export type PromptsConfigResponse = {
  prompts: ManagedPromptItem[]
  settings: AssistantSettings
}

export const PromptsConfigContent = () => {
  const { t } = useTranslation()
  const confirm = usePrompt()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryFn: () =>
      sdk.client.fetch<PromptsConfigResponse>(
        "/admin/agent-operations/ai/prompts"
      ),
    queryKey: ["agent-ai-prompts-and-settings"],
  })

  const [settingsForm, setSettingsForm] = useState<AssistantSettings>({
    bot_role: "nhân viên CSKH",
    brand_name: "Synapse",
    clarify_message_en: "",
    clarify_message_vi: "",
    greeting_message_en: "",
    greeting_message_vi: "",
    review_ack_message_en: "",
    review_ack_message_vi: "",
  })

  const [promptForms, setPromptForms] = useState<
    Record<string, { max_tokens: number; system_prompt: string }>
  >({})

  useEffect(() => {
    if (data?.settings) {
      setSettingsForm(data.settings)
    }
    if (data?.prompts) {
      const forms: Record<
        string,
        { max_tokens: number; system_prompt: string }
      > = {}
      for (const item of data.prompts) {
        forms[item.prompt_key] = {
          max_tokens: item.max_tokens,
          system_prompt: item.system_prompt,
        }
      }
      setPromptForms(forms)
    }
  }, [data])

  const saveSettingsMutation = useMutation({
    mutationFn: (settings: Partial<AssistantSettings>) =>
      sdk.client.fetch<PromptsConfigResponse>(
        "/admin/agent-operations/ai/prompts",
        {
          body: { settings },
          method: "POST",
        }
      ),
    onError: (error: Error) => {
      toast.error(
        t("prompts.saveSettingsFailed", "Lưu cài đặt nhận diện thất bại"),
        { description: error.message }
      )
    },
    onSuccess: (res) => {
      queryClient.setQueryData(["agent-ai-prompts-and-settings"], res)
      toast.success(
        t("prompts.saveSettingsSuccess", "Đã lưu cài đặt nhận diện & câu chào thành công")
      )
    },
  })

  const savePromptMutation = useMutation({
    mutationFn: (payload: {
      max_tokens: number
      prompt_key: string
      system_prompt: string
    }) =>
      sdk.client.fetch<PromptsConfigResponse>(
        "/admin/agent-operations/ai/prompts",
        {
          body: payload,
          method: "POST",
        }
      ),
    onError: (error: Error) => {
      toast.error(
        t("prompts.savePromptFailed", "Lưu system prompt thất bại"),
        { description: error.message }
      )
    },
    onSuccess: (res) => {
      queryClient.setQueryData(["agent-ai-prompts-and-settings"], res)
      toast.success(
        t("prompts.savePromptSuccess", "Đã lưu và kích hoạt System Prompt thành công")
      )
    },
  })

  const resetMutation = useMutation({
    mutationFn: (promptKey: string) =>
      sdk.client.fetch<PromptsConfigResponse>(
        "/admin/agent-operations/ai/prompts/reset",
        {
          body: { prompt_key: promptKey },
          method: "POST",
        }
      ),
    onError: (error: Error) => {
      toast.error(
        t("prompts.resetFailed", "Khôi phục mặc định thất bại"),
        { description: error.message }
      )
    },
    onSuccess: (res) => {
      queryClient.setQueryData(["agent-ai-prompts-and-settings"], res)
      toast.success(
        t("prompts.resetSuccess", "Đã khôi phục về cấu hình mặc định ban đầu")
      )
    },
  })

  const handleSaveSettings = (e: FormEvent) => {
    e.preventDefault()
    saveSettingsMutation.mutate(settingsForm)
  }

  const handleSavePrompt = (promptKey: string) => {
    const current = promptForms[promptKey]
    if (!current) return
    savePromptMutation.mutate({
      max_tokens: current.max_tokens,
      prompt_key: promptKey,
      system_prompt: current.system_prompt,
    })
  }

  const handleResetSingle = async (promptKey: string) => {
    const ok = await confirm({
      description: t(
        "prompts.resetPromptConfirmDesc",
        "Bạn có chắc muốn khôi phục System Prompt này về bản gốc mặc định của hệ thống?"
      ),
      title: t("prompts.resetPromptConfirmHeading", "Khôi phục Prompt mặc định"),
    })
    if (ok) {
      resetMutation.mutate(promptKey)
    }
  }

  const handleResetAll = async () => {
    const ok = await confirm({
      description: t(
        "prompts.resetAllConfirmDesc",
        "Thao tác này sẽ khôi phục toàn bộ System Prompts và cài đặt nhận diện về giá trị mặc định của hệ thống."
      ),
      title: t("prompts.resetAllConfirmHeading", "Khôi phục tất cả về mặc định"),
    })
    if (ok) {
      resetMutation.mutate("all")
    }
  }

  if (isLoading) {
    return (
      <Container className="p-8">
        <Text className="text-ui-fg-muted">Đang tải cấu hình Prompts & Trợ lý...</Text>
      </Container>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Heading level="h2">Cấu hình Trợ lý AI & System Prompts</Heading>
          <Text className="text-ui-fg-subtle mt-1" size="small">
            Tùy biến tên thương hiệu, vai trò xưng hô, câu chào mừng và toàn bộ các System Prompt vận hành của Chatbot CSKH trực tiếp từ Web GUI.
          </Text>
        </div>
        <Button
          disabled={resetMutation.isPending}
          onClick={handleResetAll}
          size="small"
          variant="secondary"
        >
          Khôi phục tất cả về mặc định
        </Button>
      </div>

      {/* Card 1: Brand & Persona Settings */}
      <Container className="p-6">
        <div className="mb-4 flex items-center justify-between border-b border-ui-border-base pb-3">
          <div>
            <Heading level="h3">1. Thông tin Thương hiệu & Lời thoại Phản hồi</Heading>
            <Text className="text-ui-fg-subtle text-xs mt-0.5">
              Cấu hình tên cửa hàng, vai trò của trợ lý và các câu phản hồi mặc định khi khách chào hỏi hoặc chờ kiểm tra.
            </Text>
          </div>
          <Badge color="green">Active</Badge>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block font-medium text-xs">Tên Cửa hàng / Thương hiệu</Label>
              <Input
                value={settingsForm.brand_name}
                onChange={(e) =>
                  setSettingsForm((prev) => ({
                    ...prev,
                    brand_name: e.target.value,
                  }))
                }
                placeholder="VD: Synapse, Duy Fashion Store..."
              />
            </div>
            <div>
              <Label className="mb-1 block font-medium text-xs">Vai trò Trợ lý (Xưng hô)</Label>
              <Input
                value={settingsForm.bot_role}
                onChange={(e) =>
                  setSettingsForm((prev) => ({
                    ...prev,
                    bot_role: e.target.value,
                  }))
                }
                placeholder="VD: nhân viên CSKH, chuyên viên tư vấn..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block font-medium text-xs">Câu chào mừng (Tiếng Việt)</Label>
              <Textarea
                rows={2}
                value={settingsForm.greeting_message_vi}
                onChange={(e) =>
                  setSettingsForm((prev) => ({
                    ...prev,
                    greeting_message_vi: e.target.value,
                  }))
                }
                placeholder="Câu chào khi khách mở đầu hội thoại..."
              />
            </div>
            <div>
              <Label className="mb-1 block font-medium text-xs">Câu đề nghị làm rõ yêu cầu (Tiếng Việt)</Label>
              <Textarea
                rows={2}
                value={settingsForm.clarify_message_vi}
                onChange={(e) =>
                  setSettingsForm((prev) => ({
                    ...prev,
                    clarify_message_vi: e.target.value,
                  }))
                }
                placeholder="Câu hỏi khi chưa rõ ý định..."
              />
            </div>
          </div>

          <div>
            <Label className="mb-1 block font-medium text-xs">
              Câu thông báo khi cần kiểm tra thêm / Chưa có tài liệu đã duyệt (Tiếng Việt)
            </Label>
            <Textarea
              rows={2}
              value={settingsForm.review_ack_message_vi}
              onChange={(e) =>
                setSettingsForm((prev) => ({
                  ...prev,
                  review_ack_message_vi: e.target.value,
                }))
              }
              placeholder="Câu phản hồi lịch sự khi chưa có chính sách duyệt..."
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              disabled={saveSettingsMutation.isPending}
              isLoading={saveSettingsMutation.isPending}
              size="small"
              type="submit"
            >
              Lưu Thông tin Thương hiệu & Câu chào
            </Button>
          </div>
        </form>
      </Container>

      {/* Card 2: Managed System Prompts */}
      <div className="space-y-4">
        <Heading level="h3">2. System Prompts Vận hành AI & RAG</Heading>
        <Text className="text-ui-fg-subtle text-xs">
          Tất cả các prompt dưới đây được chuyển trực tiếp cho mô hình AI (LLM) để định tuyến ý định, tra cứu tri thức và tư vấn bán hàng.
        </Text>

        {data?.prompts?.map((item) => {
          const formState = promptForms[item.prompt_key] || {
            max_tokens: item.max_tokens,
            system_prompt: item.system_prompt,
          }
          const isCustomized =
            formState.system_prompt.trim() !== item.default_system_prompt.trim()

          return (
            <Container key={item.prompt_key} className="p-6">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-ui-border-base pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Heading level="h3">{item.title}</Heading>
                    {isCustomized ? (
                      <StatusBadge color="orange">Đã tùy chỉnh</StatusBadge>
                    ) : (
                      <StatusBadge color="green">Mặc định</StatusBadge>
                    )}
                  </div>
                  <Text className="text-ui-fg-subtle text-xs mt-1">
                    {item.description} (Key: <code className="text-ui-fg-interactive">{item.prompt_key}</code>)
                  </Text>
                </div>
                <div className="flex items-center gap-2">
                  {isCustomized && (
                    <Button
                      disabled={resetMutation.isPending}
                      onClick={() => handleResetSingle(item.prompt_key)}
                      size="small"
                      variant="secondary"
                    >
                      Khôi phục bản gốc
                    </Button>
                  )}
                  <Button
                    disabled={savePromptMutation.isPending}
                    isLoading={savePromptMutation.isPending}
                    onClick={() => handleSavePrompt(item.prompt_key)}
                    size="small"
                  >
                    Lưu Prompt
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">System Prompt</Label>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-ui-fg-muted">Max Tokens:</Label>
                    <Input
                      className="w-24 h-7 text-xs"
                      max={8192}
                      min={30}
                      onChange={(e) =>
                        setPromptForms((prev) => ({
                          ...prev,
                          [item.prompt_key]: {
                            ...prev[item.prompt_key],
                            max_tokens: Number(e.target.value) || 120,
                            system_prompt: prev[item.prompt_key]?.system_prompt ?? item.system_prompt,
                          },
                        }))
                      }
                      type="number"
                      value={formState.max_tokens}
                    />
                  </div>
                </div>
                <Textarea
                  className="font-mono text-xs leading-relaxed"
                  rows={8}
                  value={formState.system_prompt}
                  onChange={(e) =>
                    setPromptForms((prev) => ({
                      ...prev,
                      [item.prompt_key]: {
                        ...prev[item.prompt_key],
                        max_tokens: prev[item.prompt_key]?.max_tokens ?? item.max_tokens,
                        system_prompt: e.target.value,
                      },
                    }))
                  }
                  placeholder="Nhập system prompt hướng dẫn cho AI model..."
                />
              </div>
            </Container>
          )
        })}
      </div>
    </div>
  )
}
