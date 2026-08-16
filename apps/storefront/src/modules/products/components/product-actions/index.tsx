"use client"

import { addToCart } from "@lib/data/cart"
import { useIntersection } from "@lib/hooks/use-in-view"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import Divider from "@modules/common/components/divider"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { isEqual } from "lodash"
import { useParams, usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import ProductPrice from "../product-price"
import MobileActions from "./mobile-actions"
import { useRouter } from "next/navigation"
import { useTranslation } from "@lib/i18n/client"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt) => {
    if (varopt.option_id) acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}

const isVariantPurchasable = (variant: HttpTypes.StoreProductVariant) => {
  return (
    !variant.manage_inventory ||
    Boolean(variant.allow_backorder) ||
    (variant.inventory_quantity ?? 0) > 0
  )
}

export default function ProductActions({
  product,
  disabled,
}: ProductActionsProps) {
  const t = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const countryCode = useParams().countryCode as string

  // If there is only 1 variant, preselect the options
  useEffect(() => {
    if (product.variants?.length === 1) {
      const variantOptions = optionsAsKeymap(product.variants[0].options)
      setOptions(variantOptions ?? {})
    }
  }, [product.variants])

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }

    return product.variants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  // update the options when a variant is selected
  const setOptionValue = (optionId: string, value: string) => {
    setOptions((prev) => ({
      ...prev,
      [optionId]: value,
    }))
  }

  //check if the selected options produce a valid variant
  const isValidVariant = useMemo(() => {
    return product.variants?.some((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  const optionAvailability = useMemo(() => {
    return (product.options || []).reduce<
      Record<string, Record<string, boolean>>
    >((availability, option) => {
      availability[option.id] = (option.values || []).reduce<
        Record<string, boolean>
      >((values, optionValue) => {
        const candidateOptions = {
          ...options,
          [option.id]: optionValue.value,
        }

        values[optionValue.value] = (product.variants || []).some((variant) => {
          const variantOptions = optionsAsKeymap(variant.options)

          return (
            isVariantPurchasable(variant) &&
            Object.entries(candidateOptions).every(
              ([optionId, value]) =>
                value === undefined || variantOptions?.[optionId] === value
            )
          )
        })

        return values
      }, {})

      return availability
    }, {})
  }, [options, product.options, product.variants])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    const value = isValidVariant ? selectedVariant?.id : null

    if (params.get("v_id") === value) {
      return
    }

    if (value) {
      params.set("v_id", value)
    } else {
      params.delete("v_id")
    }

    router.replace(pathname + "?" + params.toString())
  }, [isValidVariant, pathname, router, searchParams, selectedVariant])

  // check if the selected variant is in stock
  const inStock = useMemo(
    () => Boolean(selectedVariant && isVariantPurchasable(selectedVariant)),
    [selectedVariant]
  )

  const actionsRef = useRef<HTMLDivElement>(null)

  const inView = useIntersection(actionsRef, "0px")

  // add the selected variant to the cart
  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null

    setIsAdding(true)
    setAddError(null)

    try {
      await addToCart({
        variantId: selectedVariant.id,
        quantity: 1,
        countryCode,
      })
    } catch (error) {
      console.error("Failed to add product to cart", error)
      setAddError(
        error instanceof Error ? error.message : t("product.add_to_cart_error")
      )
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <>
      <div className="surface-card flex flex-col gap-y-4 p-5" ref={actionsRef}>
        <div>
          {(product.variants?.length ?? 0) > 1 && (
            <div className="flex flex-col gap-y-4">
              {(product.options || []).map((option) => {
                return (
                  <div key={option.id}>
                    <OptionSelect
                      option={option}
                      current={options[option.id]}
                      updateOption={setOptionValue}
                      title={option.title ?? ""}
                      availability={optionAvailability[option.id]}
                      data-testid="product-options"
                      disabled={!!disabled || isAdding}
                    />
                  </div>
                )
              })}
              <Divider />
            </div>
          )}
        </div>

        <ProductPrice product={product} variant={selectedVariant} />

        <Button
          onClick={handleAddToCart}
          disabled={
            !inStock ||
            !selectedVariant ||
            !!disabled ||
            isAdding ||
            !isValidVariant
          }
          variant="primary"
          className="h-12 w-full"
          isLoading={isAdding}
          data-testid="add-product-button"
        >
          {!selectedVariant
            ? t("product.select_variant")
            : !inStock || !isValidVariant
            ? t("product.out_of_stock")
            : t("product.add_to_cart")}
        </Button>
        {addError && (
          <p className="text-sm text-red-600" role="alert">
            {addError}
          </p>
        )}
        <MobileActions
          product={product}
          variant={selectedVariant}
          options={options}
          updateOptions={setOptionValue}
          optionAvailability={optionAvailability}
          inStock={inStock}
          handleAddToCart={handleAddToCart}
          isAdding={isAdding}
          show={!inView}
          optionsDisabled={!!disabled || isAdding}
        />
      </div>
    </>
  )
}
