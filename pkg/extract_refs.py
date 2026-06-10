import subprocess, json, re, glob, os
U='/mnt/user-data/uploads'

def dump(path):
    return subprocess.run(['extract-text',path],capture_output=True,text=True).stdout

def sheets(txt):
    out={}; cur=None
    for line in txt.splitlines():
        if line.startswith('## Sheet:'):
            cur=line.split(':',1)[1].strip(); out[cur]=[]
        elif cur is not None:
            out[cur].append(line.split('\t'))
    return out

def num(s):
    s=(s or '').strip().replace('\u202f','').replace(' ','').replace(',','.')
    try: return float(s)
    except: return None

def find(rows, label, col):
    lab=label.lower()
    for r in rows:
        if r and r[0].strip().lower().startswith(lab):
            if len(r)>col and num(r[col]) is not None:
                return num(r[col])
    return None

dossiers={}
for cr_path in sorted(glob.glob(f'{U}/*Compte_de_re_sultat*.xlsx')):
    base=os.path.basename(cr_path).split('_Compte_de_re')[0]
    bil_path=glob.glob(f'{U}/{base}_Bilan*.xlsx')[0]
    cr=sheets(dump(cr_path)); bil=sheets(dump(bil_path))
    crrows=list(cr.values())[0]
    # CR: 1st numeric col = exercice courant (index 1)
    ref={
      'ca': find(crrows,"Montant net du chiffre",1),
      'produitsExploit': find(crrows,"Total des produits d",1),
      'chargesExploit': find(crrows,"Total des charges d",1),
      'rex': find(crrows,"Résultat d’exploitation",1) or find(crrows,"Résultat d'exploitation",1),
      'rfin': find(crrows,"Résultat financier",1),
      'rcai': find(crrows,"Résultat courant avant",1),
      'rexcep': find(crrows,"Résultat exceptionnel",1),
      'is': find(crrows,"Impôts sur les b",1),
      'resultatNet': find(crrows,"Résultat de l’exercice",1) or find(crrows,"Résultat de l'exercice",1),
    }
    # Bilan actif: Net = 3e col numérique (index 3) ; passif: index 1
    actif = bil.get('Bilan actif',[])
    passif= bil.get('Bilan passif',[])
    ref.update({
      'immoNet': find(actif,"Total actif immobilisé",3),
      'actifCirculant': find(actif,"Total actif circulant",3),
      'creancesClients': find(actif,"Créances clients",3),
      'disponibilites': find(actif,"Disponibilités",3),
      'totalActif': find(actif,"Total actif (",3),
      'capitauxPropres': find(passif,"Total capitaux propres",1),
      'totalDettes': find(passif,"Total dettes",1),
      'totalPassif': find(passif,"Total passif",1),
      'resultatBilan': find(passif,"Résultat de l’exercice",1) or find(passif,"Résultat de l'exercice",1),
    })
    dossiers[base]=ref

json.dump(dossiers, open('refs.json','w'), indent=2, ensure_ascii=False)
for k,v in dossiers.items():
    print(f"\n=== {k} ===")
    print(f"  CA={v['ca']}  REX={v['rex']}  RCAI={v['rcai']}  RN={v['resultatNet']}")
    print(f"  TotalActif={v['totalActif']}  TotalPassif={v['totalPassif']}  CP={v['capitauxPropres']}  RNbilan={v['resultatBilan']}")
