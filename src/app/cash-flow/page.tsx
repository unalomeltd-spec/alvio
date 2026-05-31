'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
export default function CashFlowPage() {
  const [loading, setLoading] = useState(true)
  const [treso, setTreso] = useState(0)
  const [ebe, setEbe] = useState(0)
  const [bfr, setBfr] = useState(0)
  const [annee, setAnnee] = useState(0)
  const [monthly, setMonthly] = useState<{ m: string; val: number }[]>([])
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const { data } = await supabase.from('fec_exercices').select('annee, ecritures').eq('user_id', user.id).order('annee', { ascending: false }).limit(1)
      if (data && data[0]) {
        const lignes = data[0].ecritures as Array<{ CompteNum: string; Debit: number; Credit: number; EcritureDate: string }>
        const solde = (rs: string[]) => { let t = 0; for (const l of lignes) for (const r of rs) if (l.CompteNum.startsWith(r)) { t += l.Debit - l.Credit; break }; return t }
        setAnnee(data[0].annee)
        const tresoVal = solde(['51','53']); setTreso(tresoVal)
        const ca = -solde(['701','702','703','704','705','706','707','708'])
        const achats = solde(['601','602','603','604','605','606','607','608','609']); const ext = solde(['61','62']); const pers64 = solde(['64']); const imp63 = solde(['63'])
        setEbe(ca - achats - ext - imp63 - pers64)
        const creances = solde(['41']); const dettes = -solde(['40','42','43']); setBfr(creances - dettes)
        const byMonth: Record<string, number> = {}
        for (const l of lignes) {
          if (l.CompteNum.startsWith('51') || l.CompteNum.startsWith('53')) {
            const d = l.EcritureDate || ''
            const m = d.length === 8 ? d.slice(0,4) + '-' + d.slice(4,6) : d.length >= 7 ? d.slice(0,7) : 'ND'
            byMonth[m] = (byMonth[m] || 0) + (l.Debit - l.Credit)
          }
        }
        let cum = 0
        const sorted = Object.entries(byMonth).sort(([a],[b]) => a.localeCompare(b)).slice(-12)
        setMonthly(sorted.map(([m, v]) => { cum += v; return { m: m.slice(5) || m, val: cum } }))
      }
      setLoading(false)
    }
    load()
  }, [])
  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar activePage="cash-flow"/>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '2px solid #F2F3F5', borderTop: '2px solid #B8A98A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )
  const maxVal = monthly.length > 0 ? Math.max(...monthly.map(m => Math.abs(m.val))) || 1 : 1
  const joursCharges = ebe > 0 ? Math.round(treso / (ebe / 365)) : 0
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar activePage="cash-flow"/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.07)', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>Trésorerie</span>
          {annee > 0 && <span style={{ marginLeft: 12, fontSize: 11, color: '#8C9BAB' }}>Exercice {annee}</span>}
        </div>
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          <div style={{ maxWidth: 960 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Trésorerie nette', val: fmt(treso), color: treso >= 0 ? '#1D9E75' : '#D85A30', accent: treso >= 0 ? '#1D9E75' : '#D85A30' },
                { label: 'EBITDA', val: fmt(ebe), color: ebe >= 0 ? '#1D9E75' : '#D85A30', accent: '#B8A98A' },
                { label: 'Jours de trésorerie', val: joursCharges > 0 ? `${joursCharges} jours` : '—', color: joursCharges > 60 ? '#1D9E75' : joursCharges > 30 ? '#B8A98A' : '#D85A30', accent: '#8C9BAB' },
              ].map(k => (
                <div key={k.label} style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', borderTop: `3px solid ${k.accent}`, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 500, color: k.color }}>{k.val}</div>
                </div>
              ))}
            </div>
            {monthly.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', padding: '18px 20px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 16 }}>Évolution de la trésorerie cumulée</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
                  {monthly.map((m, i) => {
                    const h = Math.max(Math.abs(m.val) / maxVal * 100, 4)
                    const isPos = m.val >= 0
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: '100%', height: `${h}%`, minHeight: 4, background: i === monthly.length-1 ? '#1A1A1A' : isPos ? '#1D9E75' : '#D85A30', borderRadius: '3px 3px 0 0' }}/>
                        <span style={{ fontSize: 9, color: '#8C9BAB', whiteSpace: 'nowrap' }}>{m.m}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', padding: '18px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 12 }}>Besoin en fonds de roulement (BFR)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1, height: 10, background: '#F2F3F5', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(Math.abs(bfr) / Math.max(Math.abs(treso), Math.abs(bfr), 1) * 100, 100)}%`, background: bfr > 0 ? '#D85A30' : '#1D9E75', borderRadius: 5 }}/>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: bfr > 0 ? '#D85A30' : '#1D9E75', minWidth: 110, textAlign: 'right' }}>{fmt(bfr)}</div>
              </div>
              <div style={{ fontSize: 11, color: '#8C9BAB', marginTop: 8 }}>
                {bfr > 0 ? "BFR positif : vos clients vous doivent plus que vous devez à vos fournisseurs." : "BFR négatif : vos fournisseurs vous financent — situation favorable."}
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
