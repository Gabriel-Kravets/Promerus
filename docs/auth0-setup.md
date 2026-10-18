# Auth0 setup and demonstration guide

## Status and scope

Reviewed on `feature/sproutbound-auth`. Existing code already uses the official SPA SDK 2.27.0 with popup login/signup, `getUser`, `isAuthenticated`, redirect callback handling, and hosted logout. The current Domain and Client ID are reused. Public source cannot reveal which tenant connections, branding, or passkey policies are enabled; their status remains **unverified** until you check your dashboard.

The repository changes keep Universal Login in charge of all authentication methods. Google and passkeys need dashboard configuration, not another authentication implementation. No new Google button is hardwired to an assumed connection name. Once enabled, those methods appear inside the existing popup and reach the same welcome/game path through `getUser()`.

Dashboard changes below are manual. Do not put a Google client secret, Auth0 client secret, Management API token, or Supabase service-role key into this repository/browser.

## 1. Existing SPA application

1. Open **Applications → Applications**, select the existing SPA whose Client ID matches `config.js`, then **Settings**. Keep that application and tenant; do not create replacement identities.
2. Confirm application type **Single Page Application**. Retain the SPA/public-client configuration.
3. Add `http://localhost:3000/` under **Allowed Callback URLs** and **Allowed Logout URLs**, and `http://localhost:3000` under **Allowed Web Origins**. Keep teammates' valid values. The adapter uses the origin root even when called from `/game` or `/learn`.
4. Add the corresponding real HTTPS deployment URLs when available. Do not invent a deployment host or use wildcard callbacks. Save changes.
5. Under the application's **Connections** tab, ensure the existing database connection remains enabled. Keep database signup enabled if players should create accounts.

## 2. Google through Auth0

1. In **Authentication → Social**, inspect the existing Google connection first. Reuse it if present; otherwise choose **Create Connection → Google/Gmail**.
2. For your own Google credentials, open **Google Auth Platform** in Google Cloud, select the team's project, configure **Branding**, **Audience**, and **Data Access**, and add the demo accounts as test users if the Google app is in testing. Request only basic identity/profile access for this task.
3. Under **Clients**, create a **Web application** OAuth client. With the current configured Auth0 domain, set its authorized JavaScript origin to `https://dev-phu3idfk55gl1dkn.us.auth0.com` and authorized redirect URI to `https://dev-phu3idfk55gl1dkn.us.auth0.com/login/callback`. This is Google's callback **to Auth0**, not SproutBound's localhost callback.
4. Enter the Google Client ID and Client Secret in the **Auth0 Google connection settings only**, then save. Existing Auth0 developer keys can be used for development where supported; they should not be relied upon for production or as proof your own provider setup works.
5. In the connection's **Applications** tab, enable the existing SproutBound SPA. Alternatively confirm it under the SPA's **Connections** tab. Keep the database connection enabled too.
6. Use **Try Connection** to check provider configuration, then test from SproutBound's real popup. A successful connection test alone does not check the application's callback URLs.

**Code behavior:** both entry buttons leave `connection` unset. Auth0 presents enabled options; selecting Google signs in an existing Google identity or provisions a new one when permitted by the connection. Errors return to the shared recovery UI. No extra Google SDK, provider tokens, scopes, or OAuth endpoints are added.

Google and email/password sign-ins with the same email can have different Auth0 `sub` values. Do not automatically merge identities by email. Account linking requires a separate, deliberately authenticated design.

Source: [Auth0 Google setup](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers/google).

## 3. Hosted Universal Login branding

The existing mascot is `sprout-mascot.png` (1280×1280 PNG). Existing fonts are IM Fell English and DM Sans; colors below come from `styles.css`. Reuse these assets. Ordinary Next.js/site CSS does not style the page hosted on Auth0's origin.

1. Under **Applications → Applications → existing SPA → Settings**, set the display name to **SproutBound**. This changes the label, not the Client ID.
2. Open **Branding → Universal Login** and use the **New Universal Login** experience. Use **Customization Options** (the no-code theme editor), not a Classic custom HTML page.
3. In the editor's styles, use these targets where a corresponding control exists:

   | Element | Value |
   | --- | --- |
   | Page background | `#111d30` navy |
   | Widget/card background | `#f4d7a6` parchment |
   | Main text | `#3a281c` dark brown |
   | Primary button | `#294d29` forest green |
   | Button text | `#f8f0d8` cream |
   | Links | `#294d29` |
   | Border | `#8d6238` |
   | Focus outline | `#254f22` |

