import { ArrowRightMini } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import type { ClientDictionary } from "@lib/i18n/types"

const Hero = ({ product, dict }: { product?: HttpTypes.StoreProduct; dict?: ClientDictionary }) => {
  return (
    <section className="content-container pt-6 small:pt-10">
      <div className="relative isolate grid min-h-[440px] overflow-hidden rounded-[28px] bg-[#dbe7e1] small:grid-cols-[0.92fr_1.08fr]">
        <div className="relative z-[1] flex flex-col justify-center px-7 py-12 small:px-14">
          <p className="mb-4 text-sm font-semibold text-[#315248]">{dict?.hero?.subtitle || "Curated collection"}</p>
          <h1 className="max-w-md text-4xl font-semibold tracking-[-0.06em] text-[#12231d] small:text-6xl small:leading-[0.96]">
            {dict?.hero?.title || "Everyday pieces, thoughtfully chosen."}
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-[#476056]">
            {dict?.hero?.description || "Browse the latest products and build a cart at your own pace."}
          </p>
          <LocalizedClientLink
            href={product?.handle ? `/products/${product.handle}` : "/store"}
            className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-[#174b3d] px-5 py-3 text-sm font-semibold text-white transition-transform hover:bg-[#103a2f] active:scale-[0.98]"
          >
            {product ? (dict?.hero?.view_product || "View featured product") : (dict?.hero?.browse_catalog || "Browse catalog")}
            <ArrowRightMini />
          </LocalizedClientLink>
        </div>
        <div className="relative min-h-[300px] overflow-hidden">
          {product?.thumbnail || product?.images?.[0]?.url ? (
            <Image
              src={product.thumbnail || product.images?.[0]?.url || ""}
              alt={product.title || "Featured product"}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_30%,rgba(255,255,255,.7),transparent_30%),linear-gradient(135deg,#bdcdc5,#e9efeb)]" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#dbe7e1]/70 via-transparent to-transparent" />
        </div>
      </div>
    </section>
  )
}

export default Hero
