document.addEventListener('DOMContentLoaded', () => {
  const items = document.querySelectorAll('[data-reveal]');

  if (!('IntersectionObserver' in window)) {
    items.forEach(item => item.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -44px 0px' });

    items.forEach(item => observer.observe(item));
  }

  const nav = document.getElementById('nav');
  if (nav && window.bootstrap) {
    const collapse = window.bootstrap.Collapse.getOrCreateInstance(nav, { toggle: false });
    nav.querySelectorAll('a[href]').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 992 && nav.classList.contains('show')) collapse.hide();
      });
    });
  }
});
