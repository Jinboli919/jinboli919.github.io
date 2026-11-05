
(() => {
    "use strict";

    // ==========================================
    // Configuration
    // ==========================================

    const GITHUB_HOST =
        "jinboli919.github.io";

    const AUTH_KEY =
        "coe-dashboard-preview-access";

    const AUTH_VALUE =
        "granted";

    const COOKIE_NAME =
        "coe-dashboard-preview-session";


    // ==========================================
    // Only protect the GitHub Pages website.
    // Local development does not need a password.
    // ==========================================

    if (
        window.location.hostname.toLowerCase() !==
        GITHUB_HOST
    ) {
        return;
    }


    // ==========================================
    // Check sessionStorage
    //
    // This is the original login mechanism.
    // Keep it compatible with preview-login.html.
    // ==========================================

    function hasTabAccess() {

        try {

            return (
                window.sessionStorage.getItem(
                    AUTH_KEY
                ) === AUTH_VALUE
            );

        } catch (error) {

            return false;

        }

    }


    // ==========================================
    // Check shared session cookie
    //
    // Cookies are shared between tabs belonging
    // to the same website and browser session.
    // ==========================================

    function hasCookieAccess() {

        const expectedCookie =
            COOKIE_NAME + "=" + AUTH_VALUE;

        return document.cookie
            .split(";")
            .some(cookie => {
                return (
                    cookie.trim() === expectedCookie
                );
            });

    }


    // ==========================================
    // Create a browser session cookie
    //
    // No Max-Age or Expires attribute:
    // this is a browser session cookie.
    // ==========================================

    function saveCookieAccess() {

        document.cookie =
            COOKIE_NAME +
            "=" +
            AUTH_VALUE +
            "; Path=/" +
            "; SameSite=Lax" +
            "; Secure";

    }


    // ==========================================
    // Keep the current tab authenticated
    // ==========================================

    function saveTabAccess() {

        try {

            window.sessionStorage.setItem(
                AUTH_KEY,
                AUTH_VALUE
            );

        } catch (error) {

            // Session cookie can still provide access.

        }

    }


    // ==========================================
    // Main authentication logic
    // ==========================================

    // Case 1:
    // The current tab has already logged in.
    //
    // Create a shared session cookie so that
    // other tabs can recognize this login.

    if (hasTabAccess()) {

        saveCookieAccess();

        return;

    }


    // Case 2:
    // Another tab has already authenticated.
    //
    // Read the shared cookie and allow access
    // without asking for the password again.

    if (hasCookieAccess()) {

        saveTabAccess();

        return;

    }


    // Case 3:
    // No valid login state exists.
    //
    // Redirect to the original password page.

    const currentPage =
        window.location.pathname +
        window.location.search +
        window.location.hash;

    const loginURL =
        "/preview-login.html?next=" +
        encodeURIComponent(currentPage);

    window.location.replace(loginURL);

})();
