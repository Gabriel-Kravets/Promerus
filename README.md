# SproutBound authentication component

This branch contains the standalone authentication component for the team's Next.js game. It keeps the existing parchment card, navy background, green entry button, fonts, and seated sprout mascot. The official Auth0 SPA SDK **2.27.0** still handles authentication through Universal Login.

## What is ready

- Existing popup login, signup, logout, and SDK session restoration.
- One Universal Login flow for every enabled method: email/password, Google, and database passkeys. No provider is forced, so email/password remains available. Google/passkey availability must be configured in Auth0; it cannot be inferred from the public Client ID.
- Disabled controls during startup/requests, accessible status messages, retry, and safe error wording. Background SDK HTTP/authorization timeouts are 15 seconds; interactive popups retain their 120-second timeout.
- An optional **Need a hand signing in? → Continue sign-in in this tab** fallback using the same SDK. It preserves signup intent after a failed signup popup and never redirects automatically.
- A stable origin-root callback/logout URL, matching the integrated game on `dev`.

**Google, passkeys, and hosted branding are not enabled by these repository changes.** Complete [the dashboard setup and macOS test procedure](docs/auth0-setup.md). No Auth0 dashboard was accessed.

## Run the component

From this directory, with port 3000 free:

```sh
python3 -m http.server 3000 --bind localhost
```

Open `http://localhost:3000/` in Safari or Chrome. This feature branch has no tracked `package.json`, Next.js source tree, or build command; do not use stale generated `.next` or `out` directories as its source. The integrated game's `dev` branch uses `npm run dev` on the same port. Run one server at a time.

In the existing Auth0 SPA application, add these values without removing teammates' valid URLs:

| Setting | Local value |
| --- | --- |
| Allowed Callback URLs | `http://localhost:3000/` |
| Allowed Logout URLs | `http://localhost:3000/` |
| Allowed Web Origins | `http://localhost:3000` |

If you still use port 4173 for the standalone component, add its matching root callback/logout URLs and origin too. Deployed applications need their actual HTTPS URLs. Configuration stays in `config.js`; only the Domain and public SPA Client ID belong there.

## Checks

Requires Node.js 18 or newer; no dependency installation is needed for these tests.

```sh
node --test tests/*.test.cjs
node --check auth.js
node --check app.js
node --check config.js
```

Tests mock the SDK and DOM to exercise provider-neutral profiles, popup timing/cleanup, failures, callback cleanup, retry, signup fallback, and logout. They do not authenticate against the tenant or prove passkey/Touch ID enrollment. Use the manual matrix in [the setup guide](docs/auth0-setup.md) for those checks.

## Teammate integration

- `auth.js`: existing adapter methods `isConfigured`, `initialize`, `login`, `signup`, `logout`; adds `loginInTab(signup = false)` and `errorMessage(error)`.
- `app.js`, `index.html`, `styles.css`: standalone auth UI and temporary welcome screen.
- `config.js`: unchanged public Auth0 settings.
- `auth0-spa-js.production.js`, `LICENSE.auth0-spa-js`: unchanged vendored official SDK and license.
- `sprout-mascot.png`: unchanged existing branding asset.
- `docs/auth0-setup.md`: dashboard instructions, branding palette, macOS checks, security and Supabase handoff.

The game on `dev` loads its adapter from **`public/auth/auth.js`**, not root `auth.js`. During integration, port this adapter's changes into that copy and wire the optional fallback/help into `AuthGate.tsx`. Root `app.js` targets this HTML's elements and should not be injected into the React game. The existing `initialize/login/signup/logout` contract remains compatible; all methods continue returning the SDK's original user profile without rewriting `sub`.

Scopes remain `openid profile email`; no audience, claims, Auth0 domain, Client ID, refresh-token policy, or token-cache setting was changed. Existing localStorage caching persists across reloads but is exposed to successful XSS. Client UI gating does not authorize backend requests. Review the future backend/token policy with the Supabase teammate before adding API access.