4. Use the existing mascot as the logo. The hosted page needs a **public HTTPS image URL**. This branch cannot create that hosting or verify a new deployment URL. After the image is published through the team's normal review/deployment process, open its actual image URL in a signed-out browser, verify it loads, then paste it into the logo field. Do not paste a GitHub HTML file page, private URL, localhost URL, or unverified raw URL.
5. Keep body text readable with a supported sans-serif font; use DM Sans only if the editor supports it or the team already hosts a compatible font URL. Custom font upload/URL options depend on the editor. Do not assume a Google Fonts stylesheet URL is a valid font-file URL. Keep Auth0 defaults where a precise match is unsupported.
6. In **Branding → Universal Login → Edit text and translations** (some dashboards show **Advanced Options → Custom Text**), select English and edit the actual screens used by your flow. With Identifier First, include `login-id`, `login-password`, `signup`, and `signup-password` where available. Preview the screens; do not assume changing `login` also changes Identifier First screens.

   | Screen / element | Suggested wording |
   | --- | --- |
   | Login title | Welcome back, gardener |
   | Login description | Sign in to return to your greenhouse. |
   | Final login button | Enter the Greenhouse |
   | Signup title | Your journey begins here |
   | Signup description | Create your SproutBound account. |
   | Final signup button | Create an account |

   Leave intermediate identifier steps labeled **Continue**, Google buttons clearly labeled **Continue with Google**, and passkey/password/recovery controls explicitly named. Keep error and credential labels clear. Use the editor's existing fields rather than assuming JSON text IDs; titles can appear on multiple prompts.
7. Preview mobile width, 200% zoom, keyboard focus, contrast, error messages, password recovery, signup, and passkey prompts. Save the theme/text changes.

Themes and text can affect other applications in a shared tenant. Confirm the team agrees before saving tenant-wide branding. The supported editor preserves Auth0's responsive widget. A full pixel-art HTML reconstruction is outside this task and can conflict with native passkeys; the local SproutBound landing page remains intact.

