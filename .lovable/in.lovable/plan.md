# Repo-specific Lovable Plan

## Purpose
This file provides a concise, repo-local plan for Lovable tooling and maintainers, reflecting the current project structure and build commands.

## Project overview
- Framework: Vite + React + TypeScript
- Key libraries: `@tanstack/react-query`, `@tanstack/react-router`, `reactflow`, `@supabase/supabase-js`, Lovable auth helper `@lovable.dev/cloud-auth-js`.
- Data/migrations: `supabase/migrations`
- Important source locations: `src/routes`, `src/components/family`, `src/lib`.

## Build & run
- Package manager: `bun` (project contains `bunfig.toml` and `bun.lock`).
- Dev: `bun run dev` (maps to `vite dev`).
- Build: `bun run build` (maps to `vite build`).
- Preview: `bun run preview` (maps to `vite preview`).

## Implementation summary (what this repo does)
- Replaces demo localStorage auth with Lovable Cloud (Auth + DB).
- Moves persons/relationships into DB (`supabase` migrations present).
- Implements join-request flow: `join_requests` table + admin approval.

## Actionable tasks (for contributors / Lovable automation)
1. Run DB migrations in local Lovable environment: apply SQL files in `supabase/migrations`.
2. Ensure `profiles`, `persons`, `relationships`, `join_requests`, `user_roles` tables exist and RLS policies are applied.
3. Verify auth: use `/auth` route in `src/routes/auth.tsx` and `src/integrations/lovable/index.ts`.
4. Frontend: ensure `src/components/family/JoinRequestDialog.tsx` writes to `join_requests` and admin UI in `src/routes/admin.tsx` lists pending requests.
5. CI/automation: use `bun` to run `dev`/`build` or fallback to `npm run` if bun is unavailable.

## Quick verification commands
```bash
# Start dev server
bun run dev

# Build
bun run build

# Preview
bun run preview
```

## Notes
- If contributors prefer `npm`, the equivalent commands are `npm run dev`, `npm run build`, `npm run preview`.
- Keep `EDITING_GUIDE.md` and `src/lib/family-data.ts` in sync with migration seed data.

---
Generated/updated to reflect repository layout and `package.json` scripts.
