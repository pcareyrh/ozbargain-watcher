import type { Deal } from "../ozbargain/types";

export type DealAlert = {
  deal: Deal;
  deltaVotes: number;
  windowMinutes: number;
};

export interface Notifier {
  notify(alert: DealAlert): Promise<void>;
}
