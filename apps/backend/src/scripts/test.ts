import { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export default async function testScript({ container }: ExecArgs) {
  const productService = container.resolve(Modules.PRODUCT);
  const products = await productService.listProducts({}, { take: 1000 });
  console.log(`=== TOTAL PRODUCTS IN DB: ${products.length} ===`);
  const collections = await productService.listProductCollections({}, { relations: ["products"], take: 1000 });
  console.log("=== COLLECTIONS ===");
  for (const c of collections) {
    console.log(`Collection: ${c.title} (${c.handle}) - Products count: ${c.products?.length || 0}`);
  }
}
