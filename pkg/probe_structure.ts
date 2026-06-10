import * as fs from 'fs'
import { calculer } from './src/engine'
function rows(p: string) {
  const L = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(l => l.trim())
  const h = L[0].split('\t').map(x => x.trim())
  const i = (n: string) => h.indexOf(n)
  return L.slice(1).map(l => {
    const c = l.split('\t')
    return { JournalCode:(c[i('JournalCode')]||'').trim(), JournalLib:(c[i('JournalLib')]||'').trim(), EcritureDate:(c[i('EcritureDate')]||'').trim(), CompteNum:(c[i('CompteNum')]||'').trim(), CompteLib:(c[i('CompteLib')]||'').trim(), CompAuxNum:(c[i('CompAuxNum')]||'').trim(), CompAuxLib:(c[i('CompAuxLib')]||'').trim(), EcritureLib:(c[i('EcritureLib')]||'').trim(), Debit:parseFloat(String(c[i('Debit')]).replace(',','.'))||0, Credit:parseFloat(String(c[i('Credit')]).replace(',','.'))||0 }
  })
}
const lignes = rows('/mnt/user-data/uploads/KOMUT_STUDIO_SAS.txt')
const res = calculer(lignes, null)
console.log(JSON.stringify(Object.keys(res)))
console.log('--- sig keys:', JSON.stringify(Object.keys(res.sig||{})))
console.log('--- cr keys:', JSON.stringify(Object.keys(res.cr||{})))
console.log('--- bilan.actif keys:', JSON.stringify(Object.keys(res.bilan?.actif||{})))
console.log('--- bilan.passif keys:', JSON.stringify(Object.keys(res.bilan?.passif||{})))
console.log('--- cp:', JSON.stringify(res.bilan?.passif?.capitauxPropres))
