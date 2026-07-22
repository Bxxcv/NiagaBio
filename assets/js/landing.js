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
