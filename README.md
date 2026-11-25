# Speedcubing Rewind

Your year in speedcubing, as a story you can share. Sign in with your WCA account to replay your competitions and the PRs you broke, drop your csTimer export to see how you practiced, and get insights that cross both (home average vs competition average, prep before a PR...).

Status: in development, release planned for December 7, 2026.

## Privacy

- Your csTimer export is parsed in your browser and never uploaded.
- The WCA sign-in only asks for the `public` scope. The access token lives in `sessionStorage` and is gone when you close the tab.
- The only server code is `api/wca/token.ts`, which exchanges the OAuth code for a token (the WCA token endpoint has no CORS). It stores nothing.

## Stack

Vite, React, TypeScript, Tailwind CSS, i18next (EN/FR), Vitest. Hosted on Vercel.

```
src/lib/timer/   csTimer parser, common solve format, session classification
src/lib/stats/   practice stats, averages (WCA trimming), home vs competition
src/lib/wca/     WCA API client, OAuth PKCE, season (PRs, travel, highlight)
api/wca/         serverless token exchange
tests/           Vitest, with a small synthetic csTimer fixture
```

## Development

```bash
npm install
cp .env.example .env.local   # fill in your WCA OAuth app credentials
npm run dev
npm test
```

To check the stats against your own export without committing it:

```bash
CSTIMER_EXPORT=~/Downloads/cstimer_xxx.txt npx vitest run real-export --silent=false
```

## How some numbers are computed

- **Practice time**: sum of the gaps under 5 minutes between consecutive solves (covers scrambling and inspection). The first solve of a sitting counts for its own duration.
- **Time per event**: sum of solve times, so 38 solves of 6x6 can outweigh 497 solves of 3x3. Drills are counted apart from WCA events.
- **Outliers**: solves faster than about 80% of the world record (mistimed stops) or 10 times slower than the session median (timer left running) are ignored.
- **PRs**: the full WCA history is replayed in order (competition date, then round), and every improvement made in the year counts.
