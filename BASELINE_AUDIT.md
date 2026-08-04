
# FASE 0 — BASELINE AUDIT REPORT

## 1. FILE MAP

### Landing (Scope Fase 2)
- index.html (454 baris)
- assets/css/landing.css (277 baris)
- assets/js/landing.js (105 baris)

### Seller Pages (Scope Fase 3-15)
- dashboard.html, profile.html, products.html, orders.html
- links.html, social.html, gallery.html, checkout-settings.html
- themes.html, upgrade.html, notifications.html
- assets/css/main.css (5.148 baris) ← LEGACY, mencampur seller+admin+store+auth
- assets/js/dashboard.js (205), products.js (146), orders.js (294), etc.

### Public Store (Scope Fase 16-19)
- u.html (49 baris, markup minimal, render JS)
- assets/js/public-page.js (574 baris) ← TEMPLATE ENGINE 10 TEMA
- assets/css/main.css ← store style ikut di sini

### Checkout (Scope Fase 20)
- checkout.html (38 baris)
- assets/js/checkout.js (219 baris)

### Admin (Scope Fase 21-25)
- admin.html
- assets/js/admin.js (1.092 baris)

### Auth (Scope Fase 26)
- login.html, register.html, reset-password.html
- assets/js/auth.js (131 baris)

### Supporting (Scope Fase 27)
- maintenance.html, 404.html, privacy.html, terms.html, refund.html, contacts.html

---

## 2. DOM CONTRACT KRITIS

### ID yang dipakai sebagai browser global / getElementById:
landing:  nav, navToggle, navMobile, priceToggle, year, fabWrap, fabMenu, fabToggle
dashboard: sidebarPublicPreview, nextStepCard, nextStepTitle, nextStepDesc, nextStepAction,
           openPublicPageHero, publicUrlText, planName, planDesc, planExpiry, openPublicPage,
           dashboardUpgradeBtn, metricProducts, metricOrders, metricPending, metricRevenue,
           setupProgressText, setupProgressBar, setupProfile, setupProducts, setupLinks, setupCheckout,
           limitProductsText, limitProductsBar, limitLinksText, limitLinksBar, limitSocialText,
           limitSocialBar, limitGalleryText, limitGalleryBar, limitNotice, recentOrders,
           metricLinks, metricSocial, metricGallery
profile:   profileForm, profileName, profileUsername, profileBio, profileWhatsApp,
           profileAvatar, avatarPreview
products:  productFormTitle, productLimitInfo, productForm, productName, productPrice,
           productCategory, productDescription, productImage, productFeatured, resetProduct,
           productCount, productRows
orders:    exportCsvBtn, resetRecapBtn, printBtn, orderOmset, orderTotal, orderPending,
           orderPaid, orderPendingNominal, orderAverage, orderBestProduct, orderSearch,
           statusFilter, dateFilter, resetFilterBtn, orderCancelled, recapRows, filteredCount,
           orderCards, orderRows
links:     linkLimitInfo, linkForm, linkTitle, linkUrl, linkIcon, linkIconOptions, linkActive,
           resetLink, linkRows
social:    socialLimitInfo, socialForm, socialPlatform, socialUrl, resetSocial, socialRows
gallery:   galleryGate, galleryContent, galleryForm, galleryImage, galleryCaption, galleryGrid
checkout:  premiumNotice, checkoutForm, checkoutMode, checkoutWhatsApp, qrisEnabled, qrisName,
           qrisImage, paymentNote, qrisPreview
themes:    themeGrid, openThemePreview
upgrade:   premiumUserNotice, upgradeFreeContent, premiumNote, premiumQrisImage, premiumQrisEmpty,
           upgradeRequestForm, upgradeShopName, upgradeOwnerName, upgradeProof, upgradeNote,
           upgradeSubmitBtn
notif:     refreshNotifications, markAllReadBtn, notificationCount, notificationList
public:    publicRoot, productSearch, productsBox, shareStoreBtn
checkout:  checkoutRoot, orderForm, buyerName, buyerPhone, qty, proof, totalPreview
auth:      loginForm, loginEmail, loginPassword, forgotPasswordToggle, forgotPasswordBox,
           forgotPasswordForm, forgotEmail, registerForm, registerName, registerEmail,
           registerPassword, passwordResetForm, newPassword, confirmPassword
