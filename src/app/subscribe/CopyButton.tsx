"use client"

import { useState } from "react"

type Props = {
  value: string
  label: string
}

export function CopyButton({ value, label }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      className="secondary"
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  )
}
