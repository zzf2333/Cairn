I was profiling /api/feed and noticed it does N+1 queries when loading post authors. Let's optimize this — refactor the query layer to use eager loading. Show me the plan.
