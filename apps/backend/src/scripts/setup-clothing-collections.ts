import { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export default async function setupClothingCollections({ container }: ExecArgs) {
  const productService = container.resolve(Modules.PRODUCT);

  // 1. Get all products
  const products = await productService.listProducts({});
  console.log(`Found ${products.length} products to assign.`);

  // 2. Get existing collections
  let collections = await productService.listProductCollections({});

  // Desired collections for clothing store
  const desiredCollections = [
    { title: "Bán chạy nhất", handle: "ban-chay-nhat" },
    { title: "Khuyến mãi Hot", handle: "khuyen-mai-hot" },
    { title: "Mẫu mới về", handle: "mau-moi-ve" },
    { title: "Sản phẩm nổi bật", handle: "san-pham-noi-bat" },
  ];

  // Update "Thiết bị mới" to "Mẫu mới về" if present
  const thietBiMoi = collections.find((c) => c.handle === "thiet-bi-moi" || c.title === "Thiết bị mới");
  if (thietBiMoi) {
    await productService.updateProductCollections(thietBiMoi.id, {
      title: "Mẫu mới về",
      handle: "mau-moi-ve",
    });
    console.log("Renamed collection 'Thiết bị mới' to 'Mẫu mới về'");
  }

  // Refresh collection list
  collections = await productService.listProductCollections({});

  // Create missing collections
  for (const item of desiredCollections) {
    const exists = collections.find((c) => c.handle === item.handle || c.title === item.title);
    if (!exists) {
      const [created] = await productService.createProductCollections([item]);
      console.log(`Created collection: ${created.title}`);
    }
  }

  // Refresh collection list
  collections = await productService.listProductCollections({});

  // Assign products to collections across all 4 collections
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const targetCollection = collections[i % collections.length];
    if (product && targetCollection) {
      await productService.updateProducts(product.id, {
        collection_id: targetCollection.id,
      });
      console.log(`Assigned ${product.title} to collection '${targetCollection.title}'`);
    }
  }

  console.log("Successfully assigned products to collections!");
}
