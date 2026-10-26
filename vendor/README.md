# Vendored third-party code

`supabase-js-2.95.0.js` — a single self-contained ES module (no external imports) of
`@supabase/supabase-js@2.95.0` and its runtime deps, so the app no longer loads code from esm.sh.

| Package | Version | Licence |
|---|---|---|
| @supabase/supabase-js, auth-js, functions-js, postgrest-js, realtime-js, storage-js | 2.95.0 | MIT (© Supabase) |
| iceberg-js | 0.8.1 | MIT |
| tslib | 2.8.1 | 0BSD (© Microsoft) |

Rebuilt (one-off, not part of the app — the app still has no build step) with:

```sh
npm i @supabase/supabase-js@2.95.0 esbuild
echo "export * from '@supabase/supabase-js'" > in.js
npx esbuild in.js --bundle --format=esm --platform=browser --target=es2020 --minify --legal-comments=eof --outfile=supabase.mjs
```

When upgrading, rebuild, rename the file with the new version, and update `js/app.js` (`client()`) and the `sw.js` precache list.
