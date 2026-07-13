import { fetchDeals } from "../src/lib/ozbargain/fetchDeals";
import { runWatchCycle } from "../src/lib/watch/runWatchCycle";

async function main() {
  const deals = await fetchDeals();
  console.log("fetched", deals.length, "deals");
  console.log(
    "sample",
    deals[0]?.id,
    deals[0]?.categorySlug,
    deals[0]?.votesPos,
    deals[0]?.title?.slice(0, 60),
  );

  const r1 = await runWatchCycle();
  console.log("run1", {
    checked: r1.checked,
    hot: r1.hot.length,
    alerted: r1.alerted.length,
    backend: r1.backend,
  });

  const r2 = await runWatchCycle();
  console.log("run2", {
    checked: r2.checked,
    hot: r2.hot.length,
    alerted: r2.alerted.length,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
