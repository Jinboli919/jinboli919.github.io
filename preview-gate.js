
(() => {
    "use strict";

    // ==========================================
    // Configuration
    // ==========================================

    const AUTH_KEY =
        "coe-dashboard-preview-access";

    const AUTH_VALUE = "granted";

    const GITHUB_HOST =
        "jinboli919.github.io";

    const CHANNEL_NAME =
        "coe-dashboard-preview-session";


    // ==========================================
    // Only protect GitHub Pages.
    // Local development does not require login.
    // ==========================================

    if (
        window.location.hostname !==
        GITHUB_HOST
    ) {
        return;
    }


    // ==========================================
    // Check authentication status
    // ==========================================

    function hasAccess() {
        try {
            return (
                sessionStorage.getItem(
                    AUTH_KEY
                ) === AUTH_VALUE
            );
        } catch (error) {
            return false;
        }
    }


    // ==========================================
    // Store access in the current tab
    // ==========================================

    function grantAccess() {
        try {
            sessionStorage.setItem(
                AUTH_KEY,
                AUTH_VALUE
            );

            return true;
        } catch (error) {
            return false;
        }
    }


    // ==========================================
    // Redirect to existing password page
    // ==========================================

    function redirectToLogin() {

        if (hasAccess()) {
            document.documentElement.style.visibility =
                "";
            return;
        }

        const currentPage =
            window.location.pathname +
            window.location.search +
            window.location.hash;

        const loginURL =
            "/preview-login.html?next=" +
            encodeURIComponent(
                currentPage
            );

        window.location.replace(
            loginURL
        );
    }


    // ==========================================
    // Share authentication between open tabs
    // ==========================================

    let channel = null;

    if (
        typeof BroadcastChannel !==
        "undefined"
    ) {
        try {
            channel = new BroadcastChannel(
                CHANNEL_NAME
            );
        } catch (error) {
            channel = null;
        }
    }


    if (channel) {

        channel.onmessage = (event) => {

            const message = event.data;

            if (
                !message ||
                typeof message !== "object"
            ) {
                return;
            }

            // Another tab requests login status.
            // Reply only if this tab is authenticated.

            if (
                message.type ===
                "request-access"
            ) {

                if (hasAccess()) {
                    channel.postMessage({
                        type: "access-granted"
                    });
                }

                return;
            }

            // Receive authentication from
            // an already logged-in tab.

            if (
                message.type ===
                "access-granted"
            ) {

                if (grantAccess()) {
                    document.documentElement.style.visibility =
                        "";
                }

            }
        };
    }


    // ==========================================
    // Main access control
    // ==========================================

    // Already logged in:
    // display the page immediately.

    if (hasAccess()) {
        return;
    }


    // Hide the protected page until the
    // authentication check finishes.

    document.documentElement.style.visibility =
        "hidden";


    // Ask other open Dashboard tabs
    // whether the user is already logged in.

    if (channel) {

        channel.postMessage({
            type: "request-access"
        });

        // Allow an existing authenticated tab
        // to respond before redirecting.

        window.setTimeout(() => {

            if (hasAccess()) {

                document.documentElement.style.visibility =
                    "";

            } else {

                redirectToLogin();

            }

        }, 1000);

    } else {

        // Browser does not support
        // BroadcastChannel.

        redirectToLogin();

    }

})();
