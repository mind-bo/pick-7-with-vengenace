# Notes

## Scaffold changes from the plan

- The plan names `@cloudflare/vitest-pool-workers`. The maintainers deprecated that package and renamed it. Use `@cloudflare/vitest-plugin` instead. The test config uses its `cloudflareTest` plugin.
- `npm install` fails with the error "Cannot read properties of null (reading 'edgesOut')" when it adds `vitest`. The file `.npmrc` sets `legacy-peer-deps=true` to avoid the error.
- `compatibility_date` is `2026-08-15`. This is the last date that the installed `workerd` supports.
