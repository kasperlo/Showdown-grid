# Redesign av spillmodus — handoff

Spec for fem endringer i Showdown Grid, utledet fra en UX-gjennomgang av
`feat/play-mode-for-the-room` i september 2026. Alle tall her er regnet ut, ikke
gjettet: bygg mot dem i stedet for å utlede dem på nytt.

Designet ligger som artboards på
<https://claude.ai/artifact/87e61255-eda9-4d7d-ae51-30d6381cec80>.

**Branch:** `feat/round-flow-and-board-geometry`, avgrenet fra
`feat/play-mode-for-the-room`. Working tree er identisk med utgangspunktet.

**Tester:** vitest er satt opp (`vitest.config.mts`). Eksisterende suiter dekker
`card-status`, `quiz-template`, `board-import`, `live-snapshot` og `ranking`.
Kjør dem før og etter hver del.

---

## Del 1 — Brettets geometri

### Problemet

Brettet sentreres inne i sin egen `flex-1`-seksjon i `GameStage.tsx`, mens
stillingen er naglet til høyre kant. All slakk samler seg mellom dem. På
2560×1440 med fire kategorier blir brettet 1188 px i et felt på 2176 px, og de
~500 tomme pikslene leser som et hull midt på skjermen.

Kolonnetaket `minmax(6rem, 18rem)` i `GameBoard.tsx` er dessuten en breddegrense
på et høydeproblem. Flisene bytter proporsjon med skjermen i stedet for å holde
seg: 288×169 på 1080p, 288×243 på 1440p.

Og brettet endrer høyde to ganger per spørsmål, fordi `bottomRowHasContent` er
falsk når stillingen står ved siden av og ingen runde går.

### Regnestykket

```
BAR      = 51    // toppbaren, 48 px rad + 3 px fremdriftslinje
PAD      = 12    // py på innholdsraden, topp og bunn
SIDE     = 24    // px på innholdsraden
DOCK     = 128   // bunnraden — ALLTID reservert, også når den er tom
GAP      = 12    // mellom fliser
PANELGAP = 20    // mellom brett og stilling
HEADF    = 0.62  // kategoriradens høyde som andel av en flis
ASPECT   = 1.9   // maks bredde/høyde på en flis
MINCOL   = 140   // smaleste kolonne som fortsatt er lesbar bakerst i et rom

panelW      = clamp(272, 0.19 * vw, 432)
panelBeside = N*MINCOL + (N-1)*GAP + panelW + PANELGAP <= vw - 2*SIDE
avail       = vw - 2*SIDE - (panelBeside ? panelW + PANELGAP : 0)

boardH = vh - BAR - 2*PAD - DOCK
tileH  = floor((boardH - (R+1)*GAP) / (R + HEADF))
headH  = round(tileH * HEADF)
colW   = floor(min(tileH * ASPECT, (avail - (N-1)*GAP) / N))
```

`N` = antall kategorier, `R` = høyeste antall spørsmål i en kategori.

Høyden driver størrelsen, bredden setter taket. Slakken som blir igjen havner i
margen utenfor, ikke mellom brettet og stillingen.

### Implementasjon

Legg formelen i `utils/board-geometry.ts` og eksporter både en ren funksjon
(testbar) og CSS-variablene den produserer. Del 5 bruker den samme.

Høydeavhengigheten kan gjøres i ren CSS med container queries, uten JS-måling:
sett `container-type: size` på flex-barnet som eier brettarealet, og regn
`--tile-h: calc((100cqh - (R + 1) * 12px) / (R + 0.62))`. Bare `panelBeside`
trenger viewport-bredden, og den beholder `useMediaQuery` som i dag — men med
terskelen over, ikke dagens `COMFORTABLE_COLUMN`-variant.

Sentreringen er selve fiksen: raden som holder brett og stilling får
`justify-content: center`, og **brettet er ikke `flex: 1`** lenger. Det er
innholdsstørrelse. Stillingen beholder `flex: 0 0 var(--panel-w)`.

Typografien må løsnes fra `vh` og henges på flisa:

| Element | I dag | Skal være |
|---|---|---|
| Poengtall på flis | `clamp(1.1rem, 3.4vh, 2.75rem)` | `0.33 × tileH` |
| Kategorinavn | `clamp(0.65rem, 2.1vh, 1.6rem)` | `0.27 × headH`, minst 13 px |
| Lagnavn i stillingen | `clamp(0.85rem, 2.2vh, 1.45rem)` | `0.22 × radhøyde` |
| Poengsum i stillingen | `clamp(1.2rem, 3.6vh, 2.5rem)` | `0.42 × radhøyde` |

