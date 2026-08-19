import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

const URL_REPLACEMENTS: Record<string, string> = {
  "517838277536-f5f99be5019f": "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=85",
  "625910513413-5fc85b5d4f31": "https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=1200&q=85",
  "1506629905607-d405b7a30dbf": "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=85",
  "photo-1625910513413-7fc21e3446ed": "https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=1200&q=85",
};

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=85";

function fixUrl(url?: string | null): string {
  if (!url) return FALLBACK_IMAGE;
  for (const [brokenKey, fixedUrl] of Object.entries(URL_REPLACEMENTS)) {
    if (url.includes(brokenKey)) {
      return fixedUrl;
    }
  }
  return url;
}

export default async function fixBrokenThumbnails({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productService = container.resolve(Modules.PRODUCT);

  logger.info("Scanning products for broken thumbnail URLs...");

  const products = await productService.listProducts({}, { relations: ["images"], take: 1000 });
  let fixedCount = 0;

  for (const product of products) {
    let needsUpdate = false;
    const oldThumbnail = product.thumbnail;
    const newThumbnail = fixUrl(oldThumbnail);

    if (newThumbnail !== oldThumbnail) {
      needsUpdate = true;
    }

    const newImages = (product.images || []).map((img) => {
      const fixed = fixUrl(img.url);
      if (fixed !== img.url) {
        needsUpdate = true;
      }
      return { url: fixed };
    });

    if (newImages.length === 0) {
      newImages.push({ url: newThumbnail });
      needsUpdate = true;
    }

    if (needsUpdate) {
      await productService.updateProducts(product.id, {
        thumbnail: newThumbnail,
        images: newImages,
      });
      logger.info(`Fixed product images for: ${product.title} (${product.id})`);
      fixedCount++;
    }
  }

  logger.info(`Done! Fixed ${fixedCount} products.`);
}

