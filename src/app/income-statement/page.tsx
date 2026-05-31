'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtPct = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + ' %'
export default function IncomeStatementPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [annee, setAnnee] = useState(0)
  const [open, setOpen] = useState<Record<string, boolean>>({ prod: true, charges: true, fin: false, exc: false })
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const { data } = await supabase.from('fec_exercices').select('annee, ecritures').eq('user_id', user.id).order('annee', { ascending: false }).limit(1)
      if (data && data[0]) {
        const lignes = data[0].ecritures as Array<{ CompteNum: string; Debit: number; Credit: number }>
        const solde = (rs: string[]) => { let t = 0; for (const l of lignes) for (const r of rs) if (l.CompteNum.startsWith(r)) { t += l.Debit - l.Credit; break }; return t }
        const ca = -solde(['701','702','703','704','705','706','707','708'])
        const achats = solde(['601','602','603','604','605','606','607','608','609']); const ext = solde(['61','62']); const imp63 = solde(['63']); const pers64 = solde(['64']); const dot68 = solde(['681','686','687'])
        const fin66 = solde(['66']); const fin76 = -solde(['76']); const exc67 = solde(['67']); const exc77 = -solde(['77']); const is695 = solde(['695','696','697','698','699'])
        const mb = ca - achats - ext; const va = mb - imp63; const ebe = va - pers64; const rex = ebe - dot68; const rfin = fin76 - fin66; const rexc = exc77 - exc67; const rnet = rex + rfin + rexc - is695
        setAnnee(data[0].annee)
        setRows([
          { section: 'prod', label: "Chiffre d'affaires", val: ca, pct: 100 },
          { section: 'prod', label: 'Variation de stocks', val: 0, pct: 0, indent: true },
          { section: 'prod', sub: true, label: 'Production totale', val: ca, color: '#B8A98A' },
          { section: 'charges', label: 'Achats et charges externes', val: -(achats+ext), pct: ca > 0 ? -(achats+ext)/ca*100 : 0, indent: true },
          { section: 'charges', label: 'Impôts et taxes', val: -imp63, pct: ca > 0 ? -imp63/ca*100 : 0, indent: true },
          { section: 'charges', label: 'Charges de personnel', val: -pers64, pct: ca > 0 ? -pers64/ca*100 : 0, indent: true, alert: pers64/ca > 0.55 },
          { section: 'charges', label: 'Dotations aux amortissements', val: -dot68, pct: ca > 0 ? -dot68/ca*100 : 0, indent: true },
          { section: 'charges', sub: true, label: "Résultat d'exploitation", val: rex, pct: ca > 0 ? rex/ca*100 : 0, color: rex >= 0 ? '#1D9E75' : '#D85A30', bold: true },
          { section: 'fin', label: 'Produits financiers', val: fin76, pct: ca > 0 ? fin76/ca*100 : 0, indent: true },
          { section: 'fin', label: 'Charges financières', val: -fin66, pct: ca > 0 ? -fin66/ca*100 : 0, indent: true },
          { section: 'fin', sub: true, label: 'Résultat financier', val: rfin, pct: ca > 0 ? rfin/ca*100 : 0, color: rfin >= 0 ? '#1D9E75' : '#D85A30' },
          { section: 'exc', label: 'Produits exceptionnels', val: exc77, pct: ca > 0 ? exc77/ca*100 : 0, indent: true },
          { section: 'exc', label: 'Charges exceptionnelles', val: -exc67, pct: ca > 0 ? -exc67/ca*100 : 0, indent: true },
          { section: 'exc', label: 'IS et participation', val: -is695, pct: ca > 0 ? -is695/ca*100 : 0, indent: true },
          { large: true, label: 'RÉSULTAT NET', val: rnet, pct: ca > 0 ? rnet/ca*100 : 0, color: rnet >= 0 ? '#1D9E75' : '#D85A30', bold: true },
        ])
      }
      setLoading(false)
    }
    load()
  }, [])
  const sectionTitle: Record<string, string> = { prod: 'Production & ventes', charges: "Charges d'exploitation", fin: 'Résultat financier', exc: 'Exceptionnel & IS' }
  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar activePage="income-statement"/>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '2px solid #F2F3F5', borderTop: '2px solid #B8A98A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar activePage="income-statement"/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.07)', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>Compte de résultat</span>
          {annee > 0 && <span style={{ marginLeft: 12, fontSize: 11, color: '#8C9BAB' }}>Exercice {annee}</span>}
        </div>
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {rows.length === 0 ? (
            <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center', background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', marginBottom: 8 }}>Aucune donnée disponible</div>
              <a href="/dashboard" style={{ background: '#1A1A1A', color: '#fff', borderRadius: 8, padding: '10px 20px', fontSize: 13, textDecoration: 'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ maxWidth: 800 }}>
              <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', background: '#1A1A1A', padding: '10px 16px' }}>
                  <div style={{ flex: 1, fontSize: 11, fontWeight: 500, color: '#F2F3F5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Libellé</div>
                  <div style={{ width: 110, textAlign: 'right', fontSize: 11, fontWeight: 500, color: '#F2F3F5' }}>Montant</div>
                  <div style={{ width: 60, textAlign: 'right', fontSize: 11, color: '#8C9BAB' }}>% CA</div>
                </div>
                {['prod','charges','fin','exc'].map(sec => (
                  <div key={sec}>
                    <div onClick={() => setOpen(o => ({ ...o, [sec]: !o[sec] }))}
                      style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', background: 'rgba(184,169,138,0.06)', cursor: 'pointer', borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: '#1A1A1A', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 9, color: '#B8A98A', display: 'inline-block', transition: 'transform 0.2s', transform: open[sec] ? 'rotate(90deg)' : 'none' }}>▶</span>
                        {sectionTitle[sec]}
                      </div>
                    </div>
                    {open[sec] && rows.filter(r => r.section === sec).map((r, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', padding: r.large ? '10px 16px' : '6px 16px', background: r.large ? '#1A1A1A' : r.sub ? 'rgba(0,0,0,0.02)' : 'transparent', borderTop: '0.5px solid rgba(0,0,0,0.04)' }}>
                        <div style={{ flex: 1, fontSize: r.large ? 13 : 12, fontWeight: r.bold ? 500 : 400, color: r.large ? '#F2F3F5' : r.alert ? '#D85A30' : '#1A1A1A', paddingLeft: r.indent ? 20 : 0 }}>{r.label}</div>
                        <div style={{ width: 110, textAlign: 'right', fontSize: r.large ? 14 : 12, fontWeight: r.bold ? 500 : 400, color: r.color || (r.val >= 0 ? '#1A1A1A' : '#D85A30') }}>{fmt(r.val)}</div>
                        <div style={{ width: 60, textAlign: 'right', fontSize: 10, color: r.large ? '#8C9BAB' : '#8C9BAB' }}>{r.pct !== undefined ? fmtPct(r.pct) : ''}</div>
                      </div>
                    ))}
                  </div>
                ))}
                {rows.filter(r => r.large).map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: '#1A1A1A', borderTop: '0.5px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#F2F3F5' }}>{r.label}</div>
                    <div style={{ width: 110, textAlign: 'right', fontSize: 14, fontWeight: 500, color: r.color }}>{fmt(r.val)}</div>
                    <div style={{ width: 60, textAlign: 'right', fontSize: 10, color: '#8C9BAB' }}>{fmtPct(r.pct)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