Stillingspanelet: radene skal fylle kolonnen i stedet for å stable seg øverst.
`<li style="flex: 1 1 0; min-height: 76px; max-height: 164px">`, og `<ol>` får
`justify-content: center`. Under listen kommer turindikatoren som et eget felt
(«DET ER TUREN TIL» + lagnavn stort) — den flyttes ut av toppbaren, der den i
dag er en pille på 23 px.

### Filer

`components/GameStage.tsx`, `components/GameBoard.tsx`,
`components/Standings.tsx`, `components/GameTopBar.tsx` (turindikatoren ut),
`hooks/useMediaQuery.ts` (terskelen), `app/globals.css`
(`.points-chip`, `.category-header`), ny `utils/board-geometry.ts`.

### Akseptansekriterier

| Oppsett | Kolonne | Flis | Brett | Panel | Marg per side |
|---|---|---|---|---|---|
| 5 kat × 5 rader @ 1920×1080 | 271 | 271×143 | 1403 | 365 | 42 |
| 4 kat × 5 rader @ 2560×1440 | 393 | 393×207 | 1608 | 432 | 226 |
| 7 kat × 5 rader @ 1366×768 | 165 | 165×87 | 1227 | i bunnraden | 45 |

Dessuten:

- Brettets høyde endrer seg ikke når en runde starter eller slutter.
- Ingen scroll i noen av oppsettene over.
- Med 3 kategorier på ultrabred skjerm blir margen stor, men **symmetrisk**.
  Det er riktig oppførsel, ikke en feil.

---

## Del 2 — Runden i fire steg

Erstatter `QuestionModal.tsx` (Radix Dialog) og `RoundDock.tsx` (stripe i
bunnen). Runden tar over hele siden i stedet for å legge seg oppå brettet.
Brettets tilstand ligger i store-en, så det er trygt å avmontere det.

### Stegene

| Steg | Skjermen | Én stor CTA | Farge |
|---|---|---|---|
| `question` | Spørsmålet stort, stillingen som tynn linje nederst | **Vis svar** | grønn |
| `answer` | Spørsmålet lite over, svaret stort, forklaring under | **Tildel poeng** | gull |
| `award` | «Hvem svarte riktig?» + store lagkort. Kortet (spørsmål + svar) i venstre sidekolonne, 480 px | ingen — lagkortene er handlingen | — |
| `awarded` | Kvittering: «300 poeng til Lag 2», `900 → 1200`, «Lag 2 velger neste kort» | **Neste spørsmål** | blå |

Fargekodingen er ikke pynt: den sier hvilket steg man er på uten å lese.
Grønn avslører, gull tildeler, blå går videre.

Sidekolonnen i `award` og `awarded` er det som gjør at salen ikke mister
konteksten mens poengene deles ut. Den viser spørsmålet på 24 px, svaret på
46 px i accent, og forklaringen på 17 px.

### Tilstand

Bytt ut `isQuestionOpen: boolean` med
`roundStep: 'question' | 'answer' | 'award' | 'awarded' | null`.
`lastQuestion` og `round` beholdes som de er.

Ny store-action: `undoLastAward()`. Tildelingen legger en oppføring i
`adjustmentLog` som undo popper. «Angre» i `awarded` bruker den, og skal ta
laget tilbake til forrige sum uten å avslutte runden.

### Tastatur

- `Mellomrom` — `question` → `answer` → `award`
- `1`–`9` — gi poeng til lag n (bare i `award`)
- `Shift` + `1`–`9` — trekk fra lag n (bare i `award`)
- `N` — avslutt runden (fra `award` og `awarded`)
- `Escape` — avbryt runden uten poeng (bare fra `question`)

Én `useEffect` per steg med sin egen handler. Sjekk steget inne i handleren når
den kjører, ikke bare i dependency-arrayen, og ignorer `event.repeat`. Se
fallgruve 1 nederst: dette har brukket før.

### Poengverdi

Stepper med `−` og `+`, steg 50, minimum 0, ikke et fritt tallfelt. Trekk er
`round(points * 0.5)` og står som etikett på trekk-knappen («Trekk 150 fra et
lag»), ikke som et eget felt.

Trekk-knappen ligger i sin egen boks **under** lagkortene, ikke inntil dem.
Klikk på den bytter lagkortene til rød variant for ett trekk, så går den
tilbake. Grunnen: i en tidligere versjon lå minusen som en sone i kanten av
hvert lagkort, og det gjorde hovedhandlingen tvetydig.

### Det som skal beholdes

- `Timer` uendret i `question`-steget.
- Joker: nedtelling og «TIDEN ER UTE» som i dag, i `question`-steget.
- Kodekort: `<pre>`-blokken beholder venstrejustering og monospace, og skal vises
  både i `question`/`answer` og i sidekolonnen i `award`.
- `EmojiBurst` monteres i rot-komponenten for runden, ikke i et steg — den er
  fixed og må overleve stegbyttet som feirer den.
- `Confetti` som i dag.

### Overgang

