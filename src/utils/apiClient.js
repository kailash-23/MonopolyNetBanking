/**
 * Authenticated Fetch Wrapper
 *
 * Wraps the native fetch API to automatically detect expired/invalid
 * sessions (HTTP 401) and sign the user out with a redirect to sign-in.
 */

let isSigningOut = false;

function handleSessionExpired() {
  if (isSigningOut) return; // prevent multiple redirects
  isSigningOut = true;

  localStorage.removeItem("authToken");
  localStorage.removeItem("user");

  // Redirect to sign-in page with a session expired flag
  window.location.href = "/signin?sessionExpired=true";
}

/**
 * A drop-in replacement for fetch() that auto-signs out on 401 responses.
 * Use this for any API call that sends an auth token.
 */
export async function authFetch(url, options = {}) {
  const response = await fetch(url, options);

  if (response.status === 401) {
    // Don't auto-sign-out for sign-in / sign-up requests
    const isAuthEndpoint =
      url.includes("/api/auth/signin") ||
      url.includes("/api/auth/signup") ||
      url.includes("/api/auth/oauth/");

    if (!isAuthEndpoint) {
      handleSessionExpired();
      throw new Error("Session expired. Please sign in again.");
    }
  }

  return response;
}

export default authFetch;
