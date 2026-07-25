// NiagaBio – Vanilla JS
(function () {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  const mobile = document.getElementById('navMobile');

  // sticky shadow
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // mobile menu
  toggle?.addEventListener('click', () => mobile.classList.toggle('open'));
  mobile?.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => mobile.classList.remove('open'))
  );

  // pricing toggle
  const toggleBox = document.getElementById('priceToggle');
  const fmt = n => n === 0 ? 'Rp0' : 'Rp' + n.toLocaleString('id-ID');
  toggleBox?.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    toggleBox.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.mode;
    document.querySelectorAll('.price .amt').forEach(el => {
      el.textContent = fmt(Number(el.dataset[mode]));
    });
    document.querySelectorAll('.price .per').forEach(el => {
      const card = el.closest('.price-card');
      const free = card.querySelector('.amt').dataset.monthly === '0';
      el.textContent = free ? '/selamanya' : (mode === 'yearly' ? '/bulan (ditagih tahunan)' : '/bulan');
    });
  });

  // year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();

// Scroll reveal — halaman muncul lembut saat di-scroll
(function () {
  const targets = document.querySelectorAll(
    '.section-head, .card, .step, .price-card, .testi, .solution-row, .hero-copy, .hero-art, .compare-table, .faq details, .trust-label'
  );
  if (!targets.length) return;

  targets.forEach((el, i) => {
    el.classList.add('reveal', 'reveal-stagger');
    const group = el.parentElement;
    const siblingIndex = group ? Array.prototype.indexOf.call(group.children, el) : i;
    el.style.setProperty('--reveal-i', Math.min(siblingIndex, 6));
  });

  if (!('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  targets.forEach(el => io.observe(el));
})();

// Floating quick menu (chat bot / daftar / whatsapp)
(function () {
  const wrap = document.getElementById('fabWrap');
  const toggleBtn = document.getElementById('fabToggle');
  const menu = document.getElementById('fabMenu');
  if (!wrap || !toggleBtn || !menu) return;

  const close = () => {
    toggleBtn.classList.remove('open');
    menu.classList.remove('open');
    toggleBtn.setAttribute('aria-expanded', 'false');
  };
  const open = () => {
    toggleBtn.classList.add('open');
    menu.classList.add('open');
    toggleBtn.setAttribute('aria-expanded', 'true');
  };

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleBtn.classList.contains('open') ? close() : open();
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
})();
