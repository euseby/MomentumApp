<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Oasis frontend architecture
- Keep TanStack Start and TanStack Router; Next.js App Router and NextAuth files from the team brief cannot run in this project.
- Share the frontend-only Oasis dashboard between `/` and `/dashboard` so teammate login redirects have a working destination.
- Keep the AI HTTP contract and simulation reducer in `src/lib/oasis.ts`; this isolates teammate API integration from the visual dashboard.
- Use a browser POST to `/api/oasis` (overridable via `VITE_OASIS_API_URL`) with cookies and validated demonstrative fallback; backend and auth are owned by other teammates.
- Keep balances and city progress in transient React state, not persistent storage, because this brief explicitly requests a financial simulation only.
