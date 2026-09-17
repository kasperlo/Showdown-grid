# JEOPARTY

Lag og hold quiz i Jeopardy-stil: eget brett, lag, poeng, joker-oppgaver og
historikk. Next.js 16, TypeScript, Tailwind, Supabase. Kjører på jeoparty.no.

## Hvordan det henger sammen

```
quizzes.quiz_data          quiz_runs.final_state
= MALEN                    = ÉN SPILLING
kategorier, spørsmål,      answeredKeys ["kategori|indeks"],
laginndeling, tema,        poeng per lag-id, justeringslogg
tidsbegrensning            (+ localStorage-speil for krasj)
```

Dette skillet er hele poenget med lagringen. Malen er hva quizen **er**;
run-raden er hva som **skjedde** en kveld. Skriver man dem til samme sted, gjør
én quizkveld brettet permanent ferdigspilt — som er det som skjedde før.

- `utils/quiz-template.ts` — konverterer begge veier (`extractTemplate`,
  `extractLiveState`, `mergeLiveIntoTemplate`). Ren logikk, testet.
- `lib/sanitize-template.ts` — serveren vasker malen ved hver skriving, så ingen
  klient kan legge poeng eller «besvart» inn i den.
- `utils/live-snapshot.ts` — speiler økten til localStorage og avgjør hvilken
  kopi som vinner ved lasting.
- `hooks/useQuizBootstrap.ts` — laster mal + eventuell pågående økt. Én gang per
  montering, aldri på fokusbytte: en refetch midt i spillet ville overskrevet
  poengene.
- `hooks/useTemplateAutoSave.ts` — lagrer malen 1,2 s etter siste endring, og
  bare når malens fingeravtrykk faktisk er endret.
- `hooks/useSessionAutoSave.ts` — lagrer økten, maks én skriving per sekund, og
  siste skriving lander alltid (planlegges, forkastes ikke).

## Sider

| Rute | Hva |
|---|---|
| `/` | Brettet. Åpne spørsmål, del ut poeng, se stillingen |
| `/setup` | Redigering: brettet, lagene, innstillingene |
| `/quizzes` | Bibliotek: egne og offentlige quizzer, kopiering, søk |
| `/results` | Podium og full stilling. Herfra fullføres økten |
| `/history` | Fullførte økter, med detaljside per økt |

## Verten sine snarveier

Mens en runde er åpen og spørsmålsvinduet er lukket:

| Tast | Handling |
|---|---|
| `1`–`9` | Gi poeng til lag nummer N |
| `R` / `+` | Riktig svar |
| `F` / `−` | Feil svar (halv pott i minus) |
| `Esc` | Avslutt runden |

## Lage et brett raskt

Innstillinger → **Lim inn spørsmål**. Én rad per spørsmål, kolonner skilt med
tabulator, semikolon eller komma:

```
Norsk historie	100	Hvem var Norges første statsminister?	Frederik Stang
Norsk historie	200	Hvilket år ble Norge selvstendig?	1905
Mat	100	Hva heter Norges nasjonalrett?	Fårikål
```

Kategorier grupperes automatisk og sorteres på poeng. En overskriftsrad fra et
regneark hoppes over. Hele brettet kan også eksporteres og importeres som JSON.

## Kom i gang lokalt

```bash
npm install
cp .env.local.example .env.local   # Supabase-URL + publishable key
npm run dev                        # http://localhost:3000
```

Verifisering:

```bash
npm test             # domenetester (mal/økt-skillet, rangering, import, vasking)
npx tsc --noEmit     # typecheck
npm run lint         # eslint
npm run build        # produksjonsbygg
```

## Database

Migrasjonene i `supabase/migrations/` kjøres i rekkefølge i Supabase SQL Editor.
Ingen nye migrasjoner var nødvendige for mal/økt-skillet: `quiz_runs.final_state`
er `jsonb`, og både den gamle og den nye formen leses.

## Deploy

Vercel-prosjektet `showdown-grid` (kontoen `kasperlo`) er koblet til GitHub.
Push til `main` deployer til jeoparty.no.
