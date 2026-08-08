import { MedusaContainer } from "@medusajs/framework";
import { Modules } from "@medusajs/framework/utils";

export default async function fixAuth({
  container,
}: {
  container: MedusaContainer;
}) {
  const authModule = container.resolve(Modules.AUTH);
  const authIdentities = await authModule.listAuthIdentities({ provider_identities: { provider: "google-one-tap" }});
  
  console.log(`Found ${authIdentities.length} auth identities.`);
  for (const identity of authIdentities) {
    if (identity.app_metadata && identity.app_metadata.customer_id) {
      console.log(`Deleting auth identity for customer_id ${identity.app_metadata.customer_id}`);
      await authModule.deleteAuthIdentities([identity.id]);
    }
  }
  console.log("Cleanup complete.");
}
