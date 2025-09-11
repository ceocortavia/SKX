---
title: Skillexia – Designmanual
description: En kort, praktisk designmanual for markedsflaten. Basert på gjeldende implementasjon.
---

# Skillexia Design

Denne manualen beskriver komponenter og regler **slik de er i prod** – ingen visuelle endringer, kun dokumentasjon og tokens.

---

## 1. Grunnprinsipper

- **Lyst, lett og fokusert:** hvit bakgrunn, myke skygger, subtile glass-effekter.
- **Tydelig hierarki:** stor, kompakt hero–tittel; kort og presis supporting-copy.
- **Aksentgradiener:** primær CTA har fiolett → blå gradienteffekt.
- **Tilgjengelighet først:** fargekontrast ≥ WCAG AA, fokus-ringer, semantikk.

---

## 2. Typografi

- **Skrifter:** System stack eller Inter (matching dagens layout).
- **Skalering:**
  - **Display/Hero:** `text-5xl md:text-6xl font-extrabold leading-tight`
  - **Seksjonstittel:** `text-3xl md:text-4xl font-bold`
  - **Brødtekst:** `text-base leading-7 text-foreground/80`
  - **Overline/eyebrow:** `text-xs uppercase tracking-wide text-foreground/60`

**Kodeeksempel:**
```tsx
<h1 className="text-5xl md:text-6xl font-extrabold leading-tight">
  Automate.<br/>Engage.<br/><span className="text-gradient">Convert.</span>
</h1>
<p className="mt-6 text-base leading-7 text-foreground/80 max-w-prose">
  Revolusjonér din HR-prosess …
</p>
```

⸻

## 3. Farger (tokens)

Definert i styles/tokens.css – bruk CSS-variabler i Tailwind via text-[color:var(--...)]/bg-[color:var(--...)] eller utvid Tailwind-temaet.

- Bakgrunn: --bg: #ffffff
- Tekst: --fg: #0a0a0a
- Primær: --primary: #6E56CF (fiolett)
- Primær-emfase (gradient): --primary-2: #3E63DD
- Suksess/Info/Varsel/Feil: --success, --info, --warning, --destructive
- Overflater: --surface: #ffffff, --surface-muted: #f6f7fb
- Border: --border: #e9e9ef

Gradient-klasse (global):

```css
/* i globals.css eller tokens.css */
.text-gradient {
  background: linear-gradient(90deg, var(--primary), var(--primary-2));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
```

⸻

## 4. Radius & skygger
- Radius: --radius-sm: 8px, --radius: 12px, --radius-lg: 20px, CTA-pill: 9999px.
- Skygger:
  - Kort: --shadow-card: 0 10px 30px rgba(0,0,0,0.06)
  - Flyt/hover: --shadow-float: 0 18px 50px rgba(0,0,0,0.08)

Eksempel kort:

```html
<div className="rounded-[var(--radius-lg)] bg-white shadow-[var(--shadow-card)] p-6">
  …
</div>
```

⸻

## 5. Spacing & grid
- Container: mx-auto max-w-7xl px-4 sm:px-6 lg:px-8
- Seksjons-padding: py-20 md:py-28
- Grid for cards: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8

⸻

## 6. Komponenter

### 6.1 Hero
- Overline “Powered by AI”
- Hovedtittel i tre linjer, siste ord med gradient
- Supporting-copy (maks max-w-prose)
- Primær CTA: fiolett→blå gradient, pill, svakt glass-refleks
- Sekundær CTA: lysegrå pill
- Trust-stats: 3 kolonner med små etiketter

