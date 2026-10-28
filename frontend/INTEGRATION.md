# Oasis — integrarea echipei

## Ce este implementat (Membrul 1)
Dashboard React/Tailwind la `/` și `/dashboard`, sold inițial 5000 RON, oraș nivel 1, acceptarea provocării, recompense vizuale, retragere cu confirmare și oraș abandonat. Toate sumele sunt simulate, în memorie; reîncărcarea paginii resetează demonstrația.

## Diferența de platformă — important pentru ambii colegi
Acest proiect rulează **TanStack Start**, nu Next.js. Fișierele `app/dashboard/page.tsx`, `app/api/oasis/route.js`, `app/login/page.tsx` și middleware-ul NextAuth din document **nu pot fi copiate direct aici**. Contractul HTTP poate fi păstrat, dar echipa trebuie să adapteze backend-ul și autentificarea la TanStack sau să integreze componentele React în proiectul Next.js comun. Nu sunt implementate login, protecție de rute sau endpoint AI în acest frontend.

## Membrul 2 — AI
- Frontend-ul face `POST /api/oasis`, `Content-Type: application/json`, `Accept: application/json`, body `{}`. Extrasul fictiv este definit de backend, nu de frontend.
- Returnați HTTP 200 cu un obiect JSON direct (nu text markdown și nu `{ data: ... }`):
```json
{
  "questTitle": "Operațiunea: Salvatorul de Cafea",
  "analysisMessage": "Am observat că ai plătit 6 cafele săptămâna trecută (120 RON).",
  "proposalMessage": "Cumpără doar 4 cafele și economisește 40 RON pentru o Cafenea și o Pisicuță.",
  "amountToSave": 40,
  "virtualReward": "Cafenea & Pisicuță",
  "rewardType": "building"
}
```
- Primele cinci câmpuri sunt obligatorii; `amountToSave` trebuie să fie număr finit pozitiv. `rewardType` este opțional: exemplul îl conține, promptul backend nu îl cere. Orice string este acceptat; `building`, `nature`, `pet` pot ghida reprezentarea.
- Pentru un backend separat, configurați `VITE_OASIS_API_URL` cu URL-ul HTTPS complet înainte de publicare. Nu este configurat un server implicit localhost.
- Dacă folosiți altă origine, permiteți originea exactă a frontend-ului, POST/OPTIONS, Content-Type/Accept și credentials prin CORS; nu folosiți `*` cu cookies. Cookies cross-site necesită politica SameSite/Secure potrivită. Aceeași origine este mai simplă.
- În TanStack, prefixul de rute externe este `/api/public/*`; colegul care implementează handler-ul trebuie să verifice apelantul și poate seta frontend-ul către acel URL prin `VITE_OASIS_API_URL`. Cerințele de autentificare nu trebuie ocolite.
- Timeout 12 secunde, răspuns invalid, HTTP non-200 sau server absent: UI folosește contractul demo și afișează explicit acest lucru. 401/403 indică necesitatea autentificării, fără login simulat.

## Membrul 3 — autentificare
- `/dashboard` există pentru redirectul de după login. Protejați atât `/`, cât și `/dashboard`, și verificați sesiunea și în API.
- Cererile frontend trimit `credentials: include`; sistemul actual nu inventează sesiuni, emailuri sau tokenuri.
- Componenta `UserNav` poate fi introdusă în header-ul dashboardului după integrarea autentificării reale.
- Acceptarea și retragerea nu trimit cereri de investiție către server: documentul cere exclusiv modificarea stării simulate. Persistența și bani reali necesită un contract separat.

## Verificare comună
Rulați API-ul, autentificați utilizatorul prin implementarea colegului, deschideți `/dashboard`, confirmați eticheta „AI conectat”, acceptați provocarea și verificați reducerea soldului cu suma returnată. Verificați CORS/cookies dacă originile sunt diferite. Testarea frontend-ului cu răspuns interceptat nu dovedește conectarea backend-ului real.