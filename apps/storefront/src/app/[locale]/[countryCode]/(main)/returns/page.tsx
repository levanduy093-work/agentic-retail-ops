import { Metadata } from "next"
import { getDictionary } from "@lib/i18n"
import ReturnsTemplate from "@modules/returns/templates"

export const metadata: Metadata = {
  title: "Chính sách & Cổng Đổi trả hàng | Synapse Store",
  description:
    "Chính sách đổi trả hàng 7 ngày dễ dàng, quy trình thu hồi tận nơi và gửi yêu cầu đổi size / trả hàng hoàn tiền trực tuyến.",
}

type Props = {
  params: Promise<{
    locale: string
    countryCode: string
  }>
}

export default async function ReturnsPage({ params }: Props) {
  const { locale, countryCode } = await params
  const dict = await getDictionary()

  return (
    <ReturnsTemplate
      dict={dict}
      locale={locale}
      countryCode={countryCode}
    />
  )
}
