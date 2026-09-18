// STAGE23: Cart state (localStorage per toko/seller, tanpa akun buyer) +
// drawer UI. Dipakai oleh public-page.js (u.html) dan dibaca lagi oleh
// cart-checkout.js. Cart TIDAK lintas-toko (per keputusan Rid) dan TIDAK
// sync lintas device (tanpa akun buyer, localStorage per browser saja).
(function () {
  'use strict';

  const MAX_QTY = 999;
  const listeners = new Set();
  let drawerEl = null;
  let drawerProducts = [];
  let drawerSellerId = null;
  let drawerProfile = null;

  function storageKey(sellerId) {
    return `nb_cart_${sellerId}`;
  }

  function readCart(sellerId) {
    if (!sellerId) return [];
    try {
      const raw = localStorage.getItem(storageKey(sellerId));
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(item => item && item.product_id)
        .map(item => ({ product_id: String(item.product_id), quantity: Math.max(1, Math.min(MAX_QTY, Number(item.quantity || 1))) }));
    } catch (_) {
      return [];
    }
  }

  function writeCart(sellerId, items) {
    if (!sellerId) return;
    try {
      if (!items.length) {
        localStorage.removeItem(storageKey(sellerId));
      } else {
        localStorage.setItem(storageKey(sellerId), JSON.stringify(items));
      }
    } catch (_) {
      // localStorage penuh/diblokir browser -> diamkan, cart cuma tidak persist.
    }
    notify(sellerId);
  }

  function notify(sellerId) {
    listeners.forEach(fn => {
      try { fn(sellerId); } catch (_) { /* noop */ }
    });
  }

  function count(sellerId) {
    return readCart(sellerId).reduce((sum, item) => sum + item.quantity, 0);
  }

  function add(sellerId, product, qty) {
    if (!sellerId || !product || !product.id) return;
    const items = readCart(sellerId);
    const existing = items.find(item => item.product_id === String(product.id));
    const addQty = Math.max(1, Number(qty || 1));
    if (existing) {
      existing.quantity = Math.min(MAX_QTY, existing.quantity + addQty);
    } else {
      items.push({ product_id: String(product.id), quantity: Math.min(MAX_QTY, addQty) });
    }
    writeCart(sellerId, items);
  }

  function setQty(sellerId, productId, qty) {
    const items = readCart(sellerId);
    const target = items.find(item => item.product_id === String(productId));
    if (!target) return;
    const clean = Math.max(1, Math.min(MAX_QTY, Number(qty || 1)));
    target.quantity = clean;
    writeCart(sellerId, items);
  }

  function remove(sellerId, productId) {
    const items = readCart(sellerId).filter(item => item.product_id !== String(productId));
    writeCart(sellerId, items);
  }

  function clear(sellerId) {
    writeCart(sellerId, []);
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.add(fn);
  }

  function ensureDrawer() {
    if (drawerEl) return drawerEl;
    const wrap = document.createElement('div');
    wrap.id = 'nbCartOverlay';
    wrap.className = 'nb-cart-overlay';
    wrap.innerHTML = `
      <div class="nb-cart-drawer" role="dialog" aria-modal="true" aria-label="Keranjang belanja">
        <div class="nb-cart-drawer-head">
          <h2><i class="bi bi-cart3 me-2"></i>Keranjang</h2>
          <button type="button" class="nb-cart-close" id="nbCartCloseBtn" aria-label="Tutup keranjang"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="nb-cart-items" id="nbCartItems"></div>
        <div class="nb-cart-foot" id="nbCartFoot"></div>
      </div>
    `;
    document.body.appendChild(wrap);
    drawerEl = wrap;

    wrap.addEventListener('click', event => {
      if (event.target === wrap) closeDrawer();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && wrap.classList.contains('is-open')) closeDrawer();
    });
    document.getElementById('nbCartCloseBtn').addEventListener('click', closeDrawer);

    return wrap;
  }

  function money(value) {
    return (window.NB && NB.money) ? NB.money(value) : `Rp${Number(value || 0).toLocaleString('id-ID')}`;
  }

  function escapeHtml(value) {
    return (window.NB && NB.escapeHtml) ? NB.escapeHtml(value) : String(value ?? '');
  }

  function productImage(url) {
    return (window.NB && NB.safeImageUrl) ? NB.safeImageUrl(url || 'assets/img/placeholder-product.svg') : (url || '');
  }

  function renderDrawer() {
    if (!drawerEl || !drawerSellerId) return;
    const items = readCart(drawerSellerId);
    const itemsBox = document.getElementById('nbCartItems');
    const footBox = document.getElementById('nbCartFoot');
    if (!itemsBox || !footBox) return;

    if (!items.length) {
      itemsBox.innerHTML = `<div class="nb-cart-empty"><i class="bi bi-cart-x"></i><p>Keranjang masih kosong.</p></div>`;
      footBox.innerHTML = '';
      return;
    }

    let subtotal = 0;
    itemsBox.innerHTML = items.map(item => {
      const product = drawerProducts.find(p => String(p.id) === item.product_id);
      if (!product) return '';
      const lineTotal = Number(product.price || 0) * item.quantity;
      subtotal += lineTotal;
      return `
        <div class="nb-cart-item" data-cart-item="${escapeHtml(item.product_id)}">
          <img src="${productImage(product.image_url)}" alt="${escapeHtml(product.name)}">
          <div class="nb-cart-item-body">
            <b>${escapeHtml(product.name)}</b>
            <span>${money(product.price)}</span>
            <div class="nb-cart-qty">
              <button type="button" data-cart-dec="${escapeHtml(item.product_id)}" aria-label="Kurangi jumlah">−</button>
              <span>${item.quantity}</span>
              <button type="button" data-cart-inc="${escapeHtml(item.product_id)}" aria-label="Tambah jumlah">+</button>
            </div>
          </div>
          <div class="nb-cart-item-end">
            <strong>${money(lineTotal)}</strong>
            <button type="button" class="nb-cart-remove" data-cart-remove="${escapeHtml(item.product_id)}" aria-label="Hapus dari keranjang"><i class="bi bi-trash3"></i></button>
          </div>
        </div>
      `;
    }).join('');

    footBox.innerHTML = `
      <div class="nb-cart-subtotal"><span>Subtotal produk</span><strong>${money(subtotal)}</strong></div>
      <p class="nb-cart-note">Biaya layanan &amp; cadangan withdrawal dihitung sekali di halaman checkout.</p>
      <button type="button" class="nb-btn nb-btn--commerce w-100" id="nbCartCheckoutBtn"><i class="bi bi-qr-code me-1"></i>Checkout</button>
    `;

    itemsBox.querySelectorAll('[data-cart-inc]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.cartInc;
        const current = readCart(drawerSellerId).find(i => i.product_id === id);
        if (current) setQty(drawerSellerId, id, current.quantity + 1);
        renderDrawer();
      });
    });
    itemsBox.querySelectorAll('[data-cart-dec]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.cartDec;
        const current = readCart(drawerSellerId).find(i => i.product_id === id);
        if (!current) return;
        if (current.quantity <= 1) { remove(drawerSellerId, id); } else { setQty(drawerSellerId, id, current.quantity - 1); }
        renderDrawer();
      });
    });
    itemsBox.querySelectorAll('[data-cart-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        remove(drawerSellerId, btn.dataset.cartRemove);
        renderDrawer();
      });
    });

    const checkoutBtn = document.getElementById('nbCartCheckoutBtn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => {
        const username = drawerProfile?.username || '';
        location.href = `/cart-checkout.html?username=${encodeURIComponent(username)}`;
      });
    }
  }

  let lockedScrollY = 0;

  function lockBodyScroll() {
    lockedScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.classList.add('nb-cart-open-lock');
  }

  function unlockBodyScroll() {
    document.body.classList.remove('nb-cart-open-lock');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    window.scrollTo(0, lockedScrollY);
  }

  function openDrawer(sellerId, profile, products) {
    drawerSellerId = sellerId;
    drawerProfile = profile || null;
    drawerProducts = Array.isArray(products) ? products : [];
    ensureDrawer();
    renderDrawer();
    drawerEl.classList.add('is-open');
    lockBodyScroll();
  }

  function closeDrawer() {
    if (!drawerEl) return;
    drawerEl.classList.remove('is-open');
    unlockBodyScroll();
  }

  onChange(sellerId => {
    if (drawerEl && drawerEl.classList.contains('is-open') && sellerId === drawerSellerId) {
      renderDrawer();
    }
    if (fabEl && sellerId === fabSellerId) refreshFabBadge();
  });

  // STAGE24: tombol cart dipindah jadi floating button (bukan ikut baris
  // ikon sosial/link toko di header) - supaya tidak mengganggu link custom
  // seller & konsisten di semua tema tanpa perlu sentuh markup shell.
  let fabEl = null;
  let fabSellerId = null;
  let fabProfile = null;
  let fabProducts = [];

  function refreshFabBadge() {
    if (!fabEl) return;
    const badge = fabEl.querySelector('.nb-cart-fab-badge');
    const total = count(fabSellerId);
    if (!badge) return;
    badge.textContent = total > 99 ? '99+' : String(total);
    badge.hidden = total < 1;
  }

  function mountFab(sellerId, profile, products) {
    fabSellerId = sellerId;
    fabProfile = profile || null;
    fabProducts = Array.isArray(products) ? products : [];

    if (!fabEl) {
      fabEl = document.createElement('button');
      fabEl.type = 'button';
      fabEl.id = 'nbCartFab';
      fabEl.className = 'nb-cart-fab';
      fabEl.setAttribute('aria-label', 'Keranjang belanja');
      fabEl.innerHTML = `<i class="bi bi-cart3"></i><span class="nb-cart-fab-badge" hidden>0</span>`;
      fabEl.addEventListener('click', () => openDrawer(fabSellerId, fabProfile, fabProducts));
      document.body.appendChild(fabEl);
    }
    refreshFabBadge();
  }

  window.NBCart = {
    add,
    remove,
    setQty,
    clear,
    count,
    getItems: readCart,
    onChange,
    openDrawer,
    closeDrawer,
    mountFab
  };
})();
