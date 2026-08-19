import { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export default async function testScript({ container }: ExecArgs) {
  const productService = container.resolve(Modules.PRODUCT);
  const products = await productService.listProducts({}, { relations: ["images"], take: 1000 });
  console.log(`Checking ${products.length} products for broken image URLs...`);
  
  const brokenProducts: { id: string; title: string; thumbnail: string | null }[] = [];
  const urlStatusCache = new Map<string, boolean>();

  for (const product of products) {
    const urlsToCheck = [product.thumbnail, ...(product.images?.map(i => i.url) || [])].filter(Boolean) as string[];
    let hasBroken = false;
    for (const url of urlsToCheck) {
      let isOk = urlStatusCache.get(url);
      if (isOk === undefined) {
        try {
          const res = await fetch(url, { method: "HEAD" });
          isOk = res.ok;
        } catch {
          isOk = false;
        }
        urlStatusCache.set(url, isOk);
      }
      if (!isOk) {
        hasBroken = true;
        console.log(`[BROKEN URL] Product: ${product.title} -> ${url}`);
      }
    }
    if (hasBroken) {
      brokenProducts.push({ id: product.id, title: product.title, thumbnail: product.thumbnail });
    }
  }

  console.log(`Total broken products: ${brokenProducts.length} / ${products.length}`);
}


