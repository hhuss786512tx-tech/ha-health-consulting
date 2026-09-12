# H&A Healthcare Consulting — Hosting & Maintenance Handover

Status: **draft template** — fill in once the A2 Hosting migration is complete. Do not send
this doc anywhere with real passwords filled in; hand those over on the onboarding call or via
a secure channel (password manager share), not as a shared file/link.

## What kind of site this is

Static HTML + Tailwind CSS. **No CMS, no admin dashboard.** Editing text, images, or layout
means editing the HTML/CSS files directly — either your own team if comfortable with code, or
a developer. This handover doc won't pretend otherwise.

## Access checklist

| Service | Purpose | Login URL | Username | Password |
|---|---|---|---|---|
| A2 Hosting | Site files, server | _fill in post-migration_ | | *(hand over live, not here)* |
| Cloudflare | Domain/DNS | https://dash.cloudflare.com/login | ssquresh2@gmail.com | *(hand over live, not here)* |
| cPanel (new, on A2) | File manager, email | _fill in post-migration_ | | *(hand over live, not here)* |
| Google Business Profile | Local SEO listing | https://business.google.com/us/ | hahealthconsulting@gmail.com | *(unchanged — already yours)* |
| Chatbot admin (Speed-to-Lead) | Lead notifications, reply templates | _fill in once configured_ | | *(hand over live, not here)* |

## Common self-serve edits (once live)

- **Phone number / address**: appears in the footer and contact sections across all 5 pages —
  search-and-replace across `index.html`, `about.html`, `services.html`, `contact.html`,
  `blog.html`.
- **Team bios/photos**: `about.html`, in the team section.
- **Service copy**: `services.html`.
- Anything beyond text/asset swaps (new sections, layout changes, new pages) needs a developer.

## Ongoing responsibilities after handover

- **DNS/domain**: client owns Cloudflare login, can manage records independently.
- **Hosting renewal**: A2 Hosting billing is on the client's own account.
- **Chatbot maintenance ($200/mo)**: covers Speed-to-Lead upkeep — reply tuning, lead routing,
  monitoring. Everything else is a one-time, no-retainer handoff.
- **Credential rotation**: recommend rotating all passwords above once migration is done, since
  the originals were shared in plaintext over email before reaching us.

## Onboarding call

15–20 min, scheduled once the site is live: confirm login access works for the client
end-to-end, walk through the common-edits list above, answer questions live.
