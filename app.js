(() => {
  const auth = window.SproutboundAuth;
  const status = document.querySelector("#status");
  const signedOut = document.querySelector("#signed-out");
  const signedIn = document.querySelector("#signed-in");
  const loginButton = document.querySelector("#login");
  const signupButton = document.querySelector("#signup");
  const logoutButton = document.querySelector("#logout");

  function setStatus(message, kind = "") {
    status.textContent = message;
    status.className = `status ${kind}`.trim();
  }

  function showUser(user) {
    signedOut.hidden = Boolean(user);
    signedIn.hidden = !user;
    if (!user) return;
    const displayName = user.name || user.nickname || user.email || "Gardener";
    document.querySelector("#user-name").textContent = displayName;
    const email = document.querySelector("#user-email");
    email.textContent = user.email || "";
    email.hidden = !user.email || user.email === displayName;
  }

  function errorMessage(error) {
    const code = error?.error || error?.code || error?.name;
    if (code === "PopupCancelledError" || code === "popup_closed" || error?.message === "Popup closed") return "The sign-in window was closed. You can try again whenever you're ready.";
    if (code === "TimeoutError" || code === "timeout") return "The sign-in window timed out. Please try again.";
    if (code === "PopupOpenError") return "Your browser blocked the sign-in window. Allow popups for this page and try again.";
    return error?.message || "Authentication couldn't be completed. Please try again.";
  }

  async function authenticate(action) {
    loginButton.disabled = true;
    signupButton.disabled = true;
    setStatus("Opening the sign-in window…");
    try {
      // action() opens the popup synchronously in the original button click.
      const user = await action();
      if (!user) throw new Error("Signed in, but the profile could not be loaded. Please try again.");
      showUser(user);
      setStatus("");
    } catch (error) {
      console.error("Auth0 popup failed", error);
      setStatus(errorMessage(error), "error");
    } finally {
      loginButton.disabled = false;
      signupButton.disabled = false;
    }
  }

  loginButton.addEventListener("click", () => authenticate(() => auth.login()));
  signupButton.addEventListener("click", () => authenticate(() => auth.signup()));
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    setStatus("Signing out…");
    try {
      await auth.logout();
    } catch (error) {
      console.error("Auth0 logout failed", error);
      setStatus(errorMessage(error), "error");
      logoutButton.disabled = false;
    }
  });

  window.addEventListener("DOMContentLoaded", async () => {
    if (!auth.isConfigured()) {
      setStatus("Add your Auth0 Domain and Client ID in config.js to enable sign-in.", "error");
      return;
    }
    setStatus("Checking your session…");
    try {
      showUser(await auth.initialize());
      setStatus("");
    } catch (error) {
      console.error("Auth0 initialization failed", error);
      setStatus(errorMessage(error), "error");
    }
  }, { once: true });
})();
