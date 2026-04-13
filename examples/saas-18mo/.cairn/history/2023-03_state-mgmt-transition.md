type: transition
domain: state-management
decision_date: 2023-03
recorded_date: 2025-01
summary: Migrated client state from React Context to Zustand due to full subtree re-render performance issues
rejected: React Context with useMemo optimization — attempted first, proved fragile and hard
  to maintain as state surface grew. Redux Toolkit was also evaluated but rejected: boilerplate
  overhead (reducers, actions, selectors, middleware config) was disproportionate for a 2-person
  team with modest state complexity.
reason: React Context caused full subtree re-renders on any state change. Profiling showed
  40%+ unnecessary renders on the dashboard page. Zustand offered minimal API, no Provider
  wrapper, and selector-based subscriptions out of the box — zero boilerplate for the same
  capability.
revisit_when: State complexity outgrows Zustand's flat model (e.g., need for cross-slice
  transactions, complex middleware, or time-travel debugging in production)
