import { isKnownCategorySlug } from "@/lib/ozbargain/categories"

type CategoryAllowlistInput = {
  categoryAllowlist?: unknown
  monitorAll?: unknown
}

type ParseCategoryAllowlistResult =
  | { ok: true; categoryAllowlist: string[] }
  | { ok: false; error: string }

export function parseCategoryAllowlist(
  input: CategoryAllowlistInput,
): ParseCategoryAllowlistResult {
  if (input.monitorAll === true) {
    return { ok: true, categoryAllowlist: [] }
  }

  if (input.categoryAllowlist === undefined) {
    if (input.monitorAll === false) {
      return {
        ok: false,
        error: "Select at least one category, or enable monitorAll.",
      }
    }
    return { ok: true, categoryAllowlist: [] }
  }

  if (!Array.isArray(input.categoryAllowlist)) {
    return { ok: false, error: "categoryAllowlist must be an array of strings" }
  }

  const slugs: string[] = []
  for (const item of input.categoryAllowlist) {
    if (typeof item !== "string" || !item.trim()) {
      return {
        ok: false,
        error: "categoryAllowlist entries must be non-empty strings",
      }
    }
    const slug = item.trim().toLowerCase()
    if (!isKnownCategorySlug(slug)) {
      return { ok: false, error: `Unknown category slug: ${slug}` }
    }
    if (!slugs.includes(slug)) slugs.push(slug)
  }

  if (slugs.length === 0) {
    if (input.monitorAll === false) {
      return {
        ok: false,
        error: "Select at least one category, or enable monitorAll.",
      }
    }
    return { ok: true, categoryAllowlist: [] }
  }

  return { ok: true, categoryAllowlist: slugs }
}
