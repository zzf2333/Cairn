# state-management

## current design

Zustand for all client state. No server-state library (no React Query, no SWR).
API calls wrapped in custom hooks that write to Zustand stores. Global store
split into 3 slices: auth, ui, data. Selector-based subscriptions throughout.

## trajectory

2022-12 React useState + Context, single-file global state
2023-03 Migrated to Zustand — Context caused full subtree re-renders on any change
2023-08 Evaluated Redux Toolkit → rejected, boilerplate disproportionate for team-2
2024-02 Evaluated React Query for server state → deferred, not rejected
2024-03 Introduced slice pattern (auth / ui / data), current state

## rejected paths

- Redux / Redux Toolkit: evaluated 2023-08; boilerplate and middleware overhead
  disproportionate for a 2-person team at current state complexity
  Re-evaluate when: team > 5 and state complexity requires middleware or devtools
- React Query / SWR for server state: considered 2024-02, deferred — current
  custom hooks work, cache invalidation is not yet a recurring pain point
  Re-evaluate when: cache invalidation becomes a repeated source of bugs
- Jotai / Recoil: atomic model does not fit current slice architecture; full
  rewrite required, no incremental adoption path found
  Re-evaluate when: starting a new major module from scratch with no existing state

## known pitfalls

- Store slice boundaries: auth slice is read by data slice for token access.
  Keep this flow strictly unidirectional (auth → data). Do not create reverse
  dependencies where data slice actions trigger auth slice updates.
- SSR hydration: Zustand stores have edge cases with stale closures during
  server-side rendering. Always use useStore(selector) pattern. Never access
  store state outside the React component lifecycle.

## open questions

- Whether to adopt React Query for server state (deferred 2024-02, not rejected)
- Persistence strategy if offline support is added