maintenance: maintenanceText
admin:     adminRefreshBtn, adminOverview, adminOverviewPanel, adminSystemBadges, adminUsers,
           adminPremium, adminFree, adminOrders, adminBlocked, adminOmset, adminUsersSection,
           adminUserCountInfo, adminUserSearch, adminPlanFilter, adminStatusFilter, userRows,
           adminReportsSection, adminExportUsersBtn, adminExportRequestsBtn, adminPrintReportBtn,
           platformRevenueValue, platformApprovedRequests, platformPendingRequests,
           platformExpiringSoon, platformLatestPremium, platformLatestRequests,
           adminPremiumRequestsSection, adminRequestCountInfo, adminClearProcessedRequestsBtn,
           adminRequestSearch, adminRequestFilter, requestRows, adminPasswordResetCountInfo,
           adminPasswordResetSearch, adminPasswordResetFilter, passwordResetRows,
           adminSettingsSection, adminSettingsForm, maintenanceMode, allowRegister,
           maintenanceMessage, premiumPrice, adminWhatsApp, adminPremiumQrisUrl,
           adminPremiumQrisFile, adminPremiumNote, adminSaveSettingsBtn, adminResetSettingsBtn,
           adminUserModal, adminUserModalTitle, adminUserModalSubtitle, adminUserModalBody,
           modalPlanBtn, modalBlockBtn, modalDeleteBtn

### data-* hooks event (TIDAK BOLEH HILANG):
data-year, data-sidebar-toggle, data-logout, data-protected, data-auth-show, data-auth-hide,
data-admin-only, data-plan, data-nav, data-hide-when-premium, data-notif-badge,
data-mode, data-monthly, data-yearly, data-user-name, data-default-icon, data-share-product,
data-edit, data-del, data-paid, data-cancel, data-notification-id, data-notification-link,
data-buy, data-share, data-product-card, data-theme, data-premium-price, data-proof-ref,
data-admin-panel, data-admin-view, data-admin-view-target, data-user-detail, data-user-plan,
data-user-block, data-user-delete, data-delete-product, data-order-paid, data-order-cancel,
data-request-approve, data-request-reject, data-request-delete, data-password-reset-send,
data-password-reset-done, data-password-reset-cancel, data-password-reset-delete

---

## 3. POLA AI-SLOP NYATA DI SOURCE

