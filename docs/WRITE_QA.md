# NHANHVALE WRITE — release verification

## Automated
GitHub Actions checks every push or PR targeting main. Unit tests check JS syntax, CSP, PWA cache, backup/restore structure, XP, shields, streaks, IME formatting logic, and UI search/keyboard wiring.

## Device matrix
1. Android Chrome: type 500+ Vietnamese words with Telex, format underline and strikethrough, background app and reopen.
2. Offline: edit two different articles offline and verify both survive reload; reconnect and sync with same account.
3. Two tabs: edit two different topics simultaneously, confirm neither loses content.
4. Two devices: intentionally produce same-topic conflict in disposable test data and verify both versions can be exported before choosing.
5. Export full JSON. Inspect topics, logs, XP, reviews, links. Import into a blank profile and repeat import: no XP event duplication or daily-word-count reduction.
6. Performance: search across 100, 500 and 1,000 topics in phone and desktop views; focus and scroll should remain steady.
7. Accessibility: Tab, Enter, Space navigate article cards; 200% zoom, dark mode and narrow 320px display remain usable.
8. Storage pressure: test only with disposable data. Verify a failed save warns and the original file remains exportable.
9. Confirm Supabase RLS policies exist for all write_* tables and indexes for user_id scans; review advisor findings.
10. Production: confirm Vercel READY status and commit SHA; verify offline PWA reload and Android maskable icon.

**Limits:** unit checks are not screenshots or real-device tests. Automatic Vercel Git deployments are not blocked by this workflow unless a required deployment check or branch protection rule is configured.

## v6.21.0 — IndexedDB shadow (non-destructive)
- The original localStorage remains authoritative; IndexedDB holds up to three most recent full JSON snapshots per local account scope.
- A snapshot is queued after a successful save, asynchronously, without blocking typing. The manual Create button forces an immediate snapshot.
- Export from Settings → Sao lưu và khôi phục or from the corrupted-data recovery screen. The export only downloads JSON and does not restore/overwrite the app.
- Clearing browser site data deletes BOTH primary data and local IndexedDB snapshots; export JSON outside the browser before clearing site data.
- Never claim device-specific Android tests passed solely because a CI unit test passed.
