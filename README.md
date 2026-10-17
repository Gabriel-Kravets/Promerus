# Sproutbound authentication prototype

This is the existing Sproutbound login page with Auth0 popup authentication. Its artwork, typography, colors, and layout remain local to Sproutbound. Auth0 Universal Login opens in a separate window to collect credentials; the original page stays visible. The page does not collect a password.

## Auth0 application settings

The Domain and Client ID for the hackathon Single Page Application are already in `config.js`. These identifiers are public; never add a Client Secret to browser code. Confirm these settings in the Auth0 application's dashboard:

| Auth0 setting | Local value |
| --- | --- |
| Allowed Callback URLs | `http://localhost:4173/` |
| Allowed Logout URLs | `http://localhost:4173/` |
| Allowed Web Origins | `http://localhost:4173` |

Enable the database and/or social connections you want players to use. Auth0's hosted login screen includes its own **Reset password** link for database users; the old local Forgot password link was removed because the page no longer asks for an email. When deployed, add the matching HTTPS callback, logout URL, and web origin for the final host.

The current Auth0 popup says **SwampHacks Study Tool**. To keep the player experience consistent, update the application name and Universal Login branding in the Auth0 dashboard when your team is ready.

## Run and test

Continue serving this folder at `http://localhost:4173/`. If that server is stopped, run `python3 -m http.server 4173` from this folder. No framework or package install is required.

1. Open `http://localhost:4173/` in a regular browser tab. Select **Enter the Greenhouse**. Auth0 should open in a popup while the Sproutbound page stays visible.
2. Sign in with a test account. The popup should close and Sproutbound should show the temporary welcome panel with the account's name or email.
3. Refresh the Sproutbound tab. The welcome panel should return while the SDK's cached session is valid.
4. Select **Sign out**. Auth0 clears the session and returns to the login page.
5. Select **Create an account**. The popup should open Auth0's signup screen. Complete this with a disposable test account if you want to verify the whole flow.
6. To check password recovery, open the login popup and choose **Reset password** inside Auth0.

The SDK uses `loginWithPopup()` for both login and signup. It opens the popup directly from the button click to avoid browser popup blocking and uses `screen_hint: "signup"` for account creation. If your browser still blocks the window, allow popups for `localhost:4173`. Closing the popup before finishing shows a gentle cancellation message on Sproutbound. Logout uses Auth0's hosted logout and returns to the same page.

The Auth0 SDK's local storage cache restores a valid token after refresh. For the final game, the team should review the cache choice and any API authorization with its production security model. Expired sessions may need an Auth0 silent session check, which can depend on browser privacy settings.

## Files for integration

- `index.html` and `styles.css`: existing fantasy-themed page and temporary welcome panel.
- `config.js`: public Auth0 application settings.
- `auth.js`: reusable Auth0 adapter (`initialize`, `login`, `signup`, `logout`). It leaves protocol handling to the official SDK.
- `app.js`: button interactions, errors, and signed-in rendering.
- `auth0-spa-js.production.js`: official Auth0 SPA SDK browser bundle, version 2.27, from `https://cdn.auth0.com/js/auth0-spa-js/2.27/auth0-spa-js.production.js`; its license is in `LICENSE.auth0-spa-js`.

The prototype contains no database, game dashboard, or progression system. The welcome panel can be replaced by the game's authenticated route when the team integrates it.
