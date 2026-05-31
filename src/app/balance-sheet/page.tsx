'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtPct = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + ' %'
export default function BalanceSheetPage() {
  const [loading, setLoading] = useState(true)
  const [actif, setActif] = useState<any[]>([])
  const [passif, setPassif] = useState<any[]>([])
  const [annee, setAnnee] = useState(0)
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const { data } = await supabase.from('fec_exercices').select('annee, ecritures').eq('user_id', user.id).order('annee', { ascending: false }).limit(1)
      if (data && data[0]) {
        const lignes = data[0].ecritures as Array<{ CompteNum: string; Debit: number; Credit: number }>
        const solde = (rs: string[]) => { let t = 0; for (const l of lignes) for (const r of rs) if (l.CompteNum.startsWith(r)) { t += l.Debit - l.Credit; break }; return t }
        setAnnee(data[0].annee)
        const immoIncorp = solde(['20']); const immoCorp = solde(['21','22','23']); const immoFin = solde(['26','27'])
        const stocks = solde(['3']); const creances = solde(['41','44','45','46']); const tresoA = solde(['51','53'])
        const capitaux = -solde(['10','11','12','13']); const dettesLT = -solde(['16']); const dettesExploit = -solde(['40','42','43','44','45','46'])
        const tresoPa = -solde(['50','52','54'])
        setActif([
          { label: 'Immobilisations incorporelles', val: immoIncorp, color: '#B8A98A' },
          { label: 'Immobilisations corporelles', val: immoCorp, color: '#8C9BAB' },
          { label: 'Immobilisations financières', val: immoFin, color: '#5C6670' },
          { label: 'Stocks', val: stocks, color: '#B8A98A' },
          { label: 'Créances clients', val: creances, color: '#1A1A1A' },
          { label: 'Trésorerie active', val: tresoA, color: '#1D9E75' },
        ].filter(r => Math.abs(r.val) > 0))
        setPassif([
          { label: 'Capitaux propres', val: capitaux, color: '#1D9E75' },
          { label: 'Dettes financières LT', val: dettesLT, color: '#D85A30' },
          { label: "Dettes d'exploitation", val: dettesExploit, color: '#8C9BAB' },
          { label: 'Trésorerie passive', val: tresoPa, color: '#5C6670' },
        ].filter(r => Math.abs(r.val) > 0))
      }
      setLoading(false)
    }
    load()
  }, [])
  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar activePage="balance-sheet"/>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '2px solid #F2F3F5', borderTop: '2px solid #B8A98A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )
  const totalActif = actif.reduce((s, r) => s + Math.abs(r.val), 0)
  const totalPassif = passif.reduce((s, r) => s + Math.abs(r.val), 0)
  const BarSide = ({ items, total }: { items: any[], total: number }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((r, i) => {
        const pct = total > 0 ? Math.max(Math.abs(r.val) / total * 100, 3) : 0
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: '#1A1A1A' }}>{r.label}</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: r.color }}>{fmt(r.val)}</span>
                <span style={{ fontSize: 10, color: '#8C9BAB', marginLeft: 6 }}>{fmtPct(pct)}</span>
              </div>
            </div>
            <div style={{ height: 8, background: '#F2F3F5', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: r.color, borderRadius: 4, transition: 'width 0.6s ease' }}/>
            </div>
          </div>
        )
      })}
    </div>
  )
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar activePage="balance-sheet"/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.07)', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>Bilan</span>
          {annee > 0 && <span style={{ marginLeft: 12, fontSize: 11, color: '#8C9BAB' }}>Au 31/12/{annee}</span>}
        </div>
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {actif.length === 0 ? (
            <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center', background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', marginBottom: 8 }}>Aucune donnée disponible</div>
              <a href="/dashboard" style={{ background: '#1A1A1A', color: '#fff', borderRadius: 8, padding: '10px 20px', fontSize: 13, textDecoration: 'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ maxWidth: 960 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>Actif</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#B8A98A' }}>{fmt(totalActif)}</span>
                  </div>
                  <BarSide items={actif} total={totalActif}/>
                </div>
                <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>Passif</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#B8A98A' }}>{fmt(totalPassif)}</span>
                  </div>
                  <BarSide items={passif} total={totalPassif}/>
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