Kryssfade på rundt 150 ms, ingen bevegelse. Noe som glir inn fra siden ser ut
som en presentasjon som mistet tråden.

### Filer

Ny `components/round/RoundScreen.tsx` med `QuestionStep`, `AnswerStep`,
`AwardStep`, `AwardedStep`. Slett `components/QuestionModal.tsx` og
`components/RoundDock.tsx`. Endres: `components/GameStage.tsx`,
`utils/store.ts`, `utils/types.ts`.

---

## Del 3 — Økt som pågår

### Problemet

`useQuizBootstrap.ts` kaller `restoreActiveSession(quizId)` rett etter at
brettet er vist. Kjører verten samme quiz for gruppe to, popper forrige gruppes
poeng og avkryssede ruter opp på projektoren uten forvarsel. Eneste vei til
blankt brett er å gå til `/results` og trykke «Fullfør».

### Løsningen

Splitt `restoreActiveSession` i to: en som henter økten uten å bruke den, og en
som bruker den. Bootstrap får en ny status:

```ts
| { status: "resumable"; quizId: string; run: {
    startedAt: string;
    answered: number;
    total: number;
    teams: { name: string; score: number }[];
  } }
```

Statusen settes bare når økten faktisk har kommet i gang — minst ett avkrysset
kort eller minst én poengsum ulik null. En tom økt gjenopptas stille som i dag.

`app/page.tsx` viser valgskjermen: hva økten er (startet, X av Y kort spilt,
lagene med poeng), «Fortsett økten» som primær, «Start en ny økt med samme quiz»
under, og en setning som sier hva den gjør: *«Økten over lagres i historikken.
Brettet nullstilles, og alle lag starter på 0.»* Pluss en lenke til resultatet
fra økten som pågår.

«Start en ny økt» fullfører den gamle kjøringen først, så den havner i
historikken i stedet for å bli liggende åpen.

### Filer

`hooks/useQuizBootstrap.ts`, `app/page.tsx`, `utils/store.ts`,
`app/api/quiz-runs/active/route.ts` (må kunne returnere sammendraget).

---

## Del 4 — Finalen

`app/results/page.tsx` håndterer i dag bare `loading` fra bootstrap. Ved nettfeil
eller utlogget økt faller den gjennom til «Uten navn / RESULTATER / Ingen lag i
denne økten» på storskjerm.

Å gjøre:

1. Håndter `error` og `empty` fra bootstrap med en ekte feilmelding og en vei
   videre, ikke et tomt podium.
2. Statusbrikke nede til venstre: «Ikke lagret ennå» (destructive-tonet) før
   lagring, «Lagret i historikken kl. 21:14» (success) etter.
3. Handlingsrad nederst. Før lagring: «Fullfør og lagre økten» som primær. Etter
   lagring: «Spill denne quizen igjen» som primær, «Se økten i historikken» og
   «Til biblioteket» ved siden.
4. «Ingen aktiv økt å lagre» er i dag ren tekst uten utvei. Erstatt med en
   forklaring på hvorfor og hva verten kan gjøre.
5. Podiets plassiffer: `text-background/70` på `bg-muted` og `bg-secondary`
   forsvinner bakerst i salen. Mørkt siffer på gull, mørkt på lyst sølv, lyst på
   mørk bronse.
6. Undertittel med varighet: «23 av 25 kort spilt · 1 t 12 min · 18. september».

Høydene i `heightForRank` er allerede `vh`-baserte. Behold dem.

---

## Del 5 — Redigeringsbrettet

### Problemet

`EditableBoard.tsx` bruker `repeat(auto-fit, minmax(11rem, 1fr))` og faste
`h-20`-kort. Med seks kategorier eller et smalt vindu brekker brettet om til
flere rader og ser ikke ut som det salen får se. Filens egen kommentar sier at
«å bytte til Spill *er* forhåndsvisningen», og det stemmer ikke.

Inspektøren er låst til 404 px med en hard `xl`-grense, mens spillmodus regner ut
plassbehovet fra antall kategorier.

### Å gjøre

1. Samme geometri som spillbrettet, fra `utils/board-geometry.ts`. Én kolonne per
   kategori, poengstigen nedover, ingen ombrekking. Med inspektøren på 460 px og
   fem kategorier på 1920 blir kortene 248×157.
2. Kortet viser poeng (26 px, accent), merker (JOKER, kode, bilde), statusprikk,
   spørsmålsforhåndsvisning på tre linjer, og **statusteksten som tekst** når noe
   mangler («Mangler svar»). I dag er status bare farge, og prikken er
   `aria-hidden`.
3. Inspektøren blir flytende: `clamp(360px, 24vw, 460px)`.
4. **Poeng blir et felt** i inspektøren (`<input type="number" step="50">`).
   I dag er stigen låst av posisjon i kolonnen, og 200/400/600 krever import.
