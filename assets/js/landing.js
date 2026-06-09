document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const intro = document.getElementById('brandIntro');

  // Keep the brand intro light. It must never block the landing page for long.
  if (intro) {
    let hasSeenIntro = false;
    try {
      hasSeenIntro = sessionStorage.getItem('niagabio_intro_seen') === '1';
    } catch (error) {
      hasSeenIntro = false;
    }

    if (prefersReducedMotion || hasSeenIntro) {
      intro.classList.add('intro-done');
    } else {
      window.setTimeout(() => {
        intro.classList.add('intro-done');
        try {
          sessionStorage.setItem('niagabio_intro_seen', '1');
        } catch (error) {
          // Ignore storage errors.
        }
      }, 1150);
    }
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
