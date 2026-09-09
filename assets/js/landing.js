/* NiagaBio — landing interactions (vanilla, no dependencies) */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Navbar: shadow on scroll + mobile menu ---------- */
  var nav = document.getElementById("nav");
  var navToggle = document.getElementById("navToggle");
  var navMobile = document.getElementById("navMobile");

  var lastScroll = -1;
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (y > 8 !== lastScroll > 8) nav.classList.toggle("scrolled", y > 8);
    lastScroll = y;
  }
  var ticking = false;
  window.addEventListener(
    "scroll",
    function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        onScroll();
        ticking = false;
      });
    },
    { passive: true }
  );
  onScroll();

  function closeMenu() {
    nav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Buka menu");
  }
  if (navToggle) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navToggle.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
    });
  }
  if (navMobile) {
    navMobile.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeMenu();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeMenu();
      closeFab();
    }
  });

  /* ---------- Reveal on scroll (once) ---------- */
  var revealables = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    revealables.forEach(function (el) {
      el.classList.add("is-in");
    });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    revealables.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ---------- Active section in navbar ---------- */
  var sections = ["home", "kenapa", "features", "pricing", "faq"]
    .map(function (id) {
      return document.getElementById(id);
    })
    .filter(Boolean);
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-links a"));
  if (sections.length && navLinks.length && "IntersectionObserver" in window) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          navLinks.forEach(function (a) {
            a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id);
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach(function (s) {
      spy.observe(s);
    });
  }

  /* ---------- Pricing toggle ---------- */
  var toggle = document.getElementById("priceToggle");
  if (toggle) {
    toggle.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-mode]");
      if (!btn || btn.classList.contains("active")) return;
      var mode = btn.getAttribute("data-mode");

      toggle.querySelectorAll("button").forEach(function (b) {
        var on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });

      document.querySelectorAll(".price").forEach(function (price) {
        var amt = price.querySelector(".amt");
        var per = price.querySelector(".per");
        if (!amt || !amt.dataset[mode]) return;
        price.classList.add("swap");
        setTimeout(function () {
          amt.textContent = amt.dataset[mode];
          if (per && per.dataset[mode]) per.textContent = per.dataset[mode];
          price.classList.remove("swap");
        }, reduce ? 0 : 160);
      });
    });
  }

  /* ---------- Floating quick menu ---------- */
  var fabWrap = document.getElementById("fabWrap");
  var fabToggle = document.getElementById("fabToggle");
  function closeFab() {
    if (!fabWrap) return;
    fabWrap.classList.remove("open");
    fabToggle.setAttribute("aria-expanded", "false");
  }
  if (fabToggle) {
    fabToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = fabWrap.classList.toggle("open");
      fabToggle.setAttribute("aria-expanded", open ? "true" : "false");
      fabToggle.setAttribute("aria-label", open ? "Tutup menu bantuan" : "Buka menu bantuan");
    });
    document.addEventListener("click", function (e) {
      if (fabWrap.classList.contains("open") && !fabWrap.contains(e.target)) closeFab();
    });
  }

  /* ---------- FAQ: one open at a time ---------- */
  var faqItems = document.querySelectorAll(".faq details");
  faqItems.forEach(function (item) {
    item.addEventListener("toggle", function () {
      if (!item.open) return;
      faqItems.forEach(function (other) {
        if (other !== item) other.open = false;
      });
    });
  });

  /* ---------- Year ---------- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
