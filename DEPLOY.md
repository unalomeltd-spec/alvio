# Déploiement Alvio sur VPS OVH

## 1. Sur ton poste — première fois

```bash
# Clone / push sur le repo vide
git init
git add .
git commit -m "init: alvio v1"
git remote add origin git@github.com:unalomeltd-spec/alvio.git
git push -u origin main
```

## 2. Sur le VPS — première fois

```bash
ssh ubuntu@51.83.162.152
cd /var/www/alvio
git clone git@github.com:unalomeltd-spec/alvio.git .
npm install

# Crée le fichier d'env avec tes vraies clés Supabase
nano .env.local
# → NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
# → NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

npm run build
pm2 start npm --name "alvio" -- start
pm2 save
```

## 3. Déploiements suivants (depuis ton poste)

```bash
git add . && git commit -m "update" && git push
```

Puis sur le VPS :

```bash
ssh ubuntu@51.83.162.152 "cd /var/www/alvio && git pull && npm install && npm run build && pm2 restart alvio"
```

## 4. Config Nginx (si pas encore fait)

```nginx
server {
    listen 80;
    server_name alvio.finance www.alvio.finance;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 5. Supabase — config Auth

Dans ton dashboard Supabase :
- Authentication → URL Configuration
- Site URL : `https://alvio.finance`
- Redirect URLs : `https://alvio.finance/dashboard`
