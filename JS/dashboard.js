document.addEventListener(
    "DOMContentLoaded",
    () => {

        const dashboardCards =
            document.querySelectorAll(
                ".dashboard-card"
            );


        dashboardCards.forEach(
            card => {

                card.addEventListener(
                    "focus",
                    () => {

                        card.classList.add(
                            "keyboard-focus"
                        );

                    }
                );


                card.addEventListener(
                    "blur",
                    () => {

                        card.classList.remove(
                            "keyboard-focus"
                        );

                    }
                );

            }
        );

    }
);