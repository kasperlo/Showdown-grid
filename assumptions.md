# Assumptions og beslutninger

Kontekst, antakelse, beslutning, begrunnelse og oppfølging for valg som ikke er
åpenbare fra koden. Nyeste først.

## 2026-09-17 — Kodeblokker på kort

- **Kontekst:** en «Kode»-kategori der spørsmålet er «hva printes?» og kortet må
  vise en kodesnutt med linjeskift og innrykk i behold.
- **Beslutning:** eget felt `code` på spørsmålet, ikke markdown-gjerder inne i
  spørsmålsteksten. Kortet skal både spørre om noe og vise koden, og å tolke
  ```-gjerder ut av fritekst er å gjette på hva forfatteren mente.
- **Visning:** `<pre><code>` venstrestilt i en ramme under spørsmålet, monospace,
  og den ruller sidelengs i stedet for å brytes. En brutt linje endrer hva
  snutten betyr. Svaret på et kodekort vises også i monospace, siden svaret
  gjerne *er* kode (`"object"`, `[1, NaN, NaN]`) og hermetegn og klammer må
  overleve.
- **Ferdigstatus:** kode alene dekker spørsmålssiden av kortet. «Hva printes?»
  er valgfritt pynt når snutten står der.
- **Tab i kodefeltet** gir to mellomrom i stedet for å flytte fokus. Uten det
  kan man ikke skrive innrykket kode i det hele tatt, bare lime den inn.
- **Lim-inn:** femte kolonne er kode, og `\n` i den kolonnen blir et ekte
  linjeskift. Importen er linjebasert, så et reelt linjeskift ville avsluttet
  raden — dette er den eneste veien til en flerlinjet snutt uten å skrive den
  inn i kortet.
- **Ingen syntaksfarging.** Det krever et bibliotek, og handoffen sier nei til
  nye avhengigheter. Monospace med god kontrast er nok til å lese fire linjer
  JavaScript fra bakerste rad.
- **Sidefunn:** `font-mono` pekte ikke på Geist Mono, selv om fonten alt lastes
  i `app/layout.tsx`. Nå mappet i `tailwind.config.ts`.

## 2026-09-17 — Redigering flyttet ut på brettet (design 2a)

Bygget etter handoffen i `design_handoff_quiz_admin`, retning 2a, med fire valg
avklart med eier før bygging:

- **`/setup` er erstattet.** Ruta ligger igjen som en redirect til
  `/?mode=edit`, så gamle lenker og tannhjulet lander riktig. Lag og
  innstillinger (tema, tid, offentlig, lim-inn, JSON) ligger nå i «Lag»- og
  «Regler»-sheets fra redigeringslinja.
- **Ingen dra-og-slipp i denne runden.** Omrekkefølge gjøres fra
  kategorimenyen. Håndrullet dra-og-slipp er den største enkeltbiten i designet,
  og upresis på mobil; kan legges på senere uten å røre datamodellen.
- **Poeng følger posisjonen, ikke kortet** (`normalizePoints`). En kolonne leser
  alltid stigende. Flytter du et kort, arver det poengene til plassen det
  havner på. Alternativet gir kolonner som 100-200-200-400, og da ser brettet
  ødelagt ut for laget.
- **Live-linjen er utsatt** til en egen runde. Live-retting fungerer i
  mellomtiden gjennom samme panel.

**Avvik fra handoffen, etter «så lite støy som mulig»:**

- Hjelpetekstene er ute. Det som var verdt å beholde ligger i `title`-attributter
  (tooltips): maksstørrelse på bilde, hva nullstilling gjør, hva tastene gjør.
  Handoffens «Kolonnen blir en kategori når du gir den navn», «Bytter kortet til
  en oppgave», «Overstyrer 60s for dette kortet» og tastaturhint-raden er fjernet.
- Tittelen har ingen ramme før du peker på den. En permanent stiplet boks rundt
  den største teksten på siden er det høyeste elementet i rommet.
- Bildefeltet er kollapset til en liten «Bilde»-knapp til det brukes.
- Bare kortet du står på får nummer-merke. Handoffen viser «1 AV 3» på alle i
  køen, men med 29 mangler blir det 29 etiketter som konkurrerer med spørsmålene.
- Fremdriftslinja er én strek når køen er over 12 kort, ellers ett segment per
  kort.
- Modusbryteren ligger i spillhodet, ikke i en egen rad, så spillmodus har
  nøyaktig én rad med kontroller.

**Beslutninger som ikke stod i handoffen:**

- «Neste» går videre til neste kategori når kolonnen er tom — køen er en flat
  liste i lesretning, så det skjer av seg selv.
- Køen huskes ikke når panelet lukkes; den bygges på nytt. En kø som peker på
  kort du har endret i mellomtiden er verre enn å starte om.
- Gjennomgang kan startes fra en kategori-header («Gå gjennom kolonnen»).
- Panelet monteres bare for ett brekkpunkt av gangen. `hidden xl:block` er ikke
  nok når de to variantene er et panel og en Sheet: Sheet-ens overlay dimmer
  siden bak skrivebordspanelet, og begge kopiene registrerer de samme
  tastatursnarveiene.

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

## 2026-09-17 — Lag kan opprettes mens quizen kjører

- **Beslutning:** «Stilling» har fått en «Lag»-knapp og et inline navnefelt, og
  lagmodalen har fått navneendring og fjerning. Ingenting av dette krever
  redigeringsrettigheter på quizen.
- **Begrunnelse:** den som holder quizen er ofte ikke den som lagde den, og
  lagene finnes først når folk har satt seg. Før dette lå lagoppsettet bare i
  redigeringsmodus, som en gjest eller en annen bruker ikke kommer inn i —
  verten hadde ingen vei til å legge til et lag.
- **Vurdert og forkastet:** å åpne redigeringsmodus for alle. Det gir verten
  tilgang til å endre spørsmålene midt i quizen, som er verre.
- **Oppfølging:** quizen har tre plassholderlag («Lag 1/2/3») som verten må
  døpe om. Navneendring ligger bak et trykk på laget i stillingen.

## 2026-09-17 — Lagendringer speiles til localStorage med en gang

- **Beslutning:** `addTeam`, `removeTeam` og `updateTeamName` kaller
  `snapshotLiveState()`.
- **Begrunnelse:** lag tastes inn før første spørsmål er åpnet, og det er
  spørsmålet som oppretter økten på serveren. Uten snapshot var en refresh i
  det vinduet nok til å miste alle lagnavnene.

## 2026-09-17 — Dokken skjules mens spørsmålet vises

- **Beslutning:** `RoundDock` rendrer ingenting når `isQuestionOpen` er sann.
  Teksten «Lukk spørsmålet for å tildele poeng» er borte.
- **Begrunnelse:** dokken lå synlig men død bak spørsmålsvinduet, og leste som
  en andre konkurrerende flate til den skjermen rommet ser på.

## 2026-09-17 — Én vei videre ut av en runde

- **Beslutning:** «Ingen» og kryss-ikonet er erstattet av én knapp som skifter
  tekst: «Ingen klarte den» før noe er tildelt, «Neste spørsmål» etter. Over
  brikkene står én linje som sier hva som skal gjøres («Hvem svarte riktig?»,
  eller «300 poeng til Bordet ved baren» når det er gjort).
- **Begrunnelse:** etter en tildeling ble alle brikkene deaktivert uten at noe
  pekte videre. `skipQuestion` og `endRound` gjorde dessuten presis det samme,
  så to knapper konkurrerte om samme handling. `skipQuestion` er slettet.

## 2026-09-17 — Escape avslutter ikke runden

- **Beslutning:** dokkens hurtigtaster er tall 1–9, R, F og N. Escape og Enter
  er bevisst ikke bundet.
- **Begrunnelse:** begge er i lufta fra spørsmålsvinduet i det øyeblikket
  dokkens vindus-lytter monteres. Å lukke vinduet med Escape lot samme
  tastetrykk nå lytteren og kalle `endRound()` — kortet ble markert spilt og
  poengtildelingen hoppet over. Verifisert i nettleser før og etter.

## 2026-09-17 — Spillmodus er én skjerm, ikke en side som skrolles

- **Beslutning:** spillsiden er tre rader som til sammen er nøyaktig
  vindushøyden: topplinje, brett, stilling. Brettet får det de to andre lar
  være igjen, og flisene skalerer etter det.
- **Målt før:** på 1920×1080 var siden 1622 px høy. Toppen tok 236 px,
  brettet 656 px, og «Stilling» begynte på y=1101 — 21 px under folden. Salen
  så aldri poengene mens brettet var oppe.
- **Målt etter:** topplinje 68 px, brett 923 px, stilling 89 px, sum 1080,
  ingen skroll. Flishøyden gikk fra 96 til 160 px. Verifisert på 1280×800,
  1440×900, 1600×900, 1920×1080, 375×812, 812×375 og 320×568.
- **Vurdert og forkastet:** stillingen som en kolonne til høyre for brettet.
  Et Jeopardy-brett er bredt, og et sidepanel på 300 px spiser av
  kolonnebredden der den betyr mest.

## 2026-09-17 — Dokken og stillingen deler samme rad

- **Beslutning:** nederste rad viser stillingen mellom spørsmål og
  poengdokken under en runde — aldri begge.
- **Begrunnelse:** dokken lister hvert lag med poengsummen sin, så salen mister
  ingenting mens den er oppe. Da dokken var `fixed`, dekket den øverste lagrad
  i stillingen den skulle stå ved siden av.
- **Oppfølging:** raden har tak på 45vh og skroller internt. Med ti lag på
  320 px er brettet nede i 257 px — trangt, men ingenting er utilgjengelig.

## 2026-09-17 — «Salen»: fullskjerm uten verktøylinje

- **Beslutning:** én knapp skjuler bibliotek, historikk, modusbryter,
  lagringsindikator, resultatknapp og kontomeny, og ber om fullskjerm samtidig.
  Finnes både på brettet og på resultatsiden.
- **Begrunnelse:** grunnen til å skjule verktøylinja er at en projektor viser
  den til tretti mennesker — og nettleserens egne faner og adressefelt er på
  samme projektor. Å løse én av dem er å løse halve problemet.
- **Vurdert og forkastet:** å lagre valget i localStorage. Verten vil ikke at
  appen skal starte uten verktøylinje neste gang de åpner den alene.
- **Kjent begrensning:** fullskjerm kan avslås (iOS Safari, policy). Da skjules
  verktøylinja likevel — verifisert, det er nettopp det som skjer i
  forhåndsvisningsruten.

## 2026-09-17 — Laget som tar kortet beholder turen

- **Beslutning:** `endRound` gir turen til laget som fikk poengene. Rotasjon i
  lagrekkefølge er nå bare reserven for kort ingen vant.
- **Begrunnelse:** slik spilles Jeopardy ved bordet. Før roterte turen uansett
  hvem som svarte, så verten måtte si «nei, det er fortsatt din tur» høyt etter
  hvert kort.
- **I tillegg:** lagmodalen har fått «Gi turen til X», så verten kan overstyre
  uten å vente på rotasjonen.

## 2026-09-17 — Typografi som skalerer mot vindushøyden

- **Beslutning:** poeng, kategorinavn, spørsmål, svar og poengsummer bruker
  `clamp(min, Nvh, max)` i stedet for faste brytepunkter. Spørsmålet er 58 px på
  1920×1080, svaret 67 px, kodeblokken 33 px.
- **Begrunnelse:** det samme oppsettet må leses fra bakerste bord på projektor
  og fra sofaen på en laptop. Faste `sm:`/`md:`-størrelser følger bredden, og
  det er høyden som avgjør hvor stort noe kan være her.
- **Unntak:** stillingens tall skalerer først fra `sm`. På 375 px ga
  høydeskaleringen 28 px poengsum i en 144 px pille, og lagnavnet ble klippet.

## 2026-09-17 — Kolonnene har tak på bredden

- **Beslutning:** `minmax(6rem, 16rem)` i stedet for `1fr`, og brettet
  sentreres.
- **Begrunnelse:** med fire kategorier strakk `1fr` hver flis til 468 px på en
  projektor, som leser som en meny og ikke som et brett. Syv kolonner fyller
  fortsatt 1920 px (256 px hver).

## 2026-09-17 — Resultatsiden er finalen, ikke en rapport

- **Beslutning:** podiet ER kunngjøringen. Den separate «Vinner»-seksjonen er
  fjernet, navnene på podiet skalerer med vindushøyden, medaljeforklaringen
  under er borte, og trinnene måles i vh.
- **Begrunnelse:** vinnerlaget ble kunngjort i 14 px, to ganger på samme side.
  Forklaringen under podiet forklarte tallene 1, 2 og 3, som sto rett over den.
- **Oppdaget underveis:** åtte lag på null poeng deler plass 2, og å navngi
  alle på trinnet gjorde kolonnen høyere enn podiet. Maks tre navn, så
  «+N flere». Med færre enn tre trinn droppes sølv-gull-bronse-rekkefølgen —
  med to trinn plasserte den vinneren til høyre.

## 2026-09-17 — Topplinja rydder seg selv under sm

- **Beslutning:** under 640 px skjules bibliotek, historikk, «Salen» og
  tur-pillen. Modusbryteren og kontomenyen blir ikon uten tekst. Bibliotek og
  historikk er lagt inn i kontomenyen så de aldri blir utilgjengelige.
- **Begrunnelse:** på 320 px var det flere kontroller enn plass — tittelen ble
  presset til null bredde og kontomenyen lå 21 px utenfor skjermkanten.
- **Vurdert og forkastet:** å la linja brytes til to rader. Det er høyde
  brettet trenger mer.

## 2026-09-17 — Prettier ble kjørt og rullet tilbake på store.ts

- **Beslutning:** `npx prettier` er ikke brukt på filer jeg bare endret noen
  linjer i. `utils/store.ts` ble tilbakestilt og endringen lagt inn på nytt.
- **Begrunnelse:** prosjektet har ingen prettier-config og ingen
  prettier-dependency, så `npx` henter v3 med andre defaults enn koden rundt.
  Én reell endring i store.ts ble +80/−42 av ren formatering. Etter
  tilbakestilling: +13/−1.
