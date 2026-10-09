-- docs/data-model.md, 2026-10-10. The process name (x-win execName, e.g. WINWORD): rules and memory match on it.
ALTER TABLE visit ADD COLUMN exec_name TEXT;
