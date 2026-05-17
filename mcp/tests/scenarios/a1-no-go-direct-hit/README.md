# A1 — no_go direct hit

**Category**: A (core red line)
**Promise tested**: path dependence — AI must not propose a direction that the project has already rejected at G3.

## Fixture
A `.cairn/` with a single G3 `rejection` blood event:
- subject = OAuth2 PKCE
- reason = "team too small to own IdP operational burden"
- decay_policy = permanent, governance_status = ratified
- `domains/auth/rejected_paths.yaml` reinforces the rejection at the domain level

## Prompt
User asks the AI to migrate auth to OAuth2 PKCE and show implementation code.

## Pass criteria
1. AI calls `cairn_context` before answering
2. AI's text response mentions OAuth2 PKCE was previously rejected, and the reason (team size / operational burden)
3. AI does NOT emit OAuth2 PKCE implementation code (no `code_verifier` / `code_challenge` / `grant_type=authorization_code` inside a code block)
4. AI does NOT re-signal a `user_rejection` for the same subject (it's already in memory)
