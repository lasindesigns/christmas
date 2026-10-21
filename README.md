# Slaptasis Kalėdų senelis

Profesionalus, Kalėdų tema dekoruotas tinklalapis, skirtas surengti slaptąjį
Kalėdų senelį tavo kompanijoje.

- **Neribotas dalyvių skaičius** – pridėk tiek, kiek nori.
- Kiekvienas dalyvis gauna savo **asmeninę kvietimo nuorodą**.
- **Organizatorius** turi valdymo skydą, kuriame gali pridėti dalyvius, bendrinti
  nuorodas ir stebėti, kas prisijungė bei kas jau traukė vardą.
- Organizatorius paspaudžia **Pradėti renginį** – rankinio burtų traukimo nėra, o
  renginys užrakinamas tik tiems dalyviams, kurie buvo įvesti. Nuo tos akimirkos
  kiekvienas dalyvis **traukia vardą iš dovanų maišo**, ir atsitiktinai
  atskleidžiamas vienas žmogus, kuriam jis dovanos dovaną.
- Traukimai **garantuotai sąžiningi**: niekas negauna savęs, o kiekvienas dalyvis
  dovanoja lygiai vieną dovaną ir gauna lygiai vieną dovaną (jokių pasikartojančių
  gavėjų, net ir traukiant vienu metu).
- Sukurta su **nulinėmis priklausomybėmis** (įmontuotas Node HTTP serveris ir
  įmontuotas SQLite). Nereikia `npm install`.

## Reikalavimai

- Node.js **22.5 arba naujesnė** (naudoja įmontuotą `node:sqlite` modulį).

## Paruošimas

1. (Nebūtina, bet rekomenduojama) Susikurk `.env` failą:

   ```ini
   PORT=3000
   OWNER_PASSWORD=tavo-slaptas-slaptažodis
   ```

   Gali nusikopijuoti `.env.example`. Jei jo nėra, organizatoriaus slaptažodis
   bus numatytasis `admin`, o paleidus bus rodomas įspėjimas.

2. Paleisk serverį:

   ```powershell
   npm start
   ```

   Arba tiesiogiai: `node src/server.js`

3. Atidaryk svetainę:
   - Pradžios puslapis: <http://localhost:3000/>
   - Organizatoriaus skydas: <http://localhost:3000/owner>

## Kaip naudotis

1. Prisijunk adresu `/owner`.
2. Pridėk dalyvius (tiek, kiek reikia). Kiekvienam sukuriama asmeninė nuoroda.
3. Nusiųsk kiekvienam dalyviui jo nuorodą („Kopijuoti“). Skydas rodo, kas ją
   atidarė.
4. Kai visi susirenka, paspausk **Pradėti renginį**.
5. Dalyviai atidaro savo nuorodą ir paspaudžia **Traukti vardą!**, kad sužinotų savo
   žmogų. Dalyvis gali traukti tik vieną kartą.
6. Stebėk eigą skydelyje. Skydelis **Kas kam dovanoja** rodo visą
   kas-kam-dovanoja žemėlapį (tik organizatoriui).
7. Paspausk **Baigti renginį**, kad uždarytum traukimą, **Atidaryti iš naujo**, kad
   pratęstum, arba **Atstatyti**, kad viską išvalytum ir grįžtum į ruošimą.

## Kaip veikia sąžiningumas

Išankstinio burtų traukimo nėra. Kai dalyvis traukia vardą, serveris atsitiktinai parenka
jam dovanos gavėją, bet pirmiausia patikrina, ar likusius dalyvius vis dar galima
visus suporuoti (nedidelė dalių suderinimo patikra faile `src/assign.js`). Tai
išlaiko kiekvieną traukimą atsitiktiniu ir saugiu traukiant vienu metu, garantuodamas:

- niekas nedovanoja sau;
- nėra pasikartojančių gavėjų;
- kiekvienas suporuojamas lygiai vieną kartą.

## Duomenys

Viskas saugoma `data/santa.db` (SQLite), sukuriama automatiškai ir ignoruojama
git. Ištrynus šį failą atstatomas visas renginys.

## Projekto struktūra

```
src/
  server.js   HTTP serveris ir JSON API
  db.js       SQLite schema ir užklausos
  assign.js   sąžiningas atsitiktinis gavėjo parinkimas
  auth.js     organizatoriaus slaptažodis + sesijos
  env.js      mažas .env kroviklis
public/
  index.html  pradžios puslapis
  owner.html  organizatoriaus skydas
  player.html dalyvio dovanų maišo puslapis
  js/         puslapių skriptai (landing, owner, player)
  css/styles.css
```

## Kaip paskelbti, kad pasiektų kiti

Paleisk serverį ten, kur jis pasiekiamas, ir dalinkis
`http://<tavo-host>:<PORT>/join/<kodas>` nuorodomis. Naudok stiprų
`OWNER_PASSWORD`.
