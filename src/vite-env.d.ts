/// <reference types="vite/client" />

/**
 * Typed environment surface. Every `VITE_*` value is optional: `src/lib/config.ts`
 * applies production-safe defaults when a variable is absent, so a missing
 * `.env` file never produces an undefined runtime value.
 */
interface ImportMetaEnv {
  readonly VITE_APP_TITLE?: string;
  readonly VITE_DEFAULT_LOCALE?: string;
  readonly VITE_DEFAULT_CURRENCY?: string;
  readonly VITE_SERVICE_FEE_PERCENT?: string;
  readonly VITE_SEARCH_DEBOUNCE_MS?: string;
  readonly VITE_ENABLE_MAP_CLUSTERING?: string;
  readonly VITE_ENABLE_URL_STATE_SYNC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
