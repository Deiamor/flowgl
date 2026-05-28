# AGENTS.md

## Agent Catalog

| Agent | Role | Authorities | Prohibitions |
|-------|------|-------------|--------------|
| main | Architecture, API design, orchestration | All files | — |
| design-system-ui | UI components (demo page only) | Read design system, write demo CSS | Modify core library source |
| reviewer | Code review of PRs / diffs | Read all source | Write to source |
| tester | Run build / type-check / tests | Bash (build commands) | Modify source |
| documenter | Generate HISTORY.md entries, README sections | Read source, write docs | Modify source |
| migrator | Bulk file transformations | Edit/Write with worktree isolation | Merge to main directly |
