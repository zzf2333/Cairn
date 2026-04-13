type: transition
domain: architecture
decision_date: 2024-09
recorded_date: 2025-01
summary: Project transitioned from MVP stage to early-growth stage; reasoning mode shifted to stability > speed > elegance
rejected: A stabilization freeze (2-month feature freeze to pay down technical debt) was considered
  and rejected — revenue growth required continued feature delivery during this period. A pure
  "ship fast" mode (continuing MVP-era speed > stability > elegance) was also rejected — first
  paying customers and 15% MoM growth meant broken builds and regressions now had real business
  consequences.
reason: Product-market fit signals reached: ~500 MAU, 15% month-over-month growth, first paying
  customers. The priority shifted from "ship fast and learn" to "don't break what works while
  continuing to grow." Key operational change: any migration estimated at over 1 week is now
  rejected by default, preserving team bandwidth for revenue-generating features.
revisit_when: Team grows beyond 5 members or MAU exceeds 50k — at that point a scale-focused
  stage with different constraints (performance > stability > speed) may be appropriate
