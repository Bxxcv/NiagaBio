document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.getElementById('navLinks');
  const menuToggle = document.getElementById('menuToggle');
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toastText');
  const helpFloating = document.getElementById('helpFloating');
  const helpFloatingToggle = document.getElementById('helpFloatingToggle');
  const helpFloatingPanel = document.getElementById('helpFloatingPanel');
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let toastTimer;

  function showToast(message) {
    if (!toast || !toastText) return;
    toastText.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
      const icon = menuToggle.querySelector('i');
      if (icon) icon.className = navLinks.classList.contains('mobile-open') ? 'bi bi-x-lg' : 'bi bi-list';
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        const icon = menuToggle.querySelector('i');
        if (icon) icon.className = 'bi bi-list';
      });
    });
  }

  function setHelpFloating(open) {
    if (!helpFloating || !helpFloatingToggle || !helpFloatingPanel) return;
    helpFloating.classList.toggle('is-open', open);
    helpFloatingToggle.setAttribute('aria-expanded', String(open));
    helpFloatingPanel.setAttribute('aria-hidden', String(!open));
  }

  if (helpFloating && helpFloatingToggle) {
    helpFloatingToggle.addEventListener('click', event => {
      event.stopPropagation();
      setHelpFloating(!helpFloating.classList.contains('is-open'));
    });

    helpFloatingPanel?.addEventListener('click', event => event.stopPropagation());

    helpFloatingPanel?.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => setHelpFloating(false));
    });

    document.addEventListener('click', event => {
      if (!helpFloating.classList.contains('is-open')) return;
      if (helpFloating.contains(event.target)) return;
      setHelpFloating(false);
    });
  }

  const sections = [...document.querySelectorAll('header[id], section[id]')];
  const navAnchors = [...document.querySelectorAll('.nav-links a')];
  window.addEventListener('scroll', () => {
    const pos = window.scrollY + 130;
    let current = 'home';
    sections.forEach(section => {
      if (pos >= section.offsetTop) current = section.id;
    });
    navAnchors.forEach(anchor => {
      anchor.classList.toggle('active', anchor.getAttribute('href') === '#' + current);
    });
  }, { passive: true });

  document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', () => {
      const item = button.closest('.faq-item');
      const answer = item?.querySelector('.faq-answer');
      if (!item || !answer) return;
      const isOpen = item.classList.contains('active');

      document.querySelectorAll('.faq-item').forEach(faq => {
        faq.classList.remove('active');
        const panel = faq.querySelector('.faq-answer');
        if (panel) panel.style.maxHeight = null;
      });

      if (!isOpen) {
        item.classList.add('active');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  document.querySelectorAll('.trade-tabs button').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.trade-tabs button').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      showToast(button.dataset.trade === 'catalog' ? 'Mode katalog dipilih' : 'Mode link bio dipilih');
    });
  });

  document.querySelectorAll('[data-toast]').forEach(element => {
    element.addEventListener('click', () => showToast(element.dataset.toast));
  });

  document.querySelectorAll('[data-social-placeholder]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      showToast(link.dataset.socialPlaceholder);
    });
  });

  document.querySelectorAll('.price-card').forEach(card => {
    card.addEventListener('click', event => {
      document.querySelectorAll('.price-card').forEach(item => item.classList.remove('selected'));
      card.classList.add('selected');
      if (!event.target.closest('a')) {
        showToast((card.querySelector('h3')?.textContent || 'Paket') + ' dipilih');
      }
    });
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter') card.click();
    });
  });

  const revealTargets = [
    '.hero-content > div:first-child',
    '.phone-stage',
    '.intro .section-inner',
    '.advantages .section-title',
    '.adv-card',
    '.features .section-inner > div:first-child',
    '.features .section-title',
    '.features .section-sub',
    '.feature',
    '.testimonial-panel',
    '.review',
    '.pricing .section-inner > div:first-child',
    '.pricing .section-title',
    '.pricing .section-sub',
    '.price-card',
    '.faq .section-title',
    '.faq-item',
    '.download-panel',
    'footer .footer-grid > div'
  ];

  const revealItems = [...document.querySelectorAll(revealTargets.join(','))];
  revealItems.forEach((item, index) => {
    item.classList.add('reveal-ready', `reveal-delay-${index % 4}`);
  });

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach(item => item.classList.add('reveal-visible'));
  } else {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('reveal-visible');
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.14,
      rootMargin: '0px 0px -56px 0px'
    });

    revealItems.forEach(item => observer.observe(item));
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      setHelpFloating(false);
      if (navLinks?.classList.contains('mobile-open')) {
        navLinks.classList.remove('mobile-open');
        const icon = menuToggle?.querySelector('i');
        if (icon) icon.className = 'bi bi-list';
      }
    }
  });
});
