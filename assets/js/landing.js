document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const intro = document.getElementById('brandIntro');
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');

  if (intro) {
    const closeIntro = () => {
      intro.classList.add('intro-done');
      window.setTimeout(() => intro.remove(), 340);
    };

    window.setTimeout(closeIntro, prefersReducedMotion ? 180 : 950);
  }

  function setMenu(open) {
    if (!navToggle || !navMenu) return;
    navToggle.classList.toggle('is-open', open);
    navMenu.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      setMenu(!navMenu.classList.contains('is-open'));
    });

    navMenu.querySelectorAll('a[href]').forEach(link => {
      link.addEventListener('click', () => setMenu(false));
    });

    document.addEventListener('click', event => {
      if (!navMenu.classList.contains('is-open')) return;
      if (navMenu.contains(event.target) || navToggle.contains(event.target)) return;
      setMenu(false);
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') setMenu(false);
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth >= 992) setMenu(false);
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

  const revealItems = document.querySelectorAll('[data-reveal]');

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach(item => item.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.14,
      rootMargin: '0px 0px -40px 0px'
    });

    revealItems.forEach(item => observer.observe(item));
  }

  document.querySelectorAll('.faq-item button[aria-controls]').forEach(button => {
    button.addEventListener('click', () => {
      const item = button.closest('.faq-item');
      const answer = document.getElementById(button.getAttribute('aria-controls'));
      if (!item || !answer) return;

      const willOpen = button.getAttribute('aria-expanded') !== 'true';
      item.classList.toggle('is-open', willOpen);
      button.setAttribute('aria-expanded', String(willOpen));
      answer.hidden = !willOpen;
    });
  });
});
