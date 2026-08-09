import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?q=80&w=800";
const BROKEN_IMAGE_URL = "photo-1625910513413-7fc21e3446ed";

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
    let newThumbnail = product.thumbnail;

    if (!newThumbnail || newThumbnail.includes(BROKEN_IMAGE_URL)) {
      newThumbnail = FALLBACK_IMAGE;
      needsUpdate = true;
    }

    let newImages = (product.images || []).map((img) => {
      if (!img.url || img.url.includes(BROKEN_IMAGE_URL)) {
        needsUpdate = true;
        return { url: FALLBACK_IMAGE };
      }
      return { url: img.url };
    });

    if (newImages.length === 0) {
      newImages = [{ url: FALLBACK_IMAGE }];
      needsUpdate = true;
    }

    if (needsUpdate) {
      await productService.updateProducts(product.id, {
        thumbnail: newThumbnail,
        images: newImages,
      });
      logger.info(`Fixed product thumbnail for: ${product.title} (${product.id})`);
      fixedCount++;
    }
  }

  logger.info(`Done! Fixed ${fixedCount} products.`);
}
