'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import { usePeriod } from '@/hooks/usePeriod'
import AlvioInsight from '@/components/AlvioInsight'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'

// Calcule la trésorerie mensuelle depuis les écritures de la classe 5
// Retourne le solde cumulé mois par mois (débit - crédit sur comptes 50→58)
// Même règles d'exclusion que le moteur v3
function getMonthlyCash(ecritures: any[]): { m: string; val: number }[] {
  const byMonth: Record<string, number> = {}

  for (const l of ecritures) {
    const compte  = (l.CompteNum || '').trim()
    const journal = (l.JournalCode || '').trim().toUpperCase()
    const c2      = compte.slice(0, 2)

    if (journal === 'AN') continue
    if (c2 < '50' || c2 > '58') continue

    const d = typeof l.EcritureDate === 'string' ? l.EcritureDate : ''
    let m = ''
    if (d.length === 8) m = d.slice(0, 4) + '-' + d.slice(4, 6)
    else if (d.length >= 7) m = d.slice(0, 7)
    else continue

    const debit  = typeof l.Debit  === 'string' ? parseFloat(l.Debit.replace(',',  '.')) || 0 : (l.Debit  || 0)
    const credit = typeof l.Credit === 'string' ? parseFloat(l.Credit.replace(',', '.')) || 0 : (l.Credit || 0)

    byMonth[m] = (byMonth[m] || 0) + (debit - credit)
  }

  const sorted = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
  let cumul = 0
  return sorted.map(([m, v]) => {
    cumul += v
    return { m: m.slice(5) || m, val: Math.round(cumul * 100) / 100 }
  })
}

