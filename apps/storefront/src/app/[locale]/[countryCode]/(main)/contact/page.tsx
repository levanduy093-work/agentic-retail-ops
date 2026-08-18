import { Metadata } from "next"
import { getDictionary } from "@lib/i18n"
import ContactTemplate from "@modules/contact/templates"

export const metadata: Metadata = {
  title: "Liên hệ & Trung tâm Hỗ trợ | Synapse Store",
  description:
    "Liên hệ với đội ngũ CSKH Synapse Store qua Hotline, Email, Trợ lý AI CSKH hoặc ghé thăm hệ thống Showroom.",
}

type Props = {
  params: Promise<{
    locale: string
    countryCode: string
  }>
}

export default async function ContactPage({ params }: Props) {
  const { locale, countryCode } = await params
  const dict = await getDictionary()

  return (
    <ContactTemplate
      dict={dict}
      locale={locale}
      countryCode={countryCode}
    />
  )
}
