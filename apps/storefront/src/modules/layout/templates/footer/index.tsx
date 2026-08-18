import Image from "next/image";
import { listCategories } from "@lib/data/categories";
import { listCollections } from "@lib/data/collections";
import { Text, clx } from "@modules/common/components/ui";

import LocalizedClientLink from "@modules/common/components/localized-client-link";
import MedusaCTA from "@modules/layout/components/medusa-cta";
import { getDictionary } from "@lib/i18n";

export default async function Footer() {
  const [dict, { collections }, productCategories] = await Promise.all([
    getDictionary(),
    listCollections({
      fields: "id,handle,title",
      limit: "6",
    }),
    listCategories({
      fields: "id,handle,name,*category_children,*parent_category",
      limit: 20,
    }),
  ]);

  return (
    <footer className="mt-10 w-full border-t border-[color:var(--line)] bg-white/45">
      <div className="content-container flex flex-col w-full">
        <div className="flex flex-col items-start justify-between gap-y-8 py-16 xsmall:flex-row small:py-24">
          <div>
            <LocalizedClientLink
              href="/"
              className="flex items-center gap-3 text-xl font-bold tracking-[-0.04em] text-[#174b3d] hover:text-[#103a2f]"
            >
              <Image
                src="/logo.png"
                alt="Synapse Store Logo"
                width={40}
                height={40}
                className="h-9 w-auto object-contain"
              />
              <span>Synapse Store</span>
            </LocalizedClientLink>
          </div>
          <div className="text-small-regular gap-10 md:gap-x-12 grid grid-cols-2 sm:grid-cols-4">
            {productCategories && productCategories?.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span className="txt-small-plus txt-ui-fg-base">
                  {dict.footer.categories}
                </span>
                <ul
                  className="grid grid-cols-1 gap-2"
                  data-testid="footer-categories"
                >
                  {productCategories?.slice(0, 6).map((c) => {
                    if (c.parent_category) {
                      return;
                    }

                    const children =
                      c.category_children?.map((child) => ({
                        name: child.name,
                        handle: child.handle,
                        id: child.id,
                      })) || null;

                    return (
                      <li
                        className="flex flex-col gap-2 text-ui-fg-subtle txt-small"
                        key={c.id}
                      >
                        <LocalizedClientLink
                          className={clx(
                            "hover:text-ui-fg-base",
                            children && "txt-small-plus"
                          )}
                          href={`/categories/${c.handle}`}
                          data-testid="category-link"
                        >
                          {dict.footer.category_names[
                            c.handle as keyof typeof dict.footer.category_names
                          ] ?? c.name}
                        </LocalizedClientLink>
                        {children && (
                          <ul className="grid grid-cols-1 ml-3 gap-2">
                            {children &&
                              children.map((child) => (
                                <li key={child.id}>
                                  <LocalizedClientLink
                                    className="hover:text-ui-fg-base"
                                    href={`/categories/${child.handle}`}
                                    data-testid="category-link"
                                  >
                                    {dict.footer.category_names[
                                      child.handle as keyof typeof dict.footer.category_names
                                    ] ?? child.name}
                                  </LocalizedClientLink>
                                </li>
                              ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {collections && collections.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span className="txt-small-plus txt-ui-fg-base">
                  {dict.footer.collections}
                </span>
                <ul className="grid grid-cols-1 gap-2 text-ui-fg-subtle txt-small">
                  {collections?.slice(0, 6).map((c) => (
                    <li key={c.id}>
                      <LocalizedClientLink
                        className="hover:text-ui-fg-base"
                        href={`/collections/${c.handle}`}
                      >
                        {dict.footer.collection_names[
                          c.handle as keyof typeof dict.footer.collection_names
                        ] ?? c.title}
                      </LocalizedClientLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-y-2">
              <span className="txt-small-plus txt-ui-fg-base">
                {dict.footer.customer_support}
              </span>
              <ul className="grid grid-cols-1 gap-y-2 text-ui-fg-subtle txt-small">
                <li>
                  <LocalizedClientLink
                    href="/contact"
                    className="hover:text-ui-fg-base"
                  >
                    {dict.footer.contact}
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink
                    href="/returns"
                    className="hover:text-ui-fg-base"
                  >
                    {dict.footer.returns}
                  </LocalizedClientLink>
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-y-2">
              <span className="txt-small-plus txt-ui-fg-base">{dict.footer.about}</span>
              <ul className="grid grid-cols-1 gap-y-2 text-ui-fg-subtle txt-small">
                <li>
                  <a
                    href="https://github.com/levanduy093-work"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-ui-fg-base"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="https://docs.medusajs.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-ui-fg-base"
                  >
                    {dict.footer.documentation}
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/levanduy093-work/agentic-retail-ops"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-ui-fg-base"
                  >
                    {dict.footer.source_code}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mb-8 flex w-full justify-between border-t border-[color:var(--line)] pt-6 text-ui-fg-muted">
          <Text className="txt-compact-small">
            © {new Date().getFullYear()} Synapse Store. {dict.footer.rights}
          </Text>
          <MedusaCTA label={dict.footer.powered_by} />
        </div>
      </div>
    </footer>
  );
}