export default function CashFlowPage() {
  const [etats, setEtats]             = useState<any>(null)
  const [monthly, setMonthly]         = useState<{ m: string; val: number }[]>([])
  const [annees, setAnnees]           = useState<number[]>([])
  const [loading, setLoading]         = useState(true)
  const [userId, setUserId]           = useState<string>('')
  const { anneeActive, setAnneeActive, periodeTab, setPeriodeTab, dateDebut, setDateDebut, dateFin, setDateFin, anneeN1, setAnneeN1, dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1 } = usePeriod(new Date().getFullYear())
  const periodeParams = periodeTab === 'perso' && dateDebut && dateFin
    ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      setUserId(user.id)
      const { data } = await sb
        .from('fec_exercices')
        .select('annee')
        .eq('user_id', user.id)
        .order('annee', { ascending: false })
      if (data && data.length > 0) {
        const anneesDispos = data.map((r: any) => r.annee as number)
        setAnnees(anneesDispos)
        const annee = anneesDispos.includes(anneeActive) ? anneeActive : anneesDispos[0]
        if (annee !== anneeActive) setAnneeActive(annee)
        await chargerDonnees(user.id, annee)
      }
      setLoading(false)
    }
    load()
  }, [])

  const chargerDonnees = async (uid: string, annee: number) => {
    const res = await fetch(`/api/etats?annee=${annee}&user_id=${uid}${periodeParams}`)
    if (res.ok) setEtats(await res.json())
    const { data: fecData } = await sb
      .from('fec_exercices')
      .select('ecritures')
      .eq('user_id', uid)
      .eq('annee', annee)
      .single()
    if (fecData?.ecritures) setMonthly(getMonthlyCash(fecData.ecritures))
  }

  const changerAnnee = async (annee: number) => {
    setAnneeActive(annee)
    setMonthly([])
    await chargerDonnees(userId, annee)
  }

  const bilan      = etats?.bilan
  const sig        = etats?.sig
  const tresorerie = bilan?.actif?.tresorerie          ?? 0
  const creances   = bilan?.actif?.creancesClients     ?? 0
  const dettes     = bilan?.passif?.dettesFournisseurs ?? 0
  const bfr        = creances - dettes
  const jTreso     = sig?.ca > 0 ? Math.round(tresorerie / sig.ca * 365) : 0
  const jCreances  = sig?.ca > 0 ? Math.round(creances   / sig.ca * 365) : 0
  const jDettes    = sig?.ca > 0 ? Math.round(dettes     / sig.ca * 365) : 0

  if (loading) return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="cash-flow"/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'2px solid #F2F3F5', borderTop:'2px solid #B8A98A', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="cash-flow"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
        <TopBar title="Trésorerie" annees={annees} anneeActive={anneeActive} onChangerAnnee={changerAnnee}
          periodeTab={periodeTab} setPeriodeTab={setPeriodeTab}
          dateDebut={dateDebut} setDateDebut={setDateDebut}
          dateFin={dateFin} setDateFin={setDateFin}
          anneeN1={anneeN1} setAnneeN1={setAnneeN1}
          dateDebutN1={dateDebutN1} setDateDebutN1={setDateDebutN1}
          dateFinN1={dateFinN1} setDateFinN1={setDateFinN1} />
        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {!bilan ? (
            <div style={{ maxWidth:480, margin:'60px auto', textAlign:'center', background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:24 }}>
              <div style={{ fontSize:14, fontWeight:500, color:'#1A1A1A', marginBottom:8 }}>Aucune donnée disponible</div>
              <a href="/dashboard" style={{ background:'#1A1A1A', color:'#fff', borderRadius:8, padding:'10px 20px', fontSize:13, textDecoration:'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ maxWidth:1000 }}>
              {sig && <AlvioInsight payload={{ page:'cash-flow', annee:anneeActive, indicateurs:{ tresorerie, bfr, creancesClients: creances, dettesFournisseurs: dettes, jTreso, jCreances, jDettes } }} />}

              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
                {[
                  { label:'Trésorerie nette',   value: tresorerie, sub: `${jTreso} jours de CA`,    color: tresorerie >= 0 ? '#1D9E75' : '#D85A30' },
                  { label:'Créances clients',    value: creances,   sub: `${jCreances} jours de CA`, color:'#8C9BAB' },
                  { label:'Dettes fournisseurs', value: dettes,     sub: `${jDettes} jours de CA`,   color:'#8C9BAB' },
                  { label:'BFR',                 value: bfr,        sub: bfr > 0 ? 'À financer' : 'Ressource nette', color: bfr <= 0 ? '#1D9E75' : '#D85A30' },
                ].map((k, i) => (
                  <div key={i} style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', padding:'16px 20px', borderTop:`3px solid ${k.color}` }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#8C9BAB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>{k.label}</div>
                    <div style={{ fontSize:22, fontWeight:600, color:'#1A1A1A' }}>{fmt(k.value)}</div>
                    <div style={{ fontSize:11, color: k.color, marginTop:4, fontWeight:500 }}>{k.sub}</div>
                  </div>
                ))}
              </div>

              {monthly.length > 0 && (
                <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', padding:24, marginBottom:24 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#1A1A1A', marginBottom:16 }}>Évolution de la trésorerie — {anneeActive}</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={monthly} margin={{ top:5, right:20, left:10, bottom:5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                      <XAxis dataKey="m" tick={{ fontSize:10, fill:'#8C9BAB' }} />
                      <YAxis tick={{ fontSize:10, fill:'#8C9BAB' }} tickFormatter={v => new Intl.NumberFormat('fr-FR', { notation:'compact' }).format(v)} />
                      <Tooltip formatter={(v: any) => fmt(v)} labelStyle={{ color:'#1A1A1A', fontWeight:500 }} contentStyle={{ border:'0.5px solid rgba(0,0,0,0.08)', borderRadius:8, fontSize:12 }} />
                      <Line type="monotone" dataKey="val" stroke="#1A1A1A" strokeWidth={2} dot={{ fill:'#B8A98A', r:3 }} activeDot={{ r:5, fill:'#1A1A1A' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.06)', padding:24 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#1A1A1A', marginBottom:16 }}>Analyse du Besoin en Fonds de Roulement</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
                  {[
                    { label:'Créances clients (41x)',    value: creances, note: `Délai moyen : ${jCreances}j`, color:'#D85A30' },
                    { label:'Dettes fournisseurs (40x)', value: dettes,   note: `Délai moyen : ${jDettes}j`,  color:'#1D9E75' },
                    { label:'BFR net',                   value: bfr,      note: bfr > 0 ? 'Besoin à financer' : 'Ressource de financement', color: bfr <= 0 ? '#1D9E75' : '#D85A30' },
                  ].map((item, i) => (
                    <div key={i} style={{ padding:16, background:'#F2F3F5', borderRadius:8, borderLeft:`3px solid ${item.color}` }}>
                      <div style={{ fontSize:11, color:'#8C9BAB', marginBottom:6 }}>{item.label}</div>
                      <div style={{ fontSize:18, fontWeight:600, color:'#1A1A1A', marginBottom:4 }}>{fmt(item.value)}</div>
                      <div style={{ fontSize:11, color: item.color, fontWeight:500 }}>{item.note}</div>
                    </div>
                  ))}
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
