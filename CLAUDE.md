# Buffington Family Medicine — CLAUDE.md

## Project Overview

Static HTML/CSS/JS website for **Buffington Family Medicine (BFM)**, a medical practice in Texas. Deployed via **Cloudflare Workers with static assets**. No build step — raw HTML/CSS/JS is deployed directly.

Live domain: `buffingtonfamilymedicine.com` (and `www.` redirect)

## Architecture

### Tech Stack
- **Frontend**: Vanilla HTML5, CSS3 (custom properties), vanilla JavaScript — no frameworks
- **Backend**: Cloudflare Workers (`worker.js`) — handles routing, security headers, contact form, legacy redirects
- **Email**: Resend API (contact form submissions)
- **CAPTCHA**: Cloudflare Turnstile
- **Font**: Inter Variable (self-hosted WOFF2)
- **Patient Portal**: AthenaHealth (external link)
- **Maps**: Google Maps embed

### File Structure
```
/
├── index.html                  # Homepage
├── contact.html                # Contact form
├── providers.html              # Provider bios
├── family-practice.html        # Family practice landing
├── behavioral-health.html      # Behavioral health landing
├── patient-resources.html      # Patient hub (portal + education)
├── reviews.html                # Patient testimonials
├── services/                   # 8 individual service pages
│   ├── preventive-care.html
│   ├── urgent-care.html
│   ├── weight-loss.html
│   ├── testosterone-therapy.html
│   ├── anxiety.html
│   ├── depression.html
│   ├── adhd.html
│   └── insomnia.html
├── hubs/                       # Vanilla-HTML education hubs (shared hub.css)
│   ├── weight-loss/
│   ├── testosterone/
│   ├── adhd/
│   ├── mental-health/
│   └── insomnia/
├── css/
│   ├── reset.css               # Modern CSS reset
│   ├── variables.css           # Design tokens (colors, spacing, typography)
│   ├── global.css              # Base styles, layouts, animations
│   └── components.css          # Nav, buttons, cards, forms, footer
├── js/
│   ├── includes.js             # Injects header/footer partials, nav init
│   ├── animations.js           # Scroll animations, card glow, parallax
│   ├── contact-form.js         # Form handling, validation, Turnstile
│   └── nav.js                  # Navigation utilities
├── partials/
│   ├── header.html             # Shared navigation (injected by includes.js)
│   └── footer.html             # Shared footer (injected by includes.js)
├── images/
│   ├── logo.svg / logo-full.svg / logo-icon.svg / logo-text.svg
│   ├── providers/              # Provider headshots (JPG)
│   └── insurance/              # Insurance logos (SVG: Aetna, BCBS, Cigna, UHC)
├── fonts/
│   └── InterVariable.woff2
├── worker.js                   # Cloudflare Worker — server logic
├── wrangler.toml               # Cloudflare Workers deployment config
├── _headers                    # Cloudflare Pages-style headers (cache, security)
├── .assetsignore               # Excludes files from CF asset bundle
├── robots.txt
└── sitemap.xml
```

## Deployment

```bash
npx wrangler deploy
```

- Config: `wrangler.toml` — project name `bfm-com`, assets dir `.` (repo root)
- Compatibility date: `2025-01-01`
- Routes: `buffingtonfamilymedicine.com/*` and `www.buffingtonfamilymedicine.com/*`
- `.assetsignore` excludes: `.git`, `.wrangler`, `.claude`, `node_modules`, env files, `worker.js`, `wrangler.toml`, `CLAUDE.md`

## Worker Logic (`worker.js`)

The Cloudflare Worker intercepts all requests and:

1. **Blocks sensitive files**: Returns 403 for `.env`, `.git`, `wrangler.toml`, `worker.js`, `_headers`, etc.
2. **Applies security headers**: CSP, HSTS (1 year), X-Frame-Options, Referrer-Policy, Permissions-Policy
3. **Handles legacy WordPress redirects**: 30+ redirect rules for old URL patterns (SEO preservation)
4. **Contact form endpoint** (`POST /functions/contact`):
   - Honeypot bot detection
   - Cloudflare Turnstile CAPTCHA verification
   - Rate limiting: 5 submissions per hour per IP
   - Input validation and sanitization
   - Sends email via Resend API
   - Returns JSON response
5. **Falls through to static assets** for everything else

### Worker Environment Variables (Cloudflare dashboard secrets)
- `RESEND_API_KEY` — Resend API key for email delivery
- `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile secret

## CSS Architecture

All styles use CSS custom properties defined in `css/variables.css`.

### Design System
- **Color palette**: Dark mode — primary bg `#0a0a0b`, text `#fafafa`
- **Accent colors**: Blue `#3b82f6`, Purple `#8b5cf6`, Cyan `#06b6d4`
- **Gradients**: Blue-to-purple (`--gradient-accent`), used on CTAs, logo, borders
- **Typography**: Inter Variable, 6 heading sizes, 3 text color variants (`--text-primary/secondary/muted`)
- **Spacing scale**: `--space-xs` through `--space-5xl`
- **Container**: max-width 1200px

