# AegisFlow frontend (Angular 22)

Standalone components, signals, zoneless change detection, lazy routes, Vitest.

```bash
npm ci
npm start                                      # browser-only demo (localStorage), http://localhost:4200
npm start -- --configuration http              # uses the .NET API at http://localhost:5120
npm test                                       # unit tests
npm run build                                  # production build (browser mode)
npx ng build --configuration http-production   # production build against the API
```

The data source is chosen at build time: `src/app/core/config.ts` (browser) is replaced by `config.http.ts` in the `http*`
configurations. UI code only talks to the abstract `DocumentApi`.