```html
<section className="relative py-24 md:py-32 text-center">
  <div className="mx-auto max-w-3xl">
    <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-white/70 backdrop-blur border border-black/5">
      <span className="h-2 w-2 rounded-full bg-[color:var(--success)]" />
      Powered by AI
    </div>

    <h1 className="mt-6 text-5xl md:text-6xl font-extrabold leading-tight">
      Automate.<br/>Engage.<br/><span className="text-gradient">Convert.</span>
    </h1>

    <p className="mt-6 text-base leading-7 text-foreground/80 max-w-prose mx-auto">
      Revolusjonér din HR-prosess …
    </p>

    <div className="mt-8 flex items-center justify-center gap-3">
      <a className="px-5 py-3 rounded-full text-white font-medium shadow-[var(--shadow-float)]
         bg-[linear-gradient(90deg,var(--primary),var(--primary-2))]">Get Started →</a>
      <a className="px-5 py-3 rounded-full bg-white border border-black/5 text-foreground/80">Se demo</a>
    </div>

    <dl className="mt-10 grid grid-cols-3 gap-6 text-sm text-foreground/70">
      <div><dt className="font-semibold text-foreground">99.9%</dt><dd>Uptime</dd></div>
      <div><dt className="font-semibold text-foreground">250+</dt><dd>Kunder</dd></div>
      <div><dt className="font-semibold text-foreground">24/7</dt><dd>Support</dd></div>
    </dl>
  </div>
</section>
```

### 6.2 Tjenesteliste (akkordeon-kort)
- Store kort med ikon (rounded), tittel + kort ingress.
- “Åpnet” kort har subtil bakgrunns-tint (lys blå/lilla/grønn/oransje) + skygge-løft.
- Inne i åpent kort: to kolonner “Detaljert beskrivelse” og “Nøkkelfunksjoner”.

Tips-klasser:
- Lukket: `bg-white shadow-[var(--shadow-card)]`
- Åpent: `bg-[color:var(--surface-muted)]/60 ring-1 ring-primary/10 shadow-[var(--shadow-float)]`

### 6.3 Kontakt
- Card med `rounded-[var(--radius-lg)]`, `shadow-[var(--shadow-card)]`
- Inputs med `border border-black/5 focus:ring-2 focus:ring-primary/30 focus:border-primary`

⸻

## 7. Bevegelse
- Micro-interaksjoner (200–250ms, ease-out)
- CTA hover: liten y-translate og skygge-økning
- Akkordeon: max-height/opacity/translate + `will-change: transform`

```css
/* tokens.css */
:root { --ease: cubic-bezier(.2,.8,.2,1); --dur: 220ms; }
```

```html
<button className="transition-[transform,box-shadow] duration-[var(--dur)] ease-[var(--ease)]
  hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]">
  Get Started
</button>
```

⸻

## 8. Tilgjengelighet
- Fokus-ringer: `outline-offset-2 ring-2 ring-primary/40`
- Ikonknapper: `aria-label`
- Tekstkontrast: sørg for AA på tekst mot bakgrunn
- Semantikk: nav, main, section, h1–h3, dl/dt/dd

⸻

## 9. Kodestandard
- All styling i Tailwind + tokens (ikke hardkode hex i JSX)
- Komponenter under `lib/src_full/components/sections/*` brukes direkte i `app/page.tsx`
- Delte UI-primitiver under `lib/src_full/ui/*`

⸻

## 10. Fargeprøver

```html
<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
  <div class="h-16 rounded-[var(--radius)] bg-[color:var(--primary)]"></div>
  <div class="h-16 rounded-[var(--radius)] bg-[color:var(--primary-2)]"></div>
  <div class="h-16 rounded-[var(--radius)] bg-[color:var(--success)]"></div>
  <div class="h-16 rounded-[var(--radius)] bg-[color:var(--surface-muted)]"></div>
</div>
```

---

## Neste småting jeg kan ta med en gang
- Legge “Design” i Topbar ✔️
- Oppdatere hero/service-seksjoner til å bruke tokens der det er hardkodet (ingen visuelle endringer, kun opprydding).
- Legge inn en enkel “Theme Preview” på `/docs` med fargeprøver og knappevarianter — nyttig for QA.
