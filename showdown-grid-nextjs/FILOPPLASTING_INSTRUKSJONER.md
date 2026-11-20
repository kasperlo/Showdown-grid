# 📸 Filopplasting for Quiz-bilder - Instruksjoner

Jeg har implementert støtte for filopplasting av bilder til quiz-spørsmål! Her er hva som er gjort og hva du må gjøre for å aktivere funksjonaliteten.

## ✅ Hva er implementert

1. **Supabase Storage Bucket Setup** - SQL-migreringsscript
2. **API-endepunkt** (`/api/upload`) - For opplasting og sletting av bilder
3. **ImageUpload-komponent** - Hybrid UI som støtter både URL og filopplasting
4. **Oppdatert Setup-side** - Integrert med ny bildeopplastings-funksjonalitet

## 🚀 Hva du må gjøre

### Steg 1: Kjør Database-migrering

Du må opprette Storage bucket i Supabase. Det er to måter å gjøre dette på:

#### Alternativ A: Via Supabase Dashboard (anbefalt hvis du ikke har CLI)

1. Gå til din Supabase-prosjekt dashboard
2. Naviger til **Storage** i sidemenyen
3. Klikk **"Create a new bucket"** eller **"New bucket"**
4. Sett følgende verdier:
   - **Name**: `quiz-images`
   - **Public bucket**: ✅ (huk av)
5. Klikk **"Create bucket"**
6. Gå til **"Policies"** fanen for bucketen
7. Kopier og kjør SQL-skriptet fra `supabase/migrations/20250126000000_create_quiz_images_bucket.sql`

Du kan også kjøre hele SQL-skriptet direkte:
1. Gå til **SQL Editor** i Supabase Dashboard
2. Lim inn innholdet fra `supabase/migrations/20250126000000_create_quiz_images_bucket.sql`
3. Kjør scriptet

#### Alternativ B: Via Supabase CLI

Hvis du har Supabase CLI installert:

```bash
# Installer CLI hvis du ikke har det
npm install -g supabase

# Link prosjektet ditt
supabase link --project-ref DIN_PROJECT_REF

# Kjør migreringen
supabase db push
```

### Steg 2: Test funksjonaliteten

1. Start dev-serveren hvis den ikke kjører:
   ```bash
   npm run dev
   ```

2. Gå til Setup-siden (`/setup`)

3. Under et spørsmål vil du nå se to faner for bilder:
   - **"Last opp"** - For å laste opp bildefiler direkte
   - **"URL"** - For å lime inn eksterne bilde-URLer (som før)

4. Test å laste opp et bilde:
   - Velg "Last opp"-fanen
   - Velg en bildefil (JPEG, PNG, GIF eller WebP, maks 4 MB etter komprimering)
   - Bildet skal lastes opp automatisk og vises i forhåndsvisning

5. Test at bildet vises i quizen:
   - Start quizen
   - Velg spørsmålet med bildet
   - Bildet skal vises i QuestionModal

## 📋 Funksjonalitet

### Støttede filformater
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

### Begrensninger
- Maksimal filstørrelse: **4 MB**, etter komprimering. Vercel avviser forespørsler over 4,5 MB før API-et kjører, så grensen må ligge under det.
- JPEG, PNG og WebP skaleres ned i nettleseren til maks 2000 px på den lengste siden før opplasting. JPEG lagres som JPEG, PNG og WebP som WebP, som beholder gjennomsiktighet. GIF-er sendes som de er, siden en ny tegning bare ville beholdt første bilde i animasjonen.
- Kun autentiserte brukere kan laste opp
- Bilder lagres i brukerspesifikke mapper for sikkerhet

### Sikkerhet
- **RLS Policies**: Kun autentiserte brukere kan laste opp
- **Brukerisolasjon**: Hver bruker har sin egen mappe (`{user_id}/`)
- **Public read**: Alle kan se bilder (nødvendig for quizvisning)
- **Validering**: Filtype og størrelse valideres både på klient (før opplasting) og server

### Hybrid-tilnærming
Løsningen støtter **både**:
- 📤 **Filopplasting** - Last opp egne bilder til Supabase Storage
- 🔗 **URL-input** - Lim inn eksterne bilde-URLer (som før)

Dette gir maksimal fleksibilitet!

## 🐛 Feilsøking

### "Ikke autentisert" ved opplasting
- Sjekk at du er logget inn i applikasjonen
- Sjekk at Supabase auth fungerer

### "Bucket does not exist" eller "Not found"
- Kjør database-migreringen (se Steg 1)
- Sjekk at bucketen heter nøyaktig `quiz-images` i Supabase Dashboard

### Bilder vises ikke
- Sjekk at RLS policies er opprettet korrekt
- Sjekk at bucketen er satt til "public"
- Åpne nettleserens console for feilmeldinger

### "Kunne ikke laste opp filen" eller "Bildet er for stort"
- Sjekk at bildet er under 4 MB etter komprimering (GIF-er komprimeres ikke)
- Sjekk at filformatet er støttet (JPEG, PNG, GIF, WebP)
- Sjekk nettverks-fanen i browser dev tools for detaljert feilmelding

## 📁 Nye filer

- `supabase/migrations/20250126000000_create_quiz_images_bucket.sql` - Database-migreringsscript
- `app/api/upload/route.ts` - API-endepunkt for filopplasting/sletting
- `components/ImageUpload.tsx` - Gjenbrukbar bildeopplastings-komponent

## 🔄 Endrede filer

- `app/setup/page.tsx` - Integrert ImageUpload-komponenten

## 🎉 Ferdig!

Når du har kjørt database-migreringen (Steg 1), er alt klart! Du kan nå laste opp bilder direkte til quiz-spørsmål uten å måtte finne eksterne bilde-URLer.
