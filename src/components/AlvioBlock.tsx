'use client'
// ─────────────────────────────────────────────────────────────────────────
// src/components/AlvioBlock.tsx — Conteneur visuel commun Alvio
//
// Encapsule : fond blanc, bordure gauche champagne, header avatar/dot/badge,
// typewriter sur le texte, dots de chargement.
// Utilisé par AlvioInsight, SanteBriefing — et toute future page.
// Pour la V2 LLM : seul AlvioInsight change (source du texte), ce composant
// et SanteBriefing restent intacts.
// ─────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'

interface AlvioBlockProps {
  /** Texte final à afficher avec effet typewriter */
  text: string
  /** true = affiche les dots de chargement au lieu du texte */
  loading?: boolean
  /** Texte affiché sous le nom (ex. "CFO Digital · IA", "CFO Digital") */
  statusLabel?: string
  /** Badge optionnel affiché à droite du header (ex. "Claude") */
  badge?: string
  /** Marge basse du bloc (défaut : 24px) */
  marginBottom?: number
  /** Contenu additionnel affiché sous le texte (ex. ligne fraîcheur) */
  footer?: React.ReactNode
}

export default function AlvioBlock({
  text,
  loading = false,
  statusLabel = 'CFO Digital',
  badge,
  marginBottom = 24,
  footer,
}: AlvioBlockProps) {
  const [displayed, setDisplayed] = useState('')
  const [visible, setVisible] = useState(false)
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevText = useRef('')

  // Apparition + typewriter dès que le texte change
  useEffect(() => {
    if (loading || !text || text === prevText.current) return
    prevText.current = text
    setDisplayed('')
    setVisible(false)
    if (typingRef.current) clearTimeout(typingRef.current)

    const appearTimer = setTimeout(() => {
      setVisible(true)
      let i = 0
      const type = () => {
        if (i <= text.length) {
          setDisplayed(text.slice(0, i))
          i++
          typingRef.current = setTimeout(type, 16)
        }
      }
      type()
    }, 200)

    return () => {
      clearTimeout(appearTimer)
      if (typingRef.current) clearTimeout(typingRef.current)
    }
  }, [text, loading])

  // Apparition immédiate quand loading passe à false
  useEffect(() => {
    if (!loading) setVisible(true)
  }, [loading])

  return (
    <div style={{
      marginBottom,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity 0.5s ease, transform 0.5s ease',
    }}>
      <div style={{
        background: '#fff',
        border: '0.5px solid rgba(184,169,138,0.3)',
        borderLeft: '3px solid #B8A98A',
        borderRadius: '0 12px 12px 0',
        padding: '16px 20px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(184,169,138,0.12)',
            border: '0.5px solid rgba(184,169,138,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="15" height="15" viewBox="0 0 28 28" fill="none">
              <path d="M14 2C14 2 8 8 8 14C8 18.4 10.6 22.2 14 24C17.4 22.2 20 18.4 20 14C20 8 14 2 14 2Z" fill="#B8A98A"/>
              <circle cx="14" cy="14" r="2.5" fill="#fff"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', letterSpacing: '0.02em' }}>Alvio</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: loading ? '#8C9BAB' : '#1D9E75',
                animation: loading ? 'alvio-pulse 1.2s ease-in-out infinite' : 'none',
              }} />
              <span style={{ fontSize: 10, color: '#8C9BAB' }}>
                {loading ? 'Analyse en cours…' : statusLabel}
              </span>
            </div>
          </div>
          {badge && (
            <div style={{
              marginLeft: 'auto', fontSize: 9, fontWeight: 600,
              letterSpacing: '0.06em', color: '#B8A98A',
              background: 'rgba(184,169,138,0.1)',
              border: '0.5px solid rgba(184,169,138,0.25)',
              borderRadius: 4, padding: '2px 7px',
              textTransform: 'uppercase' as const,
            }}>
              {badge}
            </div>
          )}
        </div>

        {/* Contenu */}
        {loading ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 20 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'rgba(184,169,138,0.5)',
                animation: `alvio-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 1.7, letterSpacing: '0.01em' }}>
              {displayed}
              {displayed.length < text.length && (
                <span style={{
                  display: 'inline-block', width: 2, height: 14,
                  background: '#B8A98A', marginLeft: 2,
                  verticalAlign: 'middle',
                  animation: 'alvio-blink 0.7s step-end infinite',
                }} />
              )}
            </div>
            {footer && (
              <div style={{ fontSize: 11, color: '#8C9BAB', marginTop: 10, paddingTop: 10, borderTop: '0.5px solid rgba(0,0,0,0.05)' }}>
                {footer}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes alvio-pulse  { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes alvio-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
        @keyframes alvio-blink  { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  )
}
