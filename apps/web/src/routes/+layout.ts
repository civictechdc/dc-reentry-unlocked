// The whole app is client-rendered (SPA mode): SvelteKit serves the HTML
// shell for every route, including the plain-language error page, and the
// Node adapter keeps the server in charge of all responses.
export const ssr = false;
