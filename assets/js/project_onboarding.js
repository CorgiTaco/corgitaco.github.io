// assets/js/project_onboarding.js
document.addEventListener("DOMContentLoaded", () => {
    // Wait for a brief moment to ensure all elements are rendered
    setTimeout(() => {
        const driverObj = window.driver.js.driver({
            showProgress: true,
            progressText: 'Step {{current}} of {{total}}',
            stagePadding: 5,
            stageRadius: 6, // Matches your card border-radius
            popoverClass: 'driver-popover',
            steps: [
                {
                    element: '#projects-grid',
                    popover: { title: 'Projects', description: 'Here you will find my projects.' }
                }
            ]
        });

        // Only start if it's the first time the user visits
        if (!localStorage.getItem('project-tour-completed')) {
            driverObj.drive();
            localStorage.setItem('project-tour-completed', 'true');
        }
    }, 1000); // 1-second delay
});