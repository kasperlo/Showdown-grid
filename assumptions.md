# Assumptions og beslutninger

Kontekst, antakelse, beslutning, begrunnelse og oppfølging for valg som ikke er
åpenbare fra koden. Nyeste først.

## 2026-09-17 — Brukerbytte tømmer store, og kontomenyen finnes på alle sider

- **Kontekst:** Kasper prøvde å logge ut av gjestebrukeren og inn på en ekte
  konto, og kom ikke fram. Tre ting stod i veien samtidig.
- **Feil 1, den alvorligste:** utlogging kalte `resetGame()`, som nullstiller
  poeng men beholder quizen. Store overlever klientside-navigasjon, så neste
  gjest — eller den ekte kontoen du nettopp logget inn på — åpnet rett i forrige
  brukers quiz, og `useQuizBootstrap` kortsluttet på den gamle `activeQuizId` i
  stedet for å laste riktig quiz. Verifisert i nettleseren: etter utlogging og
  «Fortsett som gjest» sto forrige gjests quiz på skjermen.
- **Beslutning:** `resetForNewUser()` i store tømmer alt som hører til en bruker,
  og kalles ved innlogging, registrering, gjestestart og utlogging. Query-cachen
  tømmes samtidig.
- **Feil 2:** kontomenyen fantes bare i spillhodet. En gjest uten quizzer havner
  alltid på `/quizzes`, og der fantes ingen vei til utlogging eller innlogging.
  Menyen leser nå brukeren fra store i stedet for props, og ligger på både
  spillsiden og biblioteket.
- **Feil 3:** gjestemenyen hadde bare «Opprett konto». Har du alt en konto, var
  det ingen inngang. Lagt inn «Logg inn på konto», som logger ut gjesten og går
  til `/login`.
- **Tilbake-knappen:** pilen på `/quizzes` pekte til `/`, som sender deg rett
  tilbake til `/quizzes` når du ikke har en aktiv quiz. Den vises nå bare når det
  finnes et brett å gå tilbake til.
- **Detalj:** `session.user.is_anonymous` mangler i objektet fra
  `onAuthStateChange`. Med `?? false` ble gjester merket «Bruker» og mistet
  innloggingsvalget. Faller nå tilbake på at en bruker uten e-post er gjest.
- **Antakelse:** hver ekte konto i denne appen har e-post (e-post/passord er
  eneste registreringsvei). Holder det ikke lenger, må gjestesjekken gjøres om.

## 2026-09-17 — Malen og spillet er to ting, lagret hver for seg

- **Kontekst:** `quizzes.quiz_data` inneholdt både quizen og tilstanden fra
  spillingen. Ett trykk på «Lagre» etter en quizkveld skrev `answered: true` og
  sluttpoengene inn i selve quizen, så brettet var ferdigspilt neste gang den ble
  åpnet.
- **Beslutning:** malen (kategorier, spørsmål, laginndeling, innstillinger) bor i
  `quizzes.quiz_data`. Alt som hører til én spilling bor i
  `quiz_runs.final_state` som `answeredKeys: ["kategori|indeks", …]` pluss en
  poengtabell per lag-id. `utils/quiz-template.ts` eier konverteringen begge
  veier, og `lib/sanitize-template.ts` håndhever malformen på serveren.
- **Begrunnelse:** to lagringssteder er den eneste måten å ha både en ren mal og
  en pågående økt samtidig. At serveren vasker malen betyr at ingen gammel fane
  eller cachet bundle kan ødelegge den igjen.
- **Antakelse som bør verifiseres:** at alle eksisterende rader leses riktig.
  Begge former støttes ved lesing (`liveStateFromRunState`,
  `templateFromQuizData`), og gamle rader med spilt tilstand i malen får den
  strippet ved innlasting — men det er ikke kjørt mot hele produksjonsbasen.
