import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Input, Label, StatusBadge, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useState } from "react"
import { useTranslation } from "react-i18next"
import { ClipboardCopyIcon, LockClosedIcon, LockOpenIcon, ShieldCheckIcon } from "../../lib/icons"
import { sdk } from "../../lib/sdk"

type Settings = { has_passcode: boolean; public_access_enabled: boolean; updated_at: string }
type Response = { public_storefront_url: string | null; settings: Settings }

const DevAccessPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [passcode, setPasscode] = useState("")
  const accessQuery = useQuery({ queryFn: () => sdk.client.fetch<Response>("/admin/dev-access"), queryKey: ["admin-dev-access"] })
  const updateMutation = useMutation({
    mutationFn: (body: { passcode?: string; public_access_enabled?: boolean }) => sdk.client.fetch<Response>("/admin/dev-access", { body, method: "POST" }),
    onError: (error: Error) => toast.error(t("devAccess.saveError"), { description: error.message }),
    onSuccess: (data) => {
      queryClient.setQueryData(["admin-dev-access"], data)
      setPasscode("")
      toast.success(data.settings.public_access_enabled ? t("devAccess.switchedPublic") : t("devAccess.switchedPrivate"))
    },
  })
  const settings = accessQuery.data?.settings
  const isPublic = Boolean(settings?.public_access_enabled)
  const publicUrl = accessQuery.data?.public_storefront_url

  const savePasscode = (event: FormEvent) => {
    event.preventDefault()
    if (passcode.trim()) updateMutation.mutate({ passcode })
  }
  const copyLink = async () => {
    if (!publicUrl) return
    await navigator.clipboard.writeText(publicUrl)
    toast.success(t("devAccess.copySuccess"))
  }

  return (
    <div className="flex max-w-3xl flex-col gap-y-6">
      <div className="flex items-center gap-x-2"><ShieldCheckIcon className="text-ui-fg-interactive" size={20} /><Heading level="h1">{t("devAccess.title")}</Heading></div>
      <Container className="p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div><div className="flex items-center gap-2"><Heading level="h2">{isPublic ? t("devAccess.public") : t("devAccess.private")}</Heading><StatusBadge color={isPublic ? "green" : "orange"}>{isPublic ? t("devAccess.publicBadge") : t("devAccess.privateBadge")}</StatusBadge></div><Text className="mt-1 text-ui-fg-subtle" size="small">{isPublic ? t("devAccess.publicDesc") : t("devAccess.privateDesc")}</Text></div>
          <Button size="small" variant={isPublic ? "secondary" : "primary"} isLoading={accessQuery.isLoading || updateMutation.isPending} disabled={!isPublic && !settings?.has_passcode} onClick={() => updateMutation.mutate({ public_access_enabled: !isPublic })}>{isPublic ? <LockClosedIcon size={14} /> : <LockOpenIcon size={14} />}{isPublic ? t("devAccess.switchToPrivate") : t("devAccess.openPublic")}</Button>
        </div>
      </Container>
      <Container className="p-6"><Heading level="h2">{t("devAccess.publicLinkTitle")}</Heading><Text className="mt-1 text-ui-fg-subtle" size="small">{t("devAccess.publicLinkDesc")}</Text>{publicUrl ? <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-ui-border-base p-3"><Text className="truncate font-mono" size="small">{publicUrl}</Text><Button size="small" variant="secondary" onClick={copyLink}><ClipboardCopyIcon size={14} /> {t("devAccess.copy")}</Button></div> : <Text className="mt-4 text-ui-fg-error" size="small">{t("devAccess.noPublicUrl")}</Text>}</Container>
      <Container className="p-6"><Heading level="h2">{t("devAccess.pinTitle")}</Heading><Text className="mt-1 text-ui-fg-subtle" size="small">{t("devAccess.pinDesc")}</Text><form className="mt-4 flex gap-3" onSubmit={savePasscode}><div className="flex flex-1 flex-col gap-y-2"><Label htmlFor="dev-access-passcode">{t("devAccess.newPin")}</Label><Input id="dev-access-passcode" type="password" value={passcode} minLength={8} placeholder={settings?.has_passcode ? t("devAccess.keepPinPlaceholder") : t("devAccess.pinMinPlaceholder")} onChange={(event) => setPasscode(event.target.value)} /></div><Button className="mt-7" type="submit" size="small" disabled={!passcode.trim()} isLoading={updateMutation.isPending}>{t("devAccess.savePin")}</Button></form></Container>
    </div>
  )
}

export const config = defineRouteConfig({
  icon: ShieldCheckIcon,
  label: "devAccess.navigation",
  translationNs: "translation",
})
export default DevAccessPage
