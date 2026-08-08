import { MedusaContainer } from "@medusajs/framework";
export default async function run({ container }: { container: MedusaContainer }) {
  console.log(container.cradle);
}
