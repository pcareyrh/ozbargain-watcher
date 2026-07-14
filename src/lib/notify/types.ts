import type { Deal } from "../ozbargain/types"

export type DealAlert = {
  deal: Deal
  deltaVotes: number
  windowMinutes: number
}

export type NtfyTarget = { server: string; topic: string; token?: string }

export interface Notifier {
  notify(alert: DealAlert, target?: NtfyTarget): Promise<void>
}
