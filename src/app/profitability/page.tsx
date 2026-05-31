'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtPct = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + ' %'
export default function ProfitabilityPage() {
  const [loading, setLoading] = useState(true)
  const [ind, setInd] = useState<any>(null)
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const { data } = await supabase.from('fec_exercices').select('annee, ecritures').eq('user_id', user.id).order('annee', { ascending: false }).limit(1)
      if (data && data[0]) {
        const lignes = data[0].ecritures as Array<{ CompteNum: string; Debit: number; Credit: number }>
        const solde = (rs: string[]) => { let t = 0; for (const l of lignes) for (const r of rs) if (l.CompteNum.startsWith(r)) { t += l.Debit - l.Credit; break }; return t }
        const ca = -solde(['701','702','703','704','705','706','707','708'])
        const achats = solde(['601','602','603','604','605','606','607','608','609'])
        const ext = solde(['61','62']); const pers64 = solde(['64']); const imp63 = solde(['63']); const dot68 = solde(['681','686','687'])
        const fin66 = solde(['66']); const fin76 = -solde(['76']); const exc67 = solde(['67']); const exc77 = -solde(['77']); const is695 = solde(['695','696','697','698','699'])
        const mb = ca - achats - ext; const va = mb - imp63; const ebe = va - pers64; const rex = ebe - dot68; const rnet = rex + (fin76 - fin66) + (exc77 - exc67) - is695
        setInd({ ca, mb, ebe, rex, rnet, pers64, achats, ext, annee: data[0].annee, tauxMb: ca > 0 ? mb/ca*100 : 0, tauxEbe: ca > 0 ? ebe/ca*100 : 0, tauxRex: ca > 0 ? rex/ca*100 : 0, tauxRnet: ca > 0 ? rnet/ca*100 : 0, tauxPers: ca > 0 ? pers64/ca*100 : 0 })
      }
      setLoading(false)
    }
    load()
  }, [])
  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar activePage="profitability"/>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '2px solid #F2F3F5', borderTop: '2px solid #B8A98A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar activePage="profitability"/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.07)', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>Rentabilité</span>
          {ind && <span style={{ marginLeft: 12, fontSize: 11, color: '#8C9BAB' }}>Exercice {ind.annee}</span>}
        </div>
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {!ind ? (
            <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center', background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', marginBottom: 8 }}>Aucune donnée disponible</div>
              <div style={{ fontSize: 12, color: '#8C9BAB', marginBottom: 20 }}>Importez un FEC depuis la page Synthèse.</div>
              <a href="/dashboard" style={{ background: '#1A1A1A', color: '#fff', borderRadius: 8, padding: '10px 20px', fontSize: 13, textDecoration: 'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ maxWidth: 960 }}>
              <div style={{ background: 'rgba(184,169,138,0.06)', border: '0.5px solid rgba(184,169,138,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(184,169,138,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>💡</div>
                <div style={{ fontSize: 12, color: '#5C6670', lineHeight: 1.6 }}>
                  <strong style={{ color: '#1A1A1A' }}>Alvio analyse :</strong> Marge brute à {fmtPct(ind.tauxMb)} — {ind.tauxMb > 40 ? 'bonne performance commerciale' : 'marge à optimiser'}. {ind.tauxPers > 55 ? `Attention : masse salariale à ${fmtPct(ind.tauxPers)} du CA (seuil d'alerte 55%).` : `Masse salariale maîtrisée à ${fmtPct(ind.tauxPers)} du CA.`}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Marge brute', val: fmt(ind.mb), pct: fmtPct(ind.tauxMb), color: '#B8A98A' },
                  { label: 'EBITDA', val: fmt(ind.ebe), pct: fmtPct(ind.tauxEbe), color: ind.tauxEbe >= 10 ? '#1D9E75' : '#D85A30' },
                  { label: "Résultat d'exploitation", val: fmt(ind.rex), pct: fmtPct(ind.tauxRex), color: ind.rex >= 0 ? '#1D9E75' : '#D85A30' },
                  { label: 'Résultat net', val: fmt(ind.rnet), pct: fmtPct(ind.tauxRnet), color: ind.rnet >= 0 ? '#1D9E75' : '#D85A30' },
                ].map(k => (
                  <div key={k.label} style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', borderTop: `3px solid ${k.color}`, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{k.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 500, color: '#1A1A1A' }}>{k.val}</div>
                    <div style={{ fontSize: 11, color: k.color, marginTop: 4, fontWeight: 500 }}>{k.pct} du CA</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', padding: '18px 20px' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 16 }}>Décomposition du CA</div>
                  {[
                    { label: "Chiffre d'affaires", val: ind.ca, pct: 100, color: '#1A1A1A', bg: '#F2F3F5' },
                    { label: 'Achats & charges externes', val: -(ind.achats + ind.ext), pct: -(ind.achats + ind.ext)/ind.ca*100, color: '#D85A30', bg: 'rgba(216,90,48,0.08)' },
                    { label: '= Marge brute', val: ind.mb, pct: ind.tauxMb, color: '#B8A98A', bg: 'rgba(184,169,138,0.08)' },
                    { label: 'Charges de personnel', val: -ind.pers64, pct: -ind.pers64/ind.ca*100, color: '#D85A30', bg: 'rgba(216,90,48,0.08)' },
                    { label: '= EBITDA', val: ind.ebe, pct: ind.tauxEbe, color: ind.ebe >= 0 ? '#1D9E75' : '#D85A30', bg: ind.ebe >= 0 ? 'rgba(29,158,117,0.08)' : 'rgba(216,90,48,0.08)' },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'center', padding: '7px 10px', borderRadius: 6, background: r.bg, marginBottom: 4 }}>
                      <div style={{ flex: 1, fontSize: 12, color: '#1A1A1A' }}>{r.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: r.color, minWidth: 90, textAlign: 'right' }}>{fmt(r.val)}</div>
                      <div style={{ fontSize: 10, color: '#8C9BAB', minWidth: 50, textAlign: 'right' }}>{r.pct > 0 ? '+' : ''}{fmtPct(r.pct)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', padding: '18px 20px' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 16 }}>Thermomètre de santé</div>
                  {[
                    { label: 'Taux de marge brute', val: ind.tauxMb, max: 80, good: '> 40%', warn: '< 30%', inverse: false },
                    { label: "Taux d'EBITDA", val: ind.tauxEbe, max: 30, good: '> 15%', warn: '< 10%', inverse: false },
                    { label: 'Masse salariale / CA', val: ind.tauxPers, max: 80, good: '< 45%', warn: '> 55%', inverse: true },
                  ].map(m => {
                    const pct = Math.min(Math.max(m.val, 0), m.max) / m.max * 100
                    const ok = m.inverse ? m.val < 55 : m.val > (m.max * 0.33)
                    return (
                      <div key={m.label} style={{ marginBottom: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: '#1A1A1A' }}>{m.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: ok ? '#1D9E75' : '#D85A30' }}>{fmtPct(m.val)}</span>
                        </div>
                        <div style={{ height: 6, background: '#F2F3F5', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: ok ? '#1D9E75' : '#D85A30', borderRadius: 3 }}/>
                        </div>
                        <div style={{ fontSize: 10, color: '#8C9BAB', marginTop: 3 }}>Bon : {m.good} · Alerte : {m.warn}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
