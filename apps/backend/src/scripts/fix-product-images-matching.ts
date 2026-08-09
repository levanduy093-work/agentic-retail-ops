import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

const IMAGE_CATALOG = {
  ao: [
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=800", // T-shirt white
    "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?q=80&w=800", // T-shirt black
    "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?q=80&w=800", // Polo/Shirt black
    "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?q=80&w=800", // Sweater/Hoodie
    "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=800", // Shirt folded
    "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=800", // Jacket
    "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=800", // Leather jacket
    "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png",
    "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png"
  ],
  quan: [
    "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=800", // Jeans
    "https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?q=80&w=800", // Pants
    "https://images.unsplash.com/photo-1604176354204-9268737828e4?q=80&w=800", // Jeans
    "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatpants-gray-front.png",
    "https://medusa-public-images.s3.eu-west-1.amazonaws.com/shorts-vintage-front.png"
  ],
  vay: [
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800", // Fashion dress
    "https://images.unsplash.com/photo-1496747611176-843222e1e57c?q=80&w=800", // Floral dress
    "https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=800", // Dress
    "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=800"  // Dress
  ],
  phukien: [
    "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?q=80&w=800", // Cap
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=800", // Bag
    "https://images.unsplash.com/photo-1527719327859-c6ce80353573?q=80&w=800"  // Sportswear
  ]
};

function getCategoryImages(title: string): string[] {
  const lower = title.toLowerCase();

  if (lower.includes("shorts")) return ["https://medusa-public-images.s3.eu-west-1.amazonaws.com/shorts-vintage-front.png"];
  if (lower.includes("sweatshirt")) return ["https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png"];
  if (lower.includes("sweatpants")) return ["https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatpants-gray-front.png"];
  if (lower.includes("t-shirt") || lower.includes("tee")) return ["https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png"];

  if (
    lower.startsWith("quần") ||
    lower.includes("quần") ||
    lower.includes("jeans") ||
    lower.includes("jogger") ||
    lower.includes("kaki")
  ) {
    return IMAGE_CATALOG.quan;
  }

  if (
    lower.startsWith("chân váy") ||
    lower.includes("váy") ||
    lower.includes("đầm")
  ) {
    return IMAGE_CATALOG.vay;
  }

  if (
    lower.includes("thể thao") ||
    lower.includes("nón") ||
    lower.includes("mũ") ||
    lower.includes("túi")
  ) {
    return IMAGE_CATALOG.phukien;
  }

  // Default to shirts/tops for Áo
  return IMAGE_CATALOG.ao;
}

export default async function fixProductImagesMatching({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const productService = container.resolve(Modules.PRODUCT);

  logger.info("Re-assigning product images according to category (Áo, Quần, Váy, Phụ kiện)...");

  const products = await productService.listProducts({}, { relations: ["images"], take: 1000 });
  let updatedCount = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const pool = getCategoryImages(product.title);

    const primaryImg = pool[i % pool.length];
    const secondaryImg = pool[(i + 1) % pool.length];

    const newThumbnail = primaryImg;
    const newImages = [{ url: primaryImg }, { url: secondaryImg }];

    await productService.updateProducts(product.id, {
      thumbnail: newThumbnail,
      images: newImages,
    });

    updatedCount++;
    logger.info(`[${updatedCount}/${products.length}] Updated '${product.title}' -> thumbnail: ${newThumbnail}`);
  }

  logger.info(`Successfully updated matching images for ${updatedCount} products!`);
}
