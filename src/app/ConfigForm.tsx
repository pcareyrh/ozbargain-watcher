"use client";

import { useState } from "react";
import type { WatcherConfig } from "@/lib/config";
import type { OzBargainCategory } from "@/lib/ozbargain/categories";

type Props = {
  initialConfig: WatcherConfig;
  categories: readonly OzBargainCategory[];
};

export function ConfigForm({ initialConfig, categories }: Props) {
  const [secret, setSecret] = useState("");
  const [voteDelta, setVoteDelta] = useState(String(initialConfig.voteDelta));
  const [windowMinutes, setWindowMinutes] = useState(
    String(initialConfig.windowMinutes),
  );
  const [cooldownHours, setCooldownHours] = useState(
    String(initialConfig.cooldownHours),
  );
  const [monitorAll, setMonitorAll] = useState(
    initialConfig.categoryAllowlist.length === 0,
  );
  const [allowlist, setAllowlist] = useState<string[]>(
    initialConfig.categoryAllowlist.length === 0
      ? categories.map((c) => c.slug)
      : initialConfig.categoryAllowlist,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleCategory(slug: string) {
    setAllowlist((current) =>
      current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const categoryAllowlist = monitorAll ? [] : allowlist;
    if (!monitorAll && categoryAllowlist.length === 0) {
      setError("Select at least one category, or enable All categories.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
        },
        body: JSON.stringify({
          voteDelta: Number(voteDelta),
          windowMinutes: Number(windowMinutes),
          cooldownHours: Number(cooldownHours),
          categoryAllowlist,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }

      setVoteDelta(String(data.config.voteDelta));
      setWindowMinutes(String(data.config.windowMinutes));
      setCooldownHours(String(data.config.cooldownHours));
      const next = data.config.categoryAllowlist ?? [];
      setMonitorAll(next.length === 0);
      setAllowlist(
        next.length === 0 ? categories.map((c) => c.slug) : next,
      );
      setMessage("Saved. Changes apply on the next watch run.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function onReset() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/config", {
        method: "DELETE",
        headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to reset");
        return;
      }
      setVoteDelta(String(data.config.voteDelta));
      setWindowMinutes(String(data.config.windowMinutes));
      setCooldownHours(String(data.config.cooldownHours));
      const next = data.config.categoryAllowlist ?? [];
      setMonitorAll(next.length === 0);
      setAllowlist(
        next.length === 0 ? categories.map((c) => c.slug) : next,
      );
      setMessage("Cleared Redis overrides; using env/defaults.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <h2>Alert settings</h2>
      <p className="muted">
        Protected by <code>CRON_SECRET</code> / <code>ADMIN_SECRET</code>. Empty
        allowlist means all categories.
      </p>

      <label>
        Admin secret
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Bearer secret"
          autoComplete="off"
        />
      </label>

      <div className="grid3">
        <label>
          Vote delta (&gt;)
          <input
            type="number"
            min={1}
            step={1}
            value={voteDelta}
            onChange={(e) => setVoteDelta(e.target.value)}
            required
          />
        </label>
        <label>
          Window (minutes)
          <input
            type="number"
            min={1}
            step={1}
            value={windowMinutes}
            onChange={(e) => setWindowMinutes(e.target.value)}
            required
          />
        </label>
        <label>
          Cooldown (hours)
          <input
            type="number"
            min={1}
            step={1}
            value={cooldownHours}
            onChange={(e) => setCooldownHours(e.target.value)}
            required
          />
        </label>
      </div>

      <fieldset>
        <legend>Category allowlist</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={monitorAll}
            onChange={(e) => setMonitorAll(e.target.checked)}
          />
          All categories
        </label>
        <div className={`checks ${monitorAll ? "dimmed" : ""}`}>
          {categories.map((cat) => (
            <label key={cat.slug} className="check">
              <input
                type="checkbox"
                checked={allowlist.includes(cat.slug)}
                disabled={monitorAll}
                onChange={() => toggleCategory(cat.slug)}
              />
              {cat.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="row">
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={saving}
          onClick={onReset}
        >
          Reset overrides
        </button>
      </div>

      {message && <p className="ok">{message}</p>}
      {error && <p className="err">{error}</p>}
    </form>
  );
}
