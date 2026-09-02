import { Button, Container, Drawer, Heading, Input, Label, StatusBadge, Text, Textarea, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useState } from "react"
import { sdk } from "../../lib/sdk"

type TenantSkillStatus = "DRAFT" | "PAUSED" | "RETIRED" | "SHADOW"

type TenantSkill = {
  definition: {
    description: string
    eligible_tool_names: { items?: string[] }
    key: string
    name: string
    owner: "PLATFORM" | "TENANT"
    version: string
  }
  installation: {
    id: string
    status: TenantSkillStatus
  } | null
}

type SkillsResponse = {
  items: TenantSkill[]
}

const statusColor = (status: TenantSkillStatus) => {
  if (status === "SHADOW") return "blue" as const
  if (status === "PAUSED" || status === "RETIRED") return "grey" as const
  return "orange" as const
}

const defaultForm = {
  description: "",
  escalation_guidance: "Khi thiếu dữ kiện, yêu cầu của khách vượt ngoài phạm vi, hoặc thao tác có rủi ro, hãy chuyển nhân viên xử lý.",
  name: "",
  when_to_use: "",
}

export const SkillsConfigContent = () => {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const skills = useQuery({
    queryFn: async () => sdk.client.fetch<SkillsResponse>("/admin/agent-operations/skills"),
    queryKey: ["agent-operations", "skills"],
  })
  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["agent-operations", "skills"],
    })
  }
  const configureSkill = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      sdk.client.fetch("/admin/agent-operations/skills", {
        body,
        method: "POST",
      }),
    onSuccess: refresh,
    onError: () => toast.error("Không thể lưu skill. Vui lòng thử lại."),
  })
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TenantSkillStatus }) =>
      sdk.client.fetch(`/admin/agent-operations/skills/${id}/status`, {
        body: { status },
        method: "POST",
      }),
    onSuccess: refresh,
    onError: () => toast.error("Không thể cập nhật trạng thái skill."),
  })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    configureSkill.mutate(
      {
        action: "CREATE_DRAFT",
        ...form,
      },
      {
        onSuccess: () => {
          setForm(defaultForm)
          setCreateOpen(false)
          toast.success("Đã tạo bản nháp skill")
        },
      }
    )
  }
  const install = (skill: TenantSkill) => {
    configureSkill.mutate(
      {
        action: "INSTALL_PLATFORM",
        skill_key: skill.definition.key,
        skill_version: skill.definition.version,
      },
      { onSuccess: () => toast.success("Đã thêm skill ở trạng thái bản nháp") }
    )
  }

  return (
    <>
      <Container className="p-0">
        <div className="flex items-start justify-between gap-4 px-6 py-5">
          <div>
            <Heading level="h2">Skills của cửa hàng</Heading>
            <Text className="mt-1 max-w-2xl text-ui-fg-subtle" size="small">
              Mô tả cách hỗ trợ bằng ngôn ngữ tự nhiên. Hệ thống chỉ cho phép các tool đã được nền tảng kiểm duyệt; bản nháp và kiểm thử chưa ảnh hưởng đến hội thoại khách.
            </Text>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="small">
            Tạo skill riêng
          </Button>
        </div>
      </Container>

      <div className="grid gap-3">
        {skills.isLoading && <Text className="text-ui-fg-subtle">Đang tải skills…</Text>}
        {skills.isError && <Text className="text-ui-fg-error">Không tải được skills.</Text>}
        {skills.data?.items.map((skill) => {
          const installation = skill.installation
          return (
            <Container className="p-0" key={`${skill.definition.key}:${skill.definition.version}`}>
              <div className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Text weight="plus">{skill.definition.name}</Text>
                    <StatusBadge color={installation ? statusColor(installation.status) : "grey"}>
                      {installation?.status ?? "CHƯA CÀI"}
                    </StatusBadge>
                    {skill.definition.owner === "PLATFORM" && (
                      <Text className="text-ui-fg-subtle" size="xsmall">Skill nền tảng</Text>
                    )}
                  </div>
                  <Text className="mt-2 text-ui-fg-subtle" size="small">{skill.definition.description}</Text>
                  <Text className="mt-3 text-ui-fg-muted" size="xsmall">
                    Tool được phép: {skill.definition.eligible_tool_names.items?.join(", ") || "Không có"}
                  </Text>
                </div>
                <div className="flex shrink-0 gap-2">
                  {!installation && skill.definition.owner === "PLATFORM" && (
                    <Button disabled={configureSkill.isPending} onClick={() => install(skill)} size="small" variant="secondary">
                      Thêm vào cửa hàng
                    </Button>
                  )}
                  {installation?.status === "DRAFT" && (
                    <Button disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: installation.id, status: "SHADOW" })} size="small" variant="secondary">
                      Đưa vào kiểm thử
                    </Button>
                  )}
                  {installation?.status === "SHADOW" && (
                    <Button disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: installation.id, status: "PAUSED" })} size="small" variant="secondary">
                      Tạm dừng
                    </Button>
                  )}
                  {installation?.status === "PAUSED" && (
                    <Button disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: installation.id, status: "DRAFT" })} size="small" variant="secondary">
                      Soạn lại
                    </Button>
                  )}
                </div>
              </div>
            </Container>
          )
        })}
      </div>

      <Drawer open={createOpen} onOpenChange={setCreateOpen}>
        <Drawer.Content>
          <Drawer.Header><Drawer.Title>Tạo skill riêng</Drawer.Title></Drawer.Header>
          <Drawer.Body className="overflow-y-auto">
            <form className="flex flex-col gap-5" onSubmit={submit}>
              <Text className="text-ui-fg-subtle" size="small">
                Viết như đang hướng dẫn một nhân viên CSKH. Bạn không cần chọn intent, key hay prompt kỹ thuật.
              </Text>
              <div className="flex flex-col gap-2">
                <Label htmlFor="skill-name">Tên skill</Label>
                <Input id="skill-name" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required value={form.name} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="skill-when">Khi nào dùng skill này?</Label>
                <Textarea id="skill-when" onChange={(event) => setForm((current) => ({ ...current, when_to_use: event.target.value }))} required value={form.when_to_use} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="skill-description">Cách hỗ trợ khách</Label>
                <Textarea id="skill-description" onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} required value={form.description} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="skill-escalation">Khi nào cần chuyển người xử lý?</Label>
                <Textarea id="skill-escalation" onChange={(event) => setForm((current) => ({ ...current, escalation_guidance: event.target.value }))} required value={form.escalation_guidance} />
              </div>
              <Button disabled={configureSkill.isPending} type="submit">Lưu bản nháp</Button>
            </form>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </>
  )
}
