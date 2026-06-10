document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const intro = document.getElementById('brandIntro');

  // Brand intro dibuat stabil di mobile:
  // - selalu tampil tiap page load, bukan cuma sekali per tab
  // - durasi normal lebih pelan
  // - kalau HP mengaktifkan reduce motion, tampil statis sebentar lalu hilang
  if (intro) {
    intro.classList.remove('intro-done');

    const closeIntro = () => {
      intro.classList.add('intro-done');
    };

    window.setTimeout(closeIntro, prefersReducedMotion ? 900 : 2600);
  }

  // No lazy reveal on landing. Content should feel instant on every device.
  document.querySelectorAll('[data-reveal]').forEach(item => item.classList.add('is-visible'));

  const nav = document.getElementById('nav');
  if (nav && window.bootstrap) {
    const collapse = window.bootstrap.Collapse.getOrCreateInstance(nav, { toggle: false });
    nav.querySelectorAll('a[href]').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 992 && nav.classList.contains('show')) collapse.hide();
      });
    });
  }

  const help = document.getElementById('landingHelp');
  const helpToggle = help?.querySelector('.help-toggle');
  const helpPanel = document.getElementById('helpPanel');

  function setHelpOpen(isOpen) {
    if (!help || !helpToggle || !helpPanel) return;
    help.classList.toggle('is-open', isOpen);
    helpToggle.setAttribute('aria-expanded', String(isOpen));
    helpPanel.setAttribute('aria-hidden', String(!isOpen));
  }

  if (help && helpToggle) {
    helpToggle.addEventListener('click', event => {
      event.stopPropagation();
      setHelpOpen(!help.classList.contains('is-open'));
    });

    helpPanel?.addEventListener('click', event => event.stopPropagation());

    help.querySelectorAll('[data-help-link]').forEach(link => {
      link.addEventListener('click', () => setHelpOpen(false));
    });

    document.addEventListener('click', event => {
      if (!help.classList.contains('is-open')) return;
      if (help.contains(event.target)) return;
      setHelpOpen(false);
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') setHelpOpen(false);
    });
  }
});
