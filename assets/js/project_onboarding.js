// assets/js/onboarding.js
document.addEventListener("DOMContentLoaded", () => {
    const checkUI = setInterval(() => {
        const firstCard = document.querySelector('#projects-grid .proj-card');
        const filterBar = document.getElementById('filter-bar');
        const clearBtn = document.getElementById('clear-viewed-btn');

        if (firstCard && filterBar && clearBtn) {
            clearInterval(checkUI);
            startTour(firstCard, filterBar, clearBtn);
        }
    }, 500);
});

function startTour(firstCard, filterBar, clearBtn) {
    if (localStorage.getItem('tour-completed')) return;

    const starIcon = firstCard.querySelector('.fav-star');
    const layoutPill = document.getElementById('layout-pill');
    const sortBar = document.getElementById('sort-bar');

    // Define the full list of steps
    let steps = [
        {popover: {title: 'Welcome!', description: 'Let’s explore your portfolio interface.'}},
        {
            element: firstCard,
            popover: {title: 'Latest Work', description: 'This card showcases your most recent project.'}
        },
        {element: starIcon, popover: {title: 'Favorites', description: 'Click the star to track specific creations.'}},
        {
            element: clearBtn,
            popover: {title: 'View History', description: 'Clear the list of projects marked as viewed.'}
        },
        {
            element: filterBar,
            popover: {title: 'Filter Projects', description: 'Narrow down projects by Category or Tag.'}
        },
        {
            element: sortBar,
            popover: {title: 'Sort Projects', description: 'Organize your library by date, name, or category.'}
        },
        {element: layoutPill, popover: {title: 'Change Layout', description: 'Switch between Grid and Carousel views.'}}
    ];

    // Remove the Star step (index 2) if on mobile (width <= 600px)
    if (window.innerWidth <= 600) {
        steps = steps.filter((_, index) => index !== 2);
    }

    const driverObj = window.driver.js.driver({
        showProgress: true,
        stagePadding: 5,
        stageRadius: 6,
        popoverClass: 'driver-popover',
        allowClose: true,
        steps: steps,
        destroy: () => {
            document.body.classList.remove('driver-active');
        }
    });

    document.body.classList.add('driver-active');
    driverObj.drive();
    localStorage.setItem('tour-completed', 'true');
}