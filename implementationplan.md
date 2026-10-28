Acesta este documentul central (sursa de adevăr) pentru echipa voastră. Pentru a nu avea conflicte de integrare la final, **regula de aur este ca ambele AI-uri (și cel de frontend, și cel de backend) să primească exact același contract JSON în prompt**.

Copiați textele de mai jos și dați-le agenților voștri de AI.

---

### PASUL 1: Contractul de API (Sursa de adevăr)

*Nu modificați aceste variabile. Dacă ambele AI-uri folosesc aceleași nume, frontend-ul se va lega de backend instant.*

**Request (Ce trimite Frontend-ul către Backend):**

```json
{
  "age": 24,
  "monthlyIncome": 4000,
  "guiltyPleasure": "Comenzi Tazz / Food delivery",
  "monthlyGuiltyPleasureSpend": 400
}

```

**Response (Ce întoarce Backend-ul către Frontend):**

```json
{
  "habitToChange": "Comenzi de mâncare",
  "monthlySavings": 200,
  "futureValueAt65": 125000,
  "investmentVehicle": "Titluri de stat Tezaur (fără taxe)",
  "actionMessage": "Dacă înlocuiești 2 comenzi Tazz pe săptămână cu gătitul acasă, la 65 de ani vei avea echivalentul unui apartament.",
  "confidenceScore": 85
}

```

---

### PASUL 2: Prompt-ul pentru FRONTEND (Membrul 1 - Lovable / v0 / Bolt)

*Copiază textul de mai jos și dă-l direct în Lovable/v0. Asigură-te că precizezi că e o aplicație React/Tailwind.*

> Construiește o interfață mobile-first pentru o aplicație financiară numită „Momentum”. Folosește React și Tailwind CSS. Designul trebuie să fie minimalist, modern, tipic Apple Wallet sau Stripe, cu mult spațiu alb și accente de mov/albastru electric.
> Aplicația va avea două stări principale:
> 1. **Starea de Onboarding (Formular):** Un formular curat unde utilizatorul introduce 4 date: `age` (număr), `monthlyIncome` (număr), `guiltyPleasure` (text, ex: 'Cafea') și `monthlyGuiltyPleasureSpend` (număr). Include un buton mare "Găsește-mi Momentumul".
> 2. **Starea de Loading:** Când se apasă butonul, arată un spinner modern cu textul "Analizăm stilul de viață...".
> 3. **Starea de Rezultat (Momentum Card):** După loading, afișează un card de impact maxim. Datele pentru acest card vor veni (deocamdată mock) din următorul JSON:
> `{"habitToChange": "Comenzi de mâncare", "monthlySavings": 200, "futureValueAt65": 125000, "investmentVehicle": "Titluri de stat Tezaur", "actionMessage": "Dacă înlocuiești 2 comenzi Tazz pe săptămână...", "confidenceScore": 85}`.
> 
> 
> **Sarcina tehnică:** Creează logica de `fetch` către `http://localhost:8000/api/momentum` prin metoda POST cu payload-ul din formular. Deocamdată, dacă API-ul dă eroare, folosește JSON-ul mock de mai sus ca fallback pentru a afișa cardul de rezultat. Cardul de rezultat trebuie să aibă un buton proeminent „Activează Regula”. Nu modifica numele variabilelor din JSON.

---

### PASUL 3: Prompt-ul pentru BACKEND & AI (Membrul 2 - Cursor / VS Code)

*Copiază textul de mai jos și dă-l AI-ului din Cursor (folosind un stack simplu precum Node.js/Express sau FastAPI, ori direct Next.js API Routes).*

> Construiește un API endpoint POST la ruta `/api/momentum`. Endpoint-ul va primi un body JSON cu structura: `{"age": 24, "monthlyIncome": 4000, "guiltyPleasure": "Tazz", "monthlyGuiltyPleasureSpend": 400}`.
> Misiunea acestui endpoint este să preia aceste date și să facă un apel către API-ul OpenAI (folosind baseURL-ul de la Featherless AI).
> 1. Configurează clientul OpenAI cu variabilele de mediu `API_KEY` și `BASE_URL`.
> 2. Trimite către modelul de LLM următorul System Prompt:
> "Ești un expert financiar comportamental din România. Primești vârsta, venitul și o cheltuială recurentă a unui tânăr. Găsește o modalitate de a reduce acea cheltuială (nu de a o elimina) și calculează empiric câți bani ar strânge până la 65 de ani dacă ar investi economiile în Titluri de Stat Tezaur (aprox 6% dobândă anuală). Nu ține prelegeri. Trebuie să returnezi răspunsul OBLIGATORIU în format JSON pur, fără markdown, cu următoarele chei exacte:
> `habitToChange` (string), `monthlySavings` (number), `futureValueAt65` (number), `investmentVehicle` (string), `actionMessage` (string, mesaj motivațional), `confidenceScore` (number 0-100)."
> 3. Asigură-te că endpoint-ul are CORS activat pentru a permite cereri de la `http://localhost:3000` sau `*`. Parsează răspunsul LLM-ului și returnează-l direct clientului.
> 
> 

---

### PASUL 4: Cum faceți unirea (Merge-ul) realizată de Membrul 3

Când Membrul 1 are interfața care arată bine pe date mock, iar Membrul 2 are backend-ul care răspunde corect în consolă/Postman, Membrul 3 face integrarea astfel:

1. Asigură-te că backend-ul rulează (ex: pe portul 8000) și frontend-ul rulează (ex: pe portul 3000).
2. Mergi în codul generat de frontend (Lovable/v0).
3. Găsește linia unde se face `fetch(...)`.
4. Asigură-te că url-ul este corect (punctând spre IP-ul laptopului de backend sau `localhost:8000` dacă le-ați pus în același proiect).
5. Deoarece **ambii ați folosit exact același contract JSON**, cardul vizual de pe frontend se va popula instantaneu și perfect cu datele reale venite de la Featherless AI prin backend. Nu veți avea nicio eroare de tip `undefined` sau `cannot read property of null`.