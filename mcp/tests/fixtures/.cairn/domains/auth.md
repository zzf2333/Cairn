---
domain: auth
hooks: ["auth", "login", "JWT", "session", "token", "OAuth"]
updated: 2024-06
status: active
---

# auth

## current design

JWT + Refresh token rotation. Auth checks are inline in route handlers, not
extracted to middleware (AUTH-COUPLING accepted debt). Password reset flow
exists but lacks email verification. Google OAuth added 2024-06.

## trajectory

2022-12 Basic JWT, no refresh, single-device assumption
2023-06 Added refresh token rotation, multi-device support
2024-01 Identified auth coupling issue, accepted as debt (AUTH-COUPLING)
2024-06 Added Google OAuth2 login, current state

## rejected paths

- Session-based auth: stateful sessions incompatible with Railway's
  horizontal scaling without sticky sessions or a Redis session store
  Re-evaluate when: infrastructure supports a Redis-backed session store
- Auth0 / third-party auth service: cost unjustified at current scale;
  integration complexity too high for a 2-person team
  Re-evaluate when: team > 4 or compliance requirements emerge
- Middleware extraction: scoped at 2 weeks for a 2-person team; 38+ protected
  routes need refactoring and regression testing; risk of subtle auth bypass
  Re-evaluate when: team > 4 with dedicated capacity for the migration

## known pitfalls

- AUTH-COUPLING (accepted debt): auth checks are inline in every route handler,
  not in middleware. Modifying auth flow requires touching every protected route.
  Do NOT attempt to extract middleware as a "quick improvement" — it is accepted
  debt with a defined revisit condition (team > 4 or MAU > 100k)
- Refresh token race condition: concurrent requests from multiple tabs can trigger
  a race on token rotation. A 10-second grace period on old tokens is intentional.
  Do NOT remove the grace period.
- OAuth state parameter: Google OAuth flow does not validate the state parameter
  against CSRF. Do not expose the OAuth callback to user-controlled redirects.

## open questions

- OAuth scope strategy for future providers (GitHub, Microsoft)
- Whether to adopt RBAC or keep simple role flags (user / admin)
