// Génère la baseline v6.3 (moteur au centime sur 5 dossiers Pennylane)
import * as fs from 'fs'
import { calculer } from './src/engine'

const U = '/mnt/user-data/uploads'
const dossiers = ['KOMUT_STUDIO_SAS','PLUS_DE_GOUT','CITECOOP','CLUB_MOBILITE','APA_DE_GEANT']

function rows(p: string) {
  const L = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(l => l.trim())
  const h = L[0].split('\t').map(x => x.trim())
  const i = (n: string) => h.indexOf(n)
  return L.slice(1).map(l => {
    const c = l.split('\t')
    return { JournalCode:(c[i('JournalCode')]||'').trim(), JournalLib:(c[i('JournalLib')]||'').trim(), EcritureDate:(c[i('EcritureDate')]||'').trim(), CompteNum:(c[i('CompteNum')]||'').trim(), CompteLib:(c[i('CompteLib')]||'').trim(), CompAuxNum:(c[i('CompAuxNum')]||'').trim(), CompAuxLib:(c[i('CompAuxLib')]||'').trim(), EcritureLib:(c[i('EcritureLib')]||'').trim(), Debit:parseFloat(String(c[i('Debit')]).replace(',','.'))||0, Credit:parseFloat(String(c[i('Credit')]).replace(',','.'))||0 }
  })
}

const baseline: Record<string, Record<string, number>> = {}
for (const d of dossiers) {
  const res = calculer(rows(`${U}/${d}.txt`), null)
  baseline[d] = {
    ca:            res.sig?.ca ?? 0,
    rex:           res.sig?.rex ?? 0,
    rcai:          res.sig?.rcai ?? 0,
    rexcept:       res.sig?.rexcep ?? 0,
    rn:            res.sig?.resultatNet ?? 0,
    totalActif:    res.bilan?.actif?.totalActif ?? 0,
    totalPassif:   res.bilan?.passif?.totalPassif ?? 0,
    cp:            res.bilan?.passif?.capitauxPropres ?? 0,
    immoNet:       res.bilan?.actif?.actifImmoNet ?? 0,
    creancesClients: res.bilan?.actif?.creancesClients ?? 0,
    tresorerie:    res.bilan?.actif?.tresorerie ?? 0,
    totalDettes:   (res.bilan?.passif?.dettesLT ?? 0) + (res.bilan?.passif?.dettesCT ?? 0),
  }
  console.log(`✓ ${d}  RN=${baseline[d].rn.toFixed(2)}  actif=${baseline[d].totalActif.toFixed(2)}  CP=${baseline[d].cp.toFixed(2)}`)
}
fs.writeFileSync('baseline.json', JSON.stringify(baseline, null, 2))
console.log('\nbaseline.json v6.3 gelée ✓')
