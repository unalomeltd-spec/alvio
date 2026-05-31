'use client'
import { useState, useEffect, useRef } from 'react'
import type { AnalyzePayload } from '@/app/api/alvio-analyze/route'

interface AlvioInsightProps {
  payload: Omit<AnalyzePayload, 'indicateurs'> & { indicateurs: Record<string, number> }
}

export default function AlvioInsight({ payload }: AlvioInsightProps) {
  const [analyse, setAnalyse] = useState<string>('')
  const [displayed, setDisplayed] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<'anthropic' | 'local' | 'error'>('local')
  const [visible, setVisible] = useState(false)
  const prevPayloadRef = useRef<string>('')
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch analyse
  useEffect(() => {
    const key = JSON.stringify(payload)
    if (key === prevPayloadRef.current) return
    prevPayloadRef.current = key
    if (!payload.indicateurs || Object.keys(payload.indicateurs).length === 0) {
      setLoading(false)
      return
    }
    setLoading(true)
    setDisplayed('')
    setVisible(false)
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

  // Apparition + effet machine à écrire
  useEffect(() => {
    if (loading || !analyse) return
    const appearTimer = setTimeout(() => {
      setVisible(true)
      let i = 0
      const type = () => {
        if (i <= analyse.length) {
          setDisplayed(analyse.slice(0, i))
          i++
          typingRef.current = setTimeout(type, 18)
        }
      }
      type()
    }, 300)
    return () => {
      clearTimeout(appearTimer)
      if (typingRef.current) clearTimeout(typingRef.current)
    }
  }, [analyse, loading])

  return (
    <div style={{
      marginBottom: 28,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity 0.5s ease, transform 0.5s ease',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{
        background: '#1A1A1A',
        borderRadius: 14,
        padding: '20px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Accent ligne gauche */}
        <div style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: 3,
          background: 'linear-gradient(180deg, #B8A98A 0%, rgba(184,169,138,0.2) 100%)',
          borderRadius: '14px 0 0 14px',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          {/* Avatar */}
          <div style={{
            width: 36, height: 36,
            borderRadius: '50%',
            background: 'rgba(184,169,138,0.15)',
            border: '1px solid rgba(184,169,138,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
              <path d="M14 2C14 2 8 8 8 14C8 18.4 10.6 22.2 14 24C17.4 22.2 20 18.4 20 14C20 8 14 2 14 2Z" fill="#B8A98A"/>
              <circle cx="14" cy="14" r="2.5" fill="#fff"/>
            </svg>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#F2F3F5', letterSpacing: '0.02em' }}>
              Alvio
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: loading ? '#8C9BAB' : '#1D9E75',
                animation: loading ? 'pulse 1.2s ease-in-out infinite' : 'none',
              }} />
              <span style={{ fontSize: 10, color: '#8C9BAB' }}>
                {loading ? 'Analyse en cours' : source === 'anthropic' ? 'CFO Digital · IA' : 'CFO Digital'}
              </span>
            </div>
          </div>

          {source === 'anthropic' && !loading && (
            <div style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', color: '#B8A98A', background: 'rgba(184,169,138,0.1)', border: '0.5px solid rgba(184,169,138,0.25)', borderRadius: 4, padding: '2px 7px', textTransform: 'uppercase' }}>
              Claude
            </div>
          )}
        </div>

        {/* Contenu */}
        <div style={{ paddingLeft: 48 }}>
          {loading ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 20 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'rgba(184,169,138,0.6)',
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          ) : (
            <div style={{
              fontSize: 13,
              color: 'rgba(242,243,245,0.85)',
              lineHeight: 1.7,
              letterSpacing: '0.01em',
            }}>
              {displayed}
              {displayed.length < analyse.length && (
                <span style={{
                  display: 'inline-block',
                  width: 2, height: 14,
                  background: '#B8A98A',
                  marginLeft: 2,
                  verticalAlign: 'middle',
                  animation: 'blink 0.7s step-end infinite',
                }} />
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