- **Konsekvens:** `answeredKeys` er nøklet på kategorinavn. Endrer du navnet på
  en kategori midt i en pågående økt, mister de spørsmålene markeringen «brukt».
  Alternativet, posisjon i arrayet, gjør at et slettet spørsmål flytter
  markeringen til nabospørsmålet — det er verre, fordi det ser riktig ut.
- **Oppfølging:** kjør en økt på en gammel quiz i produksjon før neste quizkveld.

## 2026-09-17 — Autolagring på, men bare av malen

- **Kontekst:** `store.isLoading` ble initialisert til `true` og aldri satt til
  `false`, og AppProvider lagret bare når den var `false`. Hele autolagringen var
  død kode. Endringer i oppsettet ble kun lagret ved å trykke «Lagre».
- **Beslutning:** `hooks/useTemplateAutoSave.ts` lagrer 1,2 sekunder etter siste
  endring, og bare når et fingeravtrykk av *malen* har endret seg. Poeng og
  besvarte spørsmål gir ingen skriving.
- **Begrunnelse:** uten autolagring mister man arbeid ved å navigere bort. Med
  naiv autolagring skriver man hele quizen hver gang noen får poeng.
- **Detalj som biter:** debouncen kan være *eldre* enn tilstanden, ikke bare
  nyere. Ved innlasting byttes brettet momentant mens debouncen fortsatt holder
  forrige brett i 1,2 sekunder. Første forsøk skrev derfor det appen hadde FØR
  lastingen — et tomt brett uten tittel, som serveren avviste med 400.
  Løsningen er å bare skrive når debouncen har landet på gjeldende verdi.

## 2026-09-17 — Live-tilstanden speiles i localStorage

- **Beslutning:** etter hver poenghandling skrives økttilstanden til
  `localStorage` under `jeoparty:live:<quizId>`. Ved lasting brukes den bare hvis
  den har *strengt mer* progresjon enn serveren, og bare hvis den er under 12
  timer gammel.
- **Begrunnelse:** serverskrivingen kan feile på dårlig wifi midt i en quizkveld.
  «Strengt mer progresjon» er valgt framfor tidsstempel fordi klokka på klienten
  ikke er til å stole på.
- **Kjent begrensning:** spiller du samme quiz i to nettlesere samtidig, kan den
  ene dra den andres progresjon tilbake. Det var ikke støttet før heller.

## 2026-09-17 — «Fullfør økt» nullstiller brettet

- **Kontekst:** etter fullføring ble poengene liggende på skjermen, men
  live-tilstanden de kom fra var slettet. Første refresh viste et tomt brett, og
  dialogen påsto det motsatte.
- **Beslutning:** fullføring arkiverer økten i historikken og gir brettet tilbake
  rent. Dialogteksten sier det, og resultatene finnes i historikken.
- **Alternativ som ble forkastet:** beholde poengene i minnet. Da er skjermen
  uenig med databasen fra det sekundet noen laster siden på nytt.

## 2026-09-17 — POST /api/quiz er fjernet

- **Beslutning:** endepunktet som skrev hele spilltilstanden inn i quizzen er
  slettet. Lagring går gjennom `PATCH /api/quizzes/[id]`. `GET /api/quiz` er
  beholdt.
- **Begrunnelse:** det var mekanismen bak malødeleggelsen, og det opprettet i
  tillegg en helt ny quiz hvis brukeren ikke hadde en aktiv — et mislykket
  «lagre» kunne gi en duplikat man ikke ba om. Et ubrukt endepunkt blir kalt
  igjen om et halvår.

## 2026-09-17 — Tester bare på den usynlige logikken

- **Beslutning:** Vitest dekker `utils/quiz-template.ts`, `utils/ranking.ts`,
  `utils/board-import.ts`, `utils/live-snapshot.ts` og
  `lib/sanitize-template.ts`. 38 tester. Ingen komponenttester.
- **Begrunnelse:** en feil i hva som skrives til databasen, i hvilken kopi av en
  økt som vinner, eller i hvem rangeringen sier vant, er usynlig helt til noe er
  tapt. UI-feil ser man. Kasper har sagt at bare kritiske deler trenger tester.
