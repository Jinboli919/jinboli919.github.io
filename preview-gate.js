(() => {

    const AUTH_KEY =
        "coe-dashboard-preview-access";


    if (
        sessionStorage.getItem(
            AUTH_KEY
        ) ===
        "granted"
    ) {

        return;

    }


    const currentPage =
        window.location.pathname
        +
        window.location.search
        +
        window.location.hash;


    const loginURL =
        "/preview-login.html?next="
        +
        encodeURIComponent(
            currentPage
        );


    window.location.replace(
        loginURL
    );

})();