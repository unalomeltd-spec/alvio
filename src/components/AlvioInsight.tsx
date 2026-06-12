'use client'
// ─────────────────────────────────────────────────────────────────────────
// src/components/AlvioInsight.tsx
//
// Appelle /api/alvio-analyze pour obtenir le texte d'analyse,
// puis délègue tout le rendu à AlvioBlock.
// V2 : pour brancher un LLM, seule la route /api/alvio-analyze change.
// ─────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'
import AlvioBlock from '@/components/AlvioBlock'
import type { AnalyzePayload } from '@/app/api/alvio-analyze/route'

interface AlvioInsightProps {
  payload: Omit<AnalyzePayload, 'indicateurs'> & { indicateurs: Record<string, number> }
}

export default function AlvioInsight({ payload }: AlvioInsightProps) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const prevPayloadRef = useRef('')

  useEffect(() => {
    const key = JSON.stringify(payload)
    if (key === prevPayloadRef.current) return
    prevPayloadRef.current = key
    if (!payload.indicateurs || Object.keys(payload.indicateurs).length === 0) {
      setLoading(false)
      return
    }
    setLoading(true)
    setText('')
    fetch('/api/alvio-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(r => r.json())
      .then(data => { setText(data.analyse || ''); setLoading(false) })
      .catch(() => { setText('Analyse indisponible.'); setLoading(false) })
  }, [payload])

  return <AlvioBlock text={text} loading={loading} statusLabel="CFO Digital" marginBottom={24} />
}
