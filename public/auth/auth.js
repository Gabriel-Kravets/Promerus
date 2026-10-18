/* Auth0 adapter for the login page. The game can reuse this module later. */
window.SproutboundAuth = (() => {
  const config = window.SPROUTBOUND_AUTH || {};
  let clientPromise;

  function isConfigured() {
    return Boolean(config.domain && config.clientId &&
      !config.domain.startsWith("YOUR_") && !config.clientId.startsWith("YOUR_"));
  }

  function pageUrl() {
    // Match the integrated game: nested routes share one allowlisted callback.
    return window.location.origin + "/";
  }

  function getClient() {
    if (!isConfigured()) throw authError("configuration_error");
    if (!window.auth0?.createAuth0Client) throw authError("sdk_unavailable");
    if (!clientPromise) {
      clientPromise = window.auth0.createAuth0Client({
        domain: config.domain,
        clientId: config.clientId,
        // Bound background/session requests; popup enrollment still gets 120s.
        httpTimeoutInSeconds: 15,
        authorizeTimeoutInSeconds: 15,
        authorizationParams: { redirect_uri: pageUrl(), scope: "openid profile email" },
        // Let the SDK retain its token cache across a page refresh.
        cacheLocation: "localstorage"
      }).catch(error => {
        clientPromise = undefined;
        throw error;
      });
    }
    return clientPromise;
  }

  function clearCallbackParameters() {
    const url = new URL(window.location.href);
    for (const key of ["code", "state", "session_state", "error", "error_description"]) url.searchParams.delete(key);
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
  }

  async function initialize() {
    const client = await getClient();
    const params = new URLSearchParams(window.location.search);
    if (params.has("error")) {
      const code = params.get("error");
      clearCallbackParameters();
      throw authError(code);
    }
    if (params.has("code") && params.has("state")) {
      try {
        await client.handleRedirectCallback();
      } finally {
        clearCallbackParameters();
      }
    }
    return (await client.isAuthenticated()) ? client.getUser() : null;
  }

  function openAuthPopup() {
    const width = Math.min(500, window.screen.availWidth);
    const height = Math.min(700, window.screen.availHeight);
    const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
    const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
    const popup = window.open("", "_blank", `popup=yes,width=${width},height=${height},left=${left},top=${top}`);
    if (!popup) throw authError("popup_blocked");
    return popup;
  }

  function authenticate(authorizationParams = {}) {
    // Open the window during the click itself, before awaiting SDK setup.
    const popup = openAuthPopup();
    return (async () => {
      try {
        const client = await getClient();
        await client.loginWithPopup({ authorizationParams }, { popup, timeoutInSeconds: 120 });
        return client.getUser();
      } finally {
        if (!popup.closed) popup.close();
      }
    })();
  }

  // Leave connection selection to Universal Login: database, Google, and
  // passkeys (when enabled in the tenant) all return the same SDK profile.
  function login() {
    return authenticate();
  }

  function signup() {
    return authenticate({ screen_hint: "signup", prompt: "login" });
  }

  // Used only after the player explicitly chooses the full-tab fallback.
  async function loginInTab(signup = false) {
    const client = await getClient();
    await client.loginWithRedirect({
      authorizationParams: signup ? { screen_hint: "signup", prompt: "login" } : {}
    });
  }

  async function getToken(expectedSubject) {
    const client = await getClient();
    await client.getTokenSilently();
    const claims = await client.getIdTokenClaims();
    if (expectedSubject && claims?.sub !== expectedSubject) throw new Error('This browser’s account changed. Sign out and sign in again.');
    if (!claims?.__raw) throw new Error('Your sign-in expired. Please sign in again.');
    return claims.__raw;
  }

  async function logout() {
    const client = await getClient();
    await client.logout({ logoutParams: { returnTo: pageUrl() } });
  }

  function authError(code) {
    const error = new Error(errorMessage({ error: code }));
    error.error = code;
    return error;
  }

  function errorMessage(error) {
    // Never echo provider descriptions, callback query strings, or tokens.
    const code = error?.error || error?.code || error?.name;
    if (["cancelled", "popup_closed", "PopupCancelledError"].includes(code)) return "The sign-in window was closed. Your greenhouse can wait—try again whenever you're ready.";
    if (["popup_timeout", "timeout", "TimeoutError", "PopupTimeoutError"].includes(code)) return "Sign-in took a little too long. Try again, or continue in this tab.";
    if (["popup_blocked", "popup_open", "PopupOpenError"].includes(code)) return "Your browser blocked the sign-in window. Allow popups, or continue in this tab.";
    if (code === "configuration_error") return "Sign-in is not configured yet. Check the public settings in config.js.";
    if (code === "sdk_unavailable") return "Sign-in could not load. Check your connection and retry.";
    if (code === "access_denied") return "Sign-in was not completed. You can try again and choose another available method.";
    if (["login_required", "interaction_required", "consent_required"].includes(code)) return "Please sign in again to return to your greenhouse.";
    return "We couldn't complete sign-in. Check your connection and try again.";
  }

  return { isConfigured, initialize, login, signup, loginInTab, logout, errorMessage, getToken };
})();
