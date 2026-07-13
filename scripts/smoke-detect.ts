import assert from "node:assert/strict";
import { detectHotDeals } from "../src/lib/watch/detectHotDeals";
import { filterByCategory } from "../src/lib/watch/filterByCategory";
import type { Deal } from "../src/lib/ozbargain/types";
import type { DealSnapshot } from "../src/lib/store/snapshots";

function deal(partial: Partial<Deal> & Pick<Deal, "id" | "votesPos">): Deal {
  return {
    title: partial.title ?? `Deal ${partial.id}`,
    url: partial.url ?? `https://www.ozbargain.com.au/node/${partial.id}`,
    storeUrl: null,
    votesNeg: 0,
    comments: 0,
    clicks: 0,
    categorySlug: partial.categorySlug ?? "computing",
    categoryLabel: partial.categoryLabel ?? "Computing",
    tags: [],
    publishedAt: null,
    image: null,
    ...partial,
  };
}

const now = Date.now();
const config = { voteDelta: 15, windowMinutes: 45, cooldownHours: 6 };

const hotDeal = deal({ id: "1", votesPos: 40, categorySlug: "computing" });
const coldDeal = deal({ id: "2", votesPos: 10, categorySlug: "gaming" });

const snapshots = new Map<string, DealSnapshot>([
  [
    "1",
    {
      id: "1",
      title: hotDeal.title,
      url: hotDeal.url,
      categorySlug: "computing",
      updatedAt: now,
      history: [
        { at: now - 40 * 60 * 1000, votesPos: 20 },
        { at: now - 2 * 60 * 1000, votesPos: 35 },
        { at: now, votesPos: 40 },
      ],
    },
  ],
  [
    "2",
    {
      id: "2",
      title: coldDeal.title,
      url: coldDeal.url,
      categorySlug: "gaming",
      updatedAt: now,
      history: [
        { at: now - 40 * 60 * 1000, votesPos: 5 },
        { at: now, votesPos: 10 },
      ],
    },
  ],
]);

const hot = detectHotDeals([hotDeal, coldDeal], snapshots, config, now);
assert.equal(hot.length, 1);
assert.equal(hot[0].deal.id, "1");
assert.equal(hot[0].deltaVotes, 20);

const filtered = filterByCategory([hotDeal, coldDeal], ["gaming"]);
assert.equal(filtered.length, 1);
assert.equal(filtered[0].id, "2");

const all = filterByCategory([hotDeal, coldDeal], []);
assert.equal(all.length, 2);

console.log("ok: detector + category filter");
