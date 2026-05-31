'use client'
import { useState, useEffect, useRef } from 'react'
import type { AnalyzePayload } from '@/app/api/alvio-analyze/route'

interface AlvioInsightProps {
  payload: Omit<AnalyzePayload, 'indicateurs'> & { indicateurs: Record<string, number> }
  className?: string
}

export default function AlvioInsight({ payload }: AlvioInsightProps) {
  const [analyse, setAnalyse] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<'anthropic' | 'local' | 'error'>('local')
  const [dots, setDots] = useState('.')
  const prevPayloadRef = useRef<string>('')

  // Animation des points pendant le chargement
  useEffect(() => {
    if (!loading) return
    const t = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 400)
    return () => clearInterval(t)
  }, [loading])

  // Appel API quand les indicateurs changent
  useEffect(() => {
    const key = JSON.stringify(payload)
    if (key === prevPayloadRef.current) return
    prevPayloadRef.current = key

    if (!payload.indicateurs || Object.keys(payload.indicateurs).length === 0) {
      setLoading(false)
      return
    }

    setLoading(true)
    fetch('/api/alvio-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(r => r.json())
      .then(data => {
        setAnalyse(data.analyse || '')
        setSource(data.source || 'local')
        setLoading(false)
      })
      .catch(() => {
        setAnalyse('Analyse indisponible.')
        setLoading(false)
      })
  }, [payload])

  if (!analyse && !loading) return null

  return (
    <div style={{
      background: 'rgba(184,169,138,0.06)',
      border: '0.5px solid rgba(184,169,138,0.25)',
      borderRadius: 12,
      padding: '14px 18px',
      marginBottom: 24,
      display: 'flex',
      gap: 14,
      alignItems: 'flex-start',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      {/* Icône */}
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: loading ? 'rgba(184,169,138,0.12)' : '#1A1A1A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: 18,
        transition: 'background 0.3s',
      }}>
        💬
      </div>

      <div style={{ flex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#B8A98A',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            Agent Alvio
          </span>
          {source === 'anthropic' && !loading && (
            <span style={{
              fontSize: 9,
              background: 'rgba(29,158,117,0.1)',
              color: '#1D9E75',
              borderRadius: 4,
              padding: '1px 6px',
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}>
              IA
            </span>
          )}
          {loading && (
            <span style={{
              fontSize: 9,
              background: 'rgba(184,169,138,0.15)',
              color: '#B8A98A',
              borderRadius: 4,
              padding: '1px 6px',
              fontWeight: 600,
            }}>
              Analyse{dots}
            </span>
          )}
        </div>

        {/* Texte */}
        <div style={{
          fontSize: 13,
          color: loading ? '#8C9BAB' : '#1A1A1A',
          lineHeight: 1.65,
          minHeight: 20,
          transition: 'color 0.3s',
        }}>
          {loading
            ? <span style={{ color: '#8C9BAB', fontStyle: 'italic' }}>Alvio analyse vos données{dots}</span>
            : analyse
          }
        </div>
      </div>
    </div>
  )
}
