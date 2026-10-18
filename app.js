(() => {
  const auth = window.SproutboundAuth;
  const status = document.querySelector("#status");
  const signedOut = document.querySelector("#signed-out");
  const signedIn = document.querySelector("#signed-in");
  const card = document.querySelector(".login-card");
  const loginButton = document.querySelector("#login");
  const signupButton = document.querySelector("#signup");
  const logoutButton = document.querySelector("#logout");
  const retryButton = document.querySelector("#retry");
  const tabButton = document.querySelector("#continue-in-tab");
  let busy = true;
  let ready = false;
  let signupRequested = false;

  function setStatus(message, kind = "") {
    status.textContent = message;
    status.className = `status ${kind}`.trim();
  }

  function setBusy(value) {
    busy = value;
    card.setAttribute("aria-busy", String(value));
    for (const button of [loginButton, signupButton, tabButton]) button.disabled = value || !ready;
    retryButton.disabled = value;
    logoutButton.disabled = value;
  }

  function showUser(user) {
    signedOut.hidden = Boolean(user);
    signedIn.hidden = !user;
    const displayName = user?.name || user?.nickname || user?.email || "Gardener";
    document.querySelector("#user-name").textContent = displayName;
    const email = document.querySelector("#user-email");
    email.textContent = user?.email || "";
    email.hidden = !user?.email || user.email === displayName;
  }

  function reportError(error) {
    setStatus(auth?.errorMessage(error) || "Sign-in could not load. Check your connection and refresh.", "error");
    retryButton.hidden = false;
  }

  async function initialize() {
    if (busy && ready) return;
    setBusy(true);
    retryButton.hidden = true;
    setStatus("Checking your session…");
    try {
      if (!auth) throw new Error("SDK unavailable");
      if (!auth.isConfigured()) {
        const error = new Error("Missing public configuration");
        error.error = "configuration_error";
        throw error;
      }
      showUser(await auth.initialize());
      ready = true;
      setStatus("");
    } catch (error) {
      // A transient session check must not prevent a fresh interactive login.
      ready = Boolean(auth?.isConfigured());
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  async function authenticate(signup, inTab = false) {
    if (busy || !ready) return;
    signupRequested = signup;
    setBusy(true);
    retryButton.hidden = true;
    setStatus(inTab ? "Taking you to secure sign-in…" : "Opening your secure sign-in window…");
    try {
      if (inTab) {
        await auth.loginInTab(signup);
        return;
      }
      // Invoke before any await so window.open stays inside the button click.
      const user = await (signup ? auth.signup() : auth.login());
      if (!user) throw new Error("Profile unavailable");
      showUser(user);
      setStatus("You're signed in. Welcome to the greenhouse.");
      document.querySelector("#welcome").focus();
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  loginButton.addEventListener("click", () => authenticate(false));
  signupButton.addEventListener("click", () => authenticate(true));
  tabButton.addEventListener("click", () => authenticate(signupRequested, true));
  retryButton.addEventListener("click", () => { if (!busy) void initialize(); });
  logoutButton.addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    setStatus("Signing out…");
    try {
      await auth.logout();
      showUser(null);
      setStatus("");
    } catch {
      setStatus("We couldn't sign you out. Check your connection and try again.", "error");
    } finally {
      setBusy(false);
    }
  });

  // Also initialize when a host loads this script after DOMContentLoaded.
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => void initialize(), { once: true });
  } else {
    void initialize();
  }
})();
