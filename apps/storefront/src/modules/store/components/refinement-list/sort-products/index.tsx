"use client"

import FilterRadioGroup from "@modules/common/components/filter-radio-group"
import { useTranslation } from "@lib/i18n/client"

export type SortOptions = "price_asc" | "price_desc" | "created_at"

type SortProductsProps = {
  sortBy: SortOptions
  setQueryParams: (name: string, value: string) => void
  "data-testid"?: string
}

const SortProducts = ({
  "data-testid": dataTestId,
  sortBy,
  setQueryParams,
}: SortProductsProps) => {
  const t = useTranslation()

  const sortOptions = [
    {
      value: "created_at",
      label: t("store.created_at"),
    },
    {
      value: "price_asc",
      label: t("store.price_asc"),
    },
    {
      value: "price_desc",
      label: t("store.price_desc"),
    },
  ]

  const handleChange = (value: string) => {
    setQueryParams("sortBy", value as SortOptions)
  }

  return (
    <FilterRadioGroup
      title={t("store.sort_by")}
      items={sortOptions}
      value={sortBy}
      handleChange={handleChange}
      data-testid={dataTestId}
    />
  )
}

export default SortProducts
