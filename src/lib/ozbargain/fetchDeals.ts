import { XMLParser } from "fast-xml-parser";
import type { Deal, DealTag } from "./types";

const FEED_URL = "https://www.ozbargain.com.au/deals/feed";
const USER_AGENT = "ozbargain-watcher/1.0 (+https://github.com/ozbargain-watcher)";

type RssCategory = {
  "#text"?: string;
  "@_domain"?: string;
};

type RssMeta = {
  "@_votes-pos"?: string;
  "@_votes-neg"?: string;
  "@_comment-count"?: string;
  "@_click-count"?: string;
  "@_url"?: string;
  "@_image"?: string;
  "@_link"?: string;
};

type RssItem = {
  title?: string;
  link?: string;
  guid?: string | { "#text"?: string };
  pubDate?: string;
  category?: RssCategory | RssCategory[];
  "ozb:meta"?: RssMeta;
  "media:thumbnail"?: { "@_url"?: string };
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseIntSafe(value: string | undefined, fallback = 0): number {
  if (value === undefined || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function extractDealId(item: RssItem): string | null {
  const link = item.link ?? "";
  const fromLink = link.match(/\/node\/(\d+)/);
  if (fromLink) return fromLink[1];

  const guid =
    typeof item.guid === "string" ? item.guid : (item.guid?.["#text"] ?? "");
  const fromGuid = guid.match(/^(\d+)\b/);
  if (fromGuid) return fromGuid[1];

  return null;
}

function classifyDomain(domain: string | undefined): DealTag["kind"] | "cat" {
  if (!domain) return "other";
  if (domain.includes("/cat/")) return "cat";
  if (domain.includes("/tag/")) return "tag";
  if (domain.includes("/brand/")) return "brand";
  if (domain.includes("/product/")) return "product";
  if (domain.includes("/event/")) return "event";
  return "other";
}

function slugFromDomain(domain: string | undefined): string | null {
  if (!domain) return null;
  const match = domain.match(/\/(?:cat|tag|brand|product|event)\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function mapItem(item: RssItem): Deal | null {
  const id = extractDealId(item);
  if (!id) return null;

  const meta = item["ozb:meta"] ?? {};
  const categories = asArray(item.category);

  let categorySlug: string | null = null;
  let categoryLabel: string | null = null;
  const tags: DealTag[] = [];

  for (const cat of categories) {
    const label = cat["#text"] ?? "";
    const domain = cat["@_domain"];
    const kind = classifyDomain(domain);
    const slug = slugFromDomain(domain);

    if (kind === "cat") {
      if (!categorySlug) {
        categorySlug = slug;
        categoryLabel = label || slug;
      }
      continue;
    }

    if (slug) {
      tags.push({
        slug,
        label: label || slug,
        kind,
      });
    }
  }

  return {
    id,
    title: item.title ?? `Deal ${id}`,
    url: item.link ?? `https://www.ozbargain.com.au/node/${id}`,
    storeUrl: meta["@_url"] ?? null,
    votesPos: parseIntSafe(meta["@_votes-pos"]),
    votesNeg: parseIntSafe(meta["@_votes-neg"]),
    comments: parseIntSafe(meta["@_comment-count"]),
    clicks: parseIntSafe(meta["@_click-count"]),
    categorySlug,
    categoryLabel,
    tags,
    publishedAt: item.pubDate ?? null,
    image: meta["@_image"] ?? item["media:thumbnail"]?.["@_url"] ?? null,
  };
}

export async function fetchDeals(feedUrl = FEED_URL): Promise<Deal[]> {
  const response = await fetch(feedUrl, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
    next: { revalidate: 0 },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OzBargain feed fetch failed: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });

  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: RssItem | RssItem[] } };
  };

  const items = asArray(parsed.rss?.channel?.item);
  const deals: Deal[] = [];

  for (const item of items) {
    const deal = mapItem(item);
    if (deal) deals.push(deal);
  }

  return deals;
}

/** Pure parser helper for tests — parse RSS XML string into deals. */
export function parseDealsXml(xml: string): Deal[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: RssItem | RssItem[] } };
  };
  return asArray(parsed.rss?.channel?.item)
    .map(mapItem)
    .filter((d): d is Deal => d !== null);
}
