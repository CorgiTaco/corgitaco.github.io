fetch('../assets/hire/support.json')
    .then(r => r.json())
    .then(data => {
        const container = document.getElementById('support-container');

        data.sections.forEach(section => {
            const sec = document.createElement('section');
            sec.className = 'support-section';

            const title = document.createElement('h2');
            title.className = 'support-section-title';
            title.innerHTML = `<i class="fa ${section.icon}"></i> ${section.title}`;
            sec.appendChild(title);

            const grid = document.createElement('div');
            grid.className = 'support-grid';

            section.cards.forEach(card => {
                const a = document.createElement('a');
                a.className = 'support-card';
                a.href = card.url;
                a.target = '_blank';
                a.rel = 'noopener';

                let iconEl;
                if (card.svgPath) {
                    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svg.setAttribute('class', 'support-card-icon');
                    svg.setAttribute('viewBox', card.svgViewBox);
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('fill', card.color || 'currentColor');
                    path.setAttribute('d', card.svgPath);
                    svg.appendChild(path);
                    iconEl = svg;
                } else if (card.fa) {
                    const i = document.createElement('i');
                    i.className = `fa ${card.fa} support-card-icon`;
                    if (card.color) i.style.color = card.color;
                    iconEl = i;
                } else if (card.favicon) {
                    const img = document.createElement('img');
                    img.className = 'support-card-icon';
                    img.src = card.favicon;
                    img.alt = card.name;
                    iconEl = img;
                }

                const name = document.createElement('span');
                name.className = 'support-card-name';
                name.textContent = card.name;

                a.appendChild(iconEl);
                a.appendChild(name);
                grid.appendChild(a);
            });

            sec.appendChild(grid);
            container.appendChild(sec);
        });
    });
