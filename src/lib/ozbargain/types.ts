export type DealTag = {
  slug: string;
  label: string;
  kind: "tag" | "brand" | "product" | "event" | "other";
};

export type Deal = {
  id: string;
  title: string;
  url: string;
  storeUrl: string | null;
  votesPos: number;
  votesNeg: number;
  comments: number;
  clicks: number;
  categorySlug: string | null;
  categoryLabel: string | null;
  tags: DealTag[];
  publishedAt: string | null;
  image: string | null;
};
