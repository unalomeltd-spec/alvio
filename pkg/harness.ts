/* ALVIO — Harnais de non-régression du moteur comptable
 * Rejoue les dossiers de référence, compare au centime à :
 *   (1) baseline.json  — sortie gelée du moteur (NON-RÉGRESSION : exit 1 si dérive)
 *   (2) refs.json      — états Pennylane (PRÉCISION COMPTABLE : informatif)
 * Usage : npm test
 */
import { calculer, type LigneFEC } from './src/engine'
import * as fs from 'fs'
const refs = JSON.parse(fs.readFileSync(`${__dirname}/refs.json`,'utf8'))
const baseline = fs.existsSync(`${__dirname}/baseline.json`) ? JSON.parse(fs.readFileSync(`${__dirname}/baseline.json`,'utf8')) : null

const DOSSIERS = ['KOMUT_STUDIO_SAS','PLUS_DE_GOUT','CITECOOP','CLUB_MOBILITE','APA_DE_GEANT']
const TOL = 0.01

function parseFEC(path:string): LigneFEC[] {
  const lines = fs.readFileSync(path,'utf8').split(/\r?\n/).filter(l=>l.trim().length>0)
  const h = lines[0].split('\t').map(x=>x.trim()); const i=(n:string)=>h.indexOf(n)
  return lines.slice(1).map(l=>{const c=l.split('\t');return{
    JournalCode:c[i('JournalCode')],EcritureNum:c[i('EcritureNum')],EcritureDate:c[i('EcritureDate')],
    CompteNum:c[i('CompteNum')],CompteLib:c[i('CompteLib')],CompAuxNum:c[i('CompAuxNum')],Debit:c[i('Debit')],Credit:c[i('Credit')]}})
}
function snap(res:any){return {
  regime:res.regime, gate:res.gate.passed, ecartFEC:res.controles.ecartFEC, ecartBilan:res.controles.ecartBilan,
  nonReconnus:res.controles.comptesNonReconnusTotal,
  ca:res.sig.ca, rex:res.cr.resultatExploitation, rcai:res.cr.resultatCourantAvantImpots,
  rexcep:res.cr.resultatExceptionnel, rnet:res.cr.resultatNet,
  totalActif:res.bilan.actif.totalActif, totalPassif:res.bilan.passif.totalPassif,
  capitauxPropres:res.bilan.passif.capitauxPropres,
}}

const results:Record<string,any> = {}
let drift = 0, accWarn = 0
for (const name of DOSSIERS){
  const res = calculer(parseFEC(`${__dirname}/dossiers/${name}.txt`), 2025)
  const s = snap(res); results[name] = s

  // (1) NON-RÉGRESSION vs baseline
  if (baseline && baseline[name]){
    for (const k of Object.keys(s)){
      const a=(s as any)[k], b=baseline[name][k]
      const same = (typeof a==='number') ? Math.abs(a-b)<TOL : a===b
      if(!same){ drift++; console.log(`  ❌ DÉRIVE ${name}.${k}: baseline=${b} → moteur=${a}`) }
    }
  }
  // (2) PRÉCISION vs Pennylane (informatif)
  const ref = refs[name]
  const checks:[string,number,number][] = [
    ['CA',ref.ca,s.ca],['REX',ref.rex,s.rex],['RCAI',ref.rcai,s.rcai],['RN',ref.resultatNet,s.rnet],
    ['TotalActif',ref.totalActif,s.totalActif],['TotalPassif',ref.totalPassif,s.totalPassif],['CP',ref.capitauxPropres,s.capitauxPropres],
  ]
  const ko = checks.filter(([_,r0,m])=>r0!=null && Math.abs(m-r0)>=TOL)
  accWarn += ko.length
  console.log(`${s.gate?'✅':'❌'} ${name.padEnd(18)} régime:${s.regime.padEnd(18)} gate:${s.gate} | vs Pennylane: ${checks.length-ko.length}/${checks.length} au centime${ko.length?'  ⚠ écarts: '+ko.map(([l,r0,m])=>`${l}(${(m-r0).toFixed(2)})`).join(', '):''}`)
}

if(!baseline){
  fs.writeFileSync(`${__dirname}/baseline.json`, JSON.stringify(results,null,2))
  console.log('\nℹ️  baseline.json absent → généré. Relancez pour activer le contrôle de non-régression.')
  process.exit(0)
}
console.log(`\n── Non-régression : ${drift===0?'✅ AUCUNE DÉRIVE':'❌ '+drift+' DÉRIVE(S)'}  |  Précision Pennylane : ${accWarn} écart(s) connu(s) (gross-up bivalents / CA 708-709 / AN-6-7 APA — voir rapport d'audit)`)
process.exit(drift===0 ? 0 : 1)
