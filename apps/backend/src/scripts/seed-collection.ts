import { Modules } from "@medusajs/framework/utils";
import { ExecArgs } from "@medusajs/framework/types";

export default async function seedCollection({ container }: ExecArgs) {
  const productService = container.resolve(Modules.PRODUCT);

  // Create Collection
  const collection = await productService.createProductCollections([
    {
      title: "Summer Collection",
      handle: "summer",
    },
  ]);
  
  const colId = collection[0].id;
  console.log("Created collection:", colId);

  // Get products
  const products = await productService.listProducts({});
  console.log("Products found:", products.length);

  // Update products
  if (products.length > 0) {
    const productUpdates = products.map((p) => ({
      id: p.id,
      collection_id: colId,
    }));
    await productService.updateProducts(productUpdates);
    console.log("Assigned products to collection");
  }
}
