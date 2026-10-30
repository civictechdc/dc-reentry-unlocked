// SvelteKit ambient types (see https://svelte.dev/docs/kit/types#app.d.ts).
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

// Vite public environment variables consumed by the SPA.
interface ImportMetaEnv {
  /**
   * Base URL of the housing-inventory API the frontend talks to
   * (default: `http://localhost:3000`).
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
