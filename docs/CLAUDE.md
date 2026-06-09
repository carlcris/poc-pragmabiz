# Historical Claude Guidance

This file is retained for historical context only.

Current agent instructions live in:

- `AGENTS.md` for repository-wide routing, hard constraints, verification, and final-response requirements.
- Nested `AGENTS.md` files for directory-specific rules.
- Codex skills for conditional step-by-step workflows.

Do not treat older guidance in this file as an active source of truth. If a rule is still current, it should be represented in `AGENTS.md`, a nested `AGENTS.md`, or a skill.

## Current Reference Map

- API, Supabase query, and DB-backed contract work: use `supabase-api-safety`.
- TypeScript hook/API/function contract verification: use `typescript-contract-verification`.
- SQL migration chain work: use `supabase-migration-chain`.
- Generated document/control codes: use `database-code-generation`.
- Create/update payload and insert-only field safety: use `mutation-contract-safety`.
- Scalable list, search, report, select, and autocomplete work: use `scalable-list-api`.
- Dashboard page shell and table consistency: use `dashboard-page-shell`.
- Translation and user-facing text changes: use `i18n-translation-workflow`.
- Granular permission and redaction work: use `granular-permissions-rollout`.

## Notes

The previous contents of this file included stale migration naming guidance and duplicated root rules. The active repo uses timestamped migrations under `supabase/migrations/`; follow the migration skill and `supabase/migrations/AGENTS.md` instead.
