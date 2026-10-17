/* Auth0 adapter for the login page. The game can reuse this module later. */
window.SproutboundAuth = (() => {
  const config = window.SPROUTBOUND_AUTH || {};
  let clientPromise;

  function isConfigured() {
    return Boolean(config.domain && config.clientId &&
      !config.domain.startsWith("YOUR_") && !config.clientId.startsWith("YOUR_"));
  }

  function pageUrl() {
    return window.location.origin + "/";
  }

  function getClient() {
    if (!isConfigured()) throw new Error("Add your Auth0 domain and Client ID in config.js.");
    if (!window.auth0?.createAuth0Client) throw new Error("The Auth0 SDK did not load. Check your connection and refresh.");
    if (!clientPromise) {
      clientPromise = window.auth0.createAuth0Client({
        domain: config.domain,
        clientId: config.clientId,
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
      const message = params.get("error_description") || "Sign-in was cancelled or could not be completed.";
      clearCallbackParameters();
      throw new Error(message);
    }
    if (params.has("code") && params.has("state")) {
      await client.handleRedirectCallback();
      clearCallbackParameters();
    }
    return (await client.isAuthenticated()) ? client.getUser() : null;
  }

  function openAuthPopup() {
    const width = Math.min(500, window.screen.availWidth);
    const height = Math.min(700, window.screen.availHeight);
    const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
    const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
    const popup = window.open("", "_blank", `popup=yes,width=${width},height=${height},left=${left},top=${top}`);
    if (!popup) throw new Error("Your browser blocked the sign-in window. Allow popups for this page and try again.");
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

  function login() {
    return authenticate();
  }

  function signup() {
    return authenticate({ screen_hint: "signup", prompt: "login" });
  }

  async function logout() {
    const client = await getClient();
    await client.logout({ logoutParams: { returnTo: pageUrl() } });
  }

  return { isConfigured, initialize, login, signup, logout };
})();