5. `moveQuestion`/`moveCard` finnes i `utils/types.ts` men brukes ikke av noen
   komponent. Koble dem opp, eller fjern dem.
6. Sletting av kort må ha `AlertDialog` som sletting av kategori allerede har.
   I dag er den farligste enkelthandlingen den eneste som ikke spør.
7. Fjern `autoFocus` fra spørsmålsfeltet. Den setter markøren i et tekstfelt rett
   etter at du velger et kort, og da gjør «Neste kort (→)» ingenting, fordi
   handleren returnerer tidlig når man skriver.
8. «Ny kategori» blir en kolonne i full høyde til høyre for de andre, ikke en
   knapp som flyter etter siste kolonne. «Kort» blir en rad nederst i hver
   kolonne.
9. `BoardTransfer` står på «Erstatt brettet» som standard og skriver til server
   1,2 sekunder senere, uten bekreftelse og uten angre. Legg på bekreftelse som
   navngir hva som forsvinner.
10. «Klar»-brikken i `EditorBar` teller bare kort. Den kan si «Klar» for en quiz
    som heter «Uten navn» og ikke har et eneste lag. Ta med tittel og lag i
    `readiness`.

### Filer

`components/editor/EditableBoard.tsx`, `components/editor/QuestionInspector.tsx`,
`components/editor/EditorBar.tsx`, `components/editor/BoardTransfer.tsx`,
`app/page.tsx` (redigeringslayouten), `utils/board-geometry.ts`.

---

## Rekkefølge

1. **Del 1** først. Den er selvstendig, synlig med én gang, og legger igjen
   `utils/board-geometry.ts` som Del 5 bruker.
2. **Del 2** er størst og rører store-en mest. Ta den når Del 1 er i mål.
3. **Del 3** og **Del 4** henger sammen (begge handler om økten) og kan tas i
   samme omgang.
4. **Del 5** til slutt, når geometrien er stabil.

Del 1, 3, 4 og 5 er uavhengige av hverandre. Bare Del 5 venter på Del 1.

---

## Fallgruver som allerede er løst — ikke regresser dem

Disse står som kommentarer i koden fordi de har brukket før.

1. **`RoundDock` unngår `Escape` og `Enter` med vilje.** Begge er i lufta fra
   spørsmålsmodalen i det lytteren monteres. Å lukke modalen med Escape lot
   samme tastetrykk nå dokken og avslutte runden, som markerte kortet spilt og
   hoppet over poengene. Stegmaskinen i Del 2 må håndtere det samme.
2. **`QuestionModal` og `RoundDock` er keyet per spørsmål** slik at tilstanden
   nullstilles ved remount. Å synkronisere med effekter lot straffemodus følge
   med inn i neste runde og la poeng på feil side.
3. **`startSession()` er idempotent på begge sider.** Før den var det, fyrte to
   av dem og opprettet to økter.
4. **Stillingsraden bruker `mx-auto` på en indre rad**, ikke `justify-center` på
   scrolleren. Å sentrere en flex-rad som er bredere enn containeren skyver
   første element forbi venstre kant, der ingen scrolling når det.
5. **`GameBoard` bruker ett grid for alle kolonner.** Med per-kolonne flex-stabler
   ble en kategori med fire spørsmål strukket høyere enn naboens fem.
6. **`useMediaQuery` bruker `useSyncExternalStore`** fordi `matchMedia` *er* en
   ekstern store. Ikke gjør det om til en effekt med `setState`.
7. **`usePresentationMode` kobler chrome-skjuling og fullskjerm bevisst sammen.**
   Grunnen til å skjule knappene er at en projektor viser dem til hele rommet, og
   nettleserens faner er på den samme projektoren.
8. **Merkene ligger utenfor flis-knappen.** En knapp inne i en knapp er ugyldig
   HTML, og den indre var uåpnelig med tastatur.
9. **Podiets 2-1-3-rekkefølge gjelder bare med tre trinn.** Med to satte den
   vinneren til høyre og toeren til venstre.
10. **Forhåndsvisningen på redigeringskort flater ut linjeskift** i kodesnutter
    (`\n` → ` ⏎ `), fordi kortet klipper til få linjer og snuttens egne
    linjeskift ville brukt dem opp.

---

## Tester som bør komme til

- `utils/__tests__/board-geometry.test.ts` — tabelldrevet mot
  akseptansetabellen i Del 1.
- Stegmaskinen i Del 2: at `Escape` fra `question` avbryter uten å markere kortet
  spilt, at `N` fra `awarded` avslutter med poengene i behold, og at
  `undoLastAward()` tar laget tilbake til forrige sum.
- `useQuizBootstrap`: at en økt med fremdrift gir `resumable` og ikke brukes,
  og at en tom økt gjenopptas stille.
