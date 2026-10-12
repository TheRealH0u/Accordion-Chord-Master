(function () {
    const layout = document.querySelector('.app-layout');
    const toggle = document.querySelector('.sidebar-toggle');
    const icon = toggle ? toggle.querySelector('span') : null;
    const storageKey = 'accordion-chord-master.sidebar-collapsed';

    if (!layout || !toggle || !icon) {
        return;
    }

    const isMobile = window.matchMedia('(max-width: 700px)').matches;

    function setCollapsed(collapsed, save) {
        layout.classList.toggle('sidebar-collapsed', collapsed);
        toggle.setAttribute('aria-expanded', String(!collapsed));
        toggle.setAttribute('title', collapsed ? 'Prikaži sidebar' : 'Skrij sidebar');
        icon.textContent = collapsed ? '▶' : '◀';

        if (save) {
            window.localStorage.setItem(storageKey, collapsed ? 'collapsed' : 'expanded');
        }
    }

    const savedState = window.localStorage.getItem(storageKey);
    setCollapsed(!isMobile && savedState !== 'expanded', false);

    toggle.addEventListener('click', () => {
        setCollapsed(!layout.classList.contains('sidebar-collapsed'), true);
    });
}());
