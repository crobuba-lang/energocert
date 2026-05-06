# EnergoCert – Generator Izvještaja

Web aplikacija za generiranje energetskih certifikata zgrade.

## Postavljanje (jednom, 5 minuta)

### Korak 1 – GitHub

1. Idite na **github.com** → kliknite **+** → **New repository**
2. Naziv: `energocert` → kliknite **Create repository**
3. Na stranici repozitorija kliknite **uploading an existing file**
4. Povucite SVE datoteke iz ovog ZIP-a (raspakirajte prvo)
5. Kliknite **Commit changes**

### Korak 2 – Netlify

1. Idite na **netlify.com** → **Add new site** → **Import an existing project**
2. Odaberite **GitHub** → autorizirajte → odaberite `energocert` repozitorij
3. Build settings:
   - **Build command:** *(ostavite prazno)*
   - **Publish directory:** `.`
4. Kliknite **Deploy site**

### Korak 3 – API ključ

1. Idite na **console.anthropic.com/api-keys** → **Create Key**
2. U Netlify: **Site Settings** → **Environment variables** → **Add variable**
   - Key: `ANTHROPIC_API_KEY`
   - Value: vaš ključ koji počinje s `sk-ant-...`
3. **Deploys** → **Trigger deploy** → **Deploy site**

✅ Gotovo! Aplikacija radi na vašoj Netlify URL-u.

---

## Struktura datoteka

```
energocert/
├── index.html                  # Glavna stranica
├── netlify.toml                # Netlify konfiguracija
├── netlify/
│   └── functions/
│       └── claude.js           # Serverless proxy (čuva API ključ)
├── css/
│   └── style.css
└── js/
    ├── main.js                 # Inicijalizacija i event handleri
    ├── api.js                  # Claude AI pozivi
    ├── state.js                # Upravljanje podacima
    ├── ui.js                   # Navigacija i forme
    ├── photos.js               # Upravljanje fotografijama
    └── export.js               # Word izvoz
```