### Landing (index.html + landing.css)
[CRITICAL] Hero gradient mint penuh: background:linear-gradient(135deg,#D1FAE5 0%,#fff 60%)
[CRITICAL] Blur blob: .hero-blob {filter:blur(80px)} 2 buah
[CRITICAL] Marquee logo palsu: "Dipercaya oleh 10,000+ seller" + nama toko fiktif
[CRITICAL] 6 feature card identik dengan icon-badge di kotak warna
[CRITICAL] 3 testimoni palsu (Lina Wijaya, Budi Santoso, Siti Nurhaliza)
[CRITICAL] Card hover naik: .card:hover {transform:translateY(-4px)}
[CRITICAL] Shadow hijau besar: --shadow-elevated:0 20px 50px -15px rgba(16,185,129,.25)
[CRITICAL] Pill/eyebrow berlebihan
[CRITICAL] Comparison section dengan blob + glassmorphism (backdrop-filter:blur)
[CRITICAL] CTA section dengan blob + gradient

### Seller (main.css)
[CRITICAL] Radius global 22px: --nb-radius:22px digunakan hampir di semua komponen
[CRITICAL] Shadow besar: --nb-shadow:0 18px 50px rgba(15,35,28,.10)
[CRITICAL] Gradient tombol: .btn-nb {background:linear-gradient(135deg,var(--nb-green),var(--nb-green-dark))}
[CRITICAL] Navbar glassmorphism: backdrop-filter:blur(18px)
[CRITICAL] Hero radial gradient + circle dekoratif 520px
[CRITICAL] Icon bubble berulang: .icon-bubble {background:var(--nb-green-soft)}
[CRITICAL] Card-nb identik di dashboard: border-radius:22px, shadow, border
[CRITICAL] fw-black (900) berlebihan di heading
[CRITICAL] Metric card dengan icon bubble identik (4 card)

### Public Store (u.html + public-page.js)
[CRITICAL] 10 font eksternal dimuat SEKALIGUS:
  Cormorant Garamond, DM Serif Display, Fredoka, Inter, Playfair Display,
  Plus Jakarta Sans, Poppins, Sora, Space Grotesk
  → Performance killer, CSP risk

### Admin (admin.html)
[CRITICAL] Admin hero marketing: "Kontrol semua user..." seperti landing
[CRITICAL] KPI card dengan icon bubble identik (sama persis dengan seller)
[CRITICAL] Admin terlalu mirip seller dashboard

---

## 4. RISIKO MIGRASI CSS

main.css = 5.148 baris, mencampur:
- Seller shell (sidebar, topbar, card-nb, metric)
- Admin shell (admin-sidebar, admin-metric, admin-hero)
- Public store (phone-mock, mini-avatar, store theme base)
- Auth (auth-shell, auth-card)
- Checkout (checkout-navbar, checkout-wrap)
- Landing helper (hero, pill, icon-bubble — tapi landing punya landing.css sendiri)
- Bootstrap override agresif (form-control, navbar)

RISIKO TINGGI:
1. Jika hapus main.css sekaligus → semua halaman seller/admin/store/checkout/auth rusak
2. Bootstrap override di main.css (form-control radius 14px, focus ring hijau) bisa bentrok dengan V2
3. Class .card-nb, .icon-bubble, .btn-nb, .btn-outline-nb dipakai di banyak halaman
4. Sidebar .sidebar {width:280px; position:fixed} adalah layout foundation

STRATEGI AMAN:
- Buat v2/foundation.css → v2/seller.css → v2/admin.css → v2/store.css → v2/checkout.css → v2/auth.css
- Pada tiap page, load main.css DULU, lalu v2/*.css sebagai override
- Setelah 1 page benar-benar tidak butuh main.css, baru hapus dari page itu
- Jangan hapus main.css global sampai semua page sudah dimigrasi

---

## 5. URUTAN IMPLEMENTASI PALING AMAN

Sesuai master plan, dengan penyesuaian risiko:

Fase 1: Foundation CSS V2 (token, button, form, status, table, empty state)
  → File baru saja, tidak sentuh existing

Fase 2: Landing redesign total
  → Landing punya CSS sendiri (landing.css), scope terisolasi, risiko rendah

Fase 3: Seller Shell prototype (dashboard.html saja)
  → Test shell baru pada 1 halaman, pertahankan main.css sebagai fallback

Fase 4: Propagate shell ke semua seller page
  → Setelah shell dashboard approved, copy ke 10 halaman seller

Fase 5-15: Seller content per halaman
  → Satu per satu, mulai dari dashboard, profile, products, orders, dll.

Fase 16-19: Public store base + themes
  → Isolasi di store.css, jangan sentuh main.css

Fase 20: Checkout publik
  → Isolasi di checkout.css

Fase 21-25: Admin Master
  → Isolasi di admin.css, bedakan visual dari seller

Fase 26: Auth
  → Isolasi di auth.css

Fase 27: Supporting pages
  → Gunakan foundation + auth style

Fase 28: Performance & a11y audit

Fase 29: Final regression & cleanup main.css
  → Hapus main.css dari page yang sudah aman, jangan hapus file-nya

---

## 6. CHECKLIST BASELINE

- [x] Struktur file mapped
- [x] DOM ID contract terdokumentasi
- [x] data-* hooks teridentifikasi
- [x] Pola AI-slop dideteksi
- [x] Risiko migrasi CSS dinilai
- [x] Urutan implementasi ditentukan
- [x] File scope per fase jelas

---

STATUS: BASELINE AUDIT SELESAI
