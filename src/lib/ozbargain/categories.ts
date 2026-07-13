export type OzBargainCategory = {
  slug: string;
  label: string;
};

/** Top-level OzBargain /cat/ slugs for the status-page allowlist UI. */
export const OZBARGAIN_CATEGORIES: readonly OzBargainCategory[] = [
  { slug: "automotive", label: "Automotive" },
  { slug: "books-magazines", label: "Books & Magazines" },
  { slug: "computing", label: "Computing" },
  { slug: "dining-takeaway", label: "Dining & Takeaway" },
  { slug: "electrical-electronics", label: "Electrical & Electronics" },
  { slug: "gaming", label: "Gaming" },
  { slug: "groceries", label: "Groceries" },
  { slug: "health-beauty", label: "Health & Beauty" },
  { slug: "home-garden", label: "Home & Garden" },
  { slug: "mobile", label: "Mobile" },
  { slug: "other", label: "Other" },
  { slug: "toys-kids", label: "Toys & Kids" },
  { slug: "travel", label: "Travel" },
] as const;

export const KNOWN_CATEGORY_SLUGS = new Set(
  OZBARGAIN_CATEGORIES.map((c) => c.slug),
);

export function isKnownCategorySlug(slug: string): boolean {
  return KNOWN_CATEGORY_SLUGS.has(slug);
}