Sources: [Auth0 themes](https://auth0.com/docs/customize/login-pages/universal-login/customize-themes), [Auth0 text customization](https://auth0.com/docs/customize/login-pages/universal-login/customize-text-elements).

## 4. Enable Auth0 database passkeys

1. Keep **New Universal Login**. In **Authentication → Authentication Profiles**, choose **Identifier First**. If Auth0 reports a conflicting Classic custom page, go to **Branding → Universal Login → Manage Classic Login → Login** (or **Advanced Options → Login**) and disable **Custom Login Page**. This refers to Auth0-hosted Classic HTML, not your local SproutBound page.
2. Open **Authentication → Database → existing connection → Authentication Methods → Passkey → Configure**. Enable passkeys, keep passwords enabled, choose **Passkey button & autofill**, and save.
3. Enable optional **Progressive Enrollment** so existing database users can add a passkey after password login. Let players skip it. Verify any remaining prerequisites in the panel; username-required or custom-database configurations can require additional setup. Do not migrate users or change those settings blindly.
4. Keep the Google connection active. Database passkeys enroll on database identities; Google accounts retain their Google sign-in. A passkey used by Google itself is managed by Google.
5. Keep the existing Auth0 domain/RP ID during the hackathon. Passkeys bind to that domain; changing it can require re-enrollment. No RP ID override is necessary for this hosted flow.

Source: [Auth0 passkey configuration](https://auth0.com/docs/authenticate/database-connections/passkeys/configure-passkey-policy).

### Popup compatibility and fallback

The popup is a top-level Auth0 Universal Login window, not an embedded cross-origin iframe. Auth0 handles its passkey prompts and returns through the SDK's existing web-message popup flow. No WebAuthn request, invented passkey scope, connection name, or special passkey SDK method belongs in the app. Keep the default popup first; actual device/browser/tenant compatibility still needs manual verification.

If autofill is unavailable, use Auth0's passkey button. If device enrollment or authentication is unavailable/cancelled, choose **Try another method** or password in the hosted widget. Google remains another option. If the popup is blocked, cancelled, or times out, expand **Need a hand signing in?** and choose **Continue sign-in in this tab**. This explicitly calls `loginWithRedirect()` on the existing client and preserves the last attempted signup intent. It is never an automatic redirect. A two-minute popup timeout can interrupt slow enrollment; retry in the tab if necessary.

The repository intentionally does not probe `PublicKeyCredential` in the landing page to decide whether the Auth0-hosted page can offer passkeys, nor display a separate passkey button before tenant enrollment is confirmed.

Sources: [Auth0 passkey experience and password fallback](https://auth0.com/docs/authenticate/database-connections/passkeys), [official SPA SDK popup/redirect methods](https://auth0.com/docs/libraries/auth0-single-page-app-sdk).

### macOS enrollment and login test

1. Use current Safari and Chrome in normal tabs on macOS with an available credential manager (for example iCloud Passwords/Keychain) and device screen lock. Touch ID is optional; the system may offer a PIN/password or another device. Do not assume an embedded browser supports the OS prompt.
2. For an existing **database** test user: sign in with its password, accept Auth0's progressive enrollment offer, and approve the system passkey prompt yourself. Record the Auth0 user ID in the dashboard before/after; adding the credential should preserve the identity.
3. For a new disposable database test account: choose **Create an account**, follow the hosted signup, and create a passkey if offered. Skip enrollment once in a separate test to verify password fallback still works.
4. Sign out. To force a fresh authentication rather than reuse Auth0 SSO, use a normal separate browser profile without an Auth0 login session but with the required passkey provider available, or sign out the test user's Auth0 session first.
5. Choose **Enter the Greenhouse**, then **Continue with a passkey** or the saved-credential autofill inside Auth0. Approve the OS prompt. Confirm the popup closes, the welcome/game view appears, and the same user identity is returned. Refresh, then sign out again.
6. Cancel the OS credential prompt and verify password/other-method recovery inside Auth0. Separately close the popup, block popups, and wait for timeout; verify the landing page recovers and the explicit full-tab fallback works. Repeat the passkey flow in Safari and Chrome.
7. Test Google signup/login and database password login after enabling passkeys to ensure all remain available. Do not paste passkeys, passwords, tokens, or provider secrets into issue reports.

## 5. Security and Supabase handoff

- Existing scopes `openid profile email`, domain, Client ID, claims, audience, SDK version, and `cacheLocation: "localstorage"` are unchanged. No refresh-token grants or Actions were added. LocalStorage remains an XSS exposure; this task does not silently change session persistence. Raw provider errors/tokens are no longer logged or echoed in the local UI.
- Treat Auth0 `sub` as an opaque string, including any provider prefix. Do not cast it to a UUID, strip the prefix, or use email as a database identity. Google and database accounts can be different users even if their email addresses match. Enrollment of a passkey on the existing database user preserves that user's identity.
- Supabase's Auth0 third-party integration requires its own trust/token and RLS setup. Coordinate issuer, audience, accepted token type, role requirements, and subject mapping with the backend teammate. No claim changes for Supabase (including any required role claim), new Supabase Auth accounts, token exchange, or database policy changes are included here. Do not assume the current OIDC-only login tokens already authorize Supabase calls.
- An ID token/profile renders the UI; it is not a substitute for backend authorization. The future backend must validate the appropriate JWT and enforce row/resource ownership. Preserve existing identity formats during that work.
- The origin-root callback avoids adding every game route to Auth0's allowlist. Full-tab fallback returns to the root; popup login leaves the original route open. A future deep-link return feature should allow only validated same-origin paths.

Reference for the backend teammate: [Supabase Auth0 integration](https://supabase.com/docs/guides/auth/third-party/auth0).

## 6. Verification matrix

| Check | Expected result | Requires real tenant/device? |
| --- | --- | --- |
| Startup | Buttons wait until session check finishes; retry after failure | No for mocked tests |
| Password signup/login | Existing flow and same database identities | Yes |
| Google new/returning user | Same UI path; provider profile returned unchanged | Yes |
| Passkey enrollment/login | Auth0/OS prompts; same database identity | Yes, macOS credential manager |
| Popup cancellation/block/timeout | Safe message; controls recover; no forced redirect | No for mocked tests; browser smoke check recommended |
| Explicit full-tab signup fallback | Auth0 signup, root callback, welcome view | Yes for end-to-end |
| Refresh/logout | SDK session restoration; logout returns to root | Yes for end-to-end |
| Accessibility | Keyboard controls, visible focus, live status, readable mobile layout | Browser/manual |

Run `node --test tests/*.test.cjs` and `node --check` on the three first-party scripts. This feature branch has no tracked Next build target. After teammates port the adapter/UI into `dev`, run that branch's typecheck, tests, and Next build as well as its `/game` and `/learn` login flows. Tests use mocks and cannot enable Google, change hosted branding, or verify a real passkey. Mark those items as pending until manual checks pass.