### CSS Load Order (each HTML file)
```html
<link rel="stylesheet" href="/css/reset.css">
<link rel="stylesheet" href="/css/variables.css">
<link rel="stylesheet" href="/css/global.css">
<link rel="stylesheet" href="/css/components.css">
```

## JavaScript

### Partial Injection (`includes.js`)
Header and footer are shared partials injected into every page via `fetch()` in `includes.js`. Pages must have `<div id="header-placeholder">` and `<div id="footer-placeholder">`.

### Animations (`animations.js`)
- IntersectionObserver-based scroll fade-in (class `fade-in` on elements)
- Grid cards stagger with 120ms delay
- Mouse-tracking card glow effect
- Hero parallax on scroll

### Contact Form (`contact-form.js`)
- Validates required fields, length limits
- Checks honeypot (hidden `website` field must be empty)
- Integrates Cloudflare Turnstile
- POST to `/functions/contact`
- Handles 429 rate limit response

## Page Patterns

Every HTML page follows this structure:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Meta, title, CSS links -->
</head>
<body>
  <div id="header-placeholder"></div>
  <!-- Page content -->
  <div id="footer-placeholder"></div>
  <script src="/js/includes.js"></script>
  <script src="/js/animations.js"></script>
  <!-- page-specific scripts -->
</body>
</html>
```

Service pages follow a consistent content pattern: hero → testimonial → 3 value props → FAQs → additional testimonials → CTA.

## Providers

- **Dr. Ryan Buffington, MD** — Founder, board-certified family medicine & obesity medicine
- **Ty Talley, PA-C** — Navy veteran, hospital corpsman background
- **Michelle Guilbeault, PA-C** — 10+ years experience

## Services

**Family Practice**: Preventive care, urgent care, weight loss, testosterone therapy

**Behavioral Health**: Anxiety, depression, ADHD, insomnia

## Education Hubs (`/hubs/`)

Vanilla HTML pages — edit directly. Five hubs: `weight-loss`, `testosterone`, `adhd`, `mental-health`, `insomnia`. Each hub has:
- `index.html` — the page
- `index.txt` — optional plain-text companion (present in some hubs)

Shared styling via `hubs/hub.css` (loaded after the global CSS chain). Hub footers are baked into each `index.html` rather than injected from `partials/footer.html`, so sitewide footer changes (hours, links, etc.) must be applied to each hub `index.html` as well.

## Security Notes

- Never commit `.env` or secrets — use Cloudflare dashboard for secrets
- CSP allows `unsafe-inline` for scripts/styles (required for inline styles in components)
- Turnstile site key is public (in HTML); secret key is a Cloudflare secret
- Rate limiting state is in-memory (resets on Worker restart) — not Redis-backed

## SEO

- `sitemap.xml` lists 13 URLs with priorities and change frequencies
- `robots.txt` allows all crawlers
- Each page has unique `<title>` and `<meta name="description">`
- Canonical URLs use HTTPS root domain

## Caching (`_headers`)

- Fonts + images: 1 year (`Cache-Control: public, max-age=31536000, immutable`)
- CSS + JS: 1 week (`Cache-Control: public, max-age=604800`)
- HTML: no explicit cache (defaults to short/no-cache)

## Uptime Monitoring

Three GitHub Actions workflows ping healthchecks.io on a schedule. Secrets stored in GitHub repo.

| Check | File | Schedule | Secret |
|-------|------|----------|--------|
| Homepage (HTTP 200) | `.github/workflows/healthcheck.yml` | Hourly | `HEALTHCHECKS_PING_URL` |
| Contact form (HTTP 400 + "Missing required fields") | `.github/workflows/healthcheck.yml` | Hourly | `HEALTHCHECKS_CONTACT_PING_URL` |
| SSL cert expiry (>14 days) | `.github/workflows/ssl-check.yml` | Daily 6am UTC | `HEALTHCHECKS_SSL_PING_URL` |

**Contact probe invariant:** The probe POSTs `{}` to `/functions/contact` with a valid `Origin` and `Content-Type: application/json`. It exits at "Missing required fields" — before Turnstile or Resend are called. If you add validation logic *before* the required-fields check in `worker.js`, you may break the probe.

**SSL threshold:** 14 days. Cloudflare Universal SSL auto-renews ~30 days before expiry, so alerting at 14 days gives investigation time if renewal stalls.
