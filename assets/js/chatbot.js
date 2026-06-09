document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const messages = document.getElementById('chatMessages');
  const suggestButtons = document.querySelectorAll('[data-chat-suggest]');

  const responses = [
    {
      keys: ['niagabio', 'apa itu', 'website ini', 'fungsi'],
      answer: 'NiagaBio adalah platform link bio dan katalog produk untuk membantu seller menampilkan profil toko, produk, link sosial, checkout QRIS manual, dan rekap pesanan dalam satu halaman yang mudah dibagikan.',
      quick: ['cara daftar akun', 'fitur premium', 'qris manual']
    },
    {
      keys: ['daftar', 'registrasi', 'mulai', 'akun', 'buat akun'],
      answer: 'Untuk mulai menggunakan NiagaBio, klik tombol Daftar, buat akun dengan email dan password, lalu lengkapi profil toko dari dashboard. Setelah itu Anda dapat menambahkan produk, link sosial, dan membagikan link toko publik Anda.',
      quick: ['kelola produk', 'template toko', 'harga premium']
    },
    {
      keys: ['Hallo', 'hi', 'halo', 'kamu siapa?', 'siapa kamu?',],
      answer: 'Hallo👋 Perkenalkan saya Assisten Bot Niaga Bio, Siap melayani anda dengan sepenuh hati😊, Ada yang bisa saya bantu untuk anda?.'
},
    {
      keys: ['login', 'masuk', 'password'],
      answer: 'Untuk masuk ke akun, gunakan halaman Login dengan email dan password yang sudah terdaftar. Jika terjadi kendala, pastikan email benar, koneksi stabil, dan akun tidak sedang dibatasi oleh admin platform.'
    },
    {
      keys: ['premium', 'harga', 'bayar premium', 'upgrade', 'paket'],
      answer: 'HARGA PREMIUM: Rp 80.000 Premium membuka fitur tambahan seperti template premium, kapasitas produk lebih besar, galeri, checkout QRIS manual, rekap penjualan, ekspor CSV, dan tampilan toko yang lebih profesional. Proses upgrade dilakukan melalui permintaan upgrade dan konfirmasi admin.'
    },
    {
      keys: ['free', 'gratis', 'limit', 'batas'],
      answer: 'Paket gratis tetap dapat digunakan untuk membuat halaman toko sederhana. Beberapa fitur lanjutan seperti template premium, kapasitas produk besar, dan fitur penjualan tertentu tersedia di paket Premium.'
    },
    {
      keys: ['qris', 'checkout', 'bukti bayar', 'manual', 'pembayaran'],
      answer: 'QRIS di NiagaBio saat ini menggunakan sistem manual. Pembeli membuat pesanan, melakukan pembayaran ke QRIS seller, mengunggah bukti pembayaran, lalu seller memeriksa dan menandai pesanan sebagai selesai dari dashboard.'
    },
    {
      keys: ['produk', 'katalog', 'upload produk', 'stok', 'kategori', 'barang'],
      answer: 'Seller dapat menambahkan produk lengkap dengan gambar, nama, harga, kategori, status stok, deskripsi, dan tombol checkout. Produk tersebut akan tampil di halaman publik toko Anda.'
    },
    {
      keys: ['template', 'tema', 'desain', 'tampilan', 'landing'],
      answer: 'NiagaBio menyediakan pilihan template toko agar halaman publik terlihat lebih rapi. Paket gratis mendapatkan tema dasar, sedangkan Premium mendapatkan pilihan template yang lebih banyak dan terlihat lebih profesional.'
    },
    {
      keys: ['pesanan', 'order', 'rekap', 'omset', 'csv', 'penjualan'],
      answer: 'Pesanan dari pembeli masuk ke dashboard seller. Seller dapat melihat status pending, selesai, batal, total omset, produk terjual, dan mengunduh rekap data jika fitur tersebut tersedia.'
    },
    {
      keys: ['admin', 'whatsapp', 'kontak', 'bantuan', 'cs'],
      answer: 'Untuk bantuan langsung, silakan gunakan tombol Chat Admin di bawah halaman ini. Admin akan membantu pertanyaan yang tidak dapat dijawab otomatis oleh NiagaBot.'
    },
    {
      keys: ['payment gateway', 'duitku', 'midtrans', 'xendit', 'otomatis', 'webhook', 'gateway'],
      answer: 'Untuk Payment gateway, Kami akan segera melakukan update tentang itu.'
    },
    {
      keys: ['saldo', 'withdraw', 'pencairan', 'rekening', 'seller'],
      answer: 'Fitur saldo seller dan withdraw sebaiknya dibuat bertahap. Versi aman pertama adalah saldo dan request withdraw manual. Setelah proses bisnis stabil, baru dapat dipertimbangkan payout otomatis melalui layanan disbursement.'
    },
    {
      keys: ['aman', 'security', 'keamanan', 'rls', 'supabase', 'database'],
      answer: 'NiagaBio menggunakan Supabase dengan aturan keamanan database. Data sensitif seperti role, plan, status, dan masa aktif premium tidak boleh diubah langsung dari frontend biasa. Akses admin harus dikontrol dari database dan policy yang aman.'
    },
    {
      keys: ['google', 'seo', 'search console', 'sitemap', 'index'],
      answer: 'Untuk SEO, pastikan sitemap.xml dan robots.txt dapat dibuka, properti Search Console sudah terverifikasi, lalu gunakan Inspeksi URL untuk meminta pengindeksan halaman utama. Proses muncul di Google bisa membutuhkan waktu.'
    }
  ];

  const fallback = 'Maaf, saya belum menemukan jawaban yang paling sesuai. Silakan gunakan kata kunci seperti daftar, Premium, QRIS, produk, template, pesanan, keamanan, atau payment gateway. Jika membutuhkan bantuan cepat, Anda dapat menekan tombol Chat Admin.';

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function createBubble(text, type = 'bot') {
    const bubble = document.createElement('article');
    bubble.className = type === 'user' ? 'nb-user-bubble' : 'nb-bot-bubble';

    if (type === 'bot') {
      const name = document.createElement('div');
      name.className = 'bubble-name';
      name.textContent = 'NiagaBot';
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      bubble.append(name, paragraph);
    } else {
      bubble.textContent = text;
    }

    return bubble;
  }

  function scrollToBottom() {
    if (!messages) return;
    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });
  }

  function addBubble(text, type = 'bot') {
    if (!messages) return null;
    const bubble = createBubble(text, type);
    messages.appendChild(bubble);
    scrollToBottom();
    return bubble;
  }

  function addTyping() {
    if (!messages) return null;
    const typing = document.createElement('article');
    typing.className = 'nb-bot-bubble nb-typing-bubble';
    typing.innerHTML = '<div class="bubble-name">NiagaBot</div><div class="typing-dots" aria-label="NiagaBot sedang mengetik"><span></span><span></span><span></span></div>';
    messages.appendChild(typing);
    scrollToBottom();
    return typing;
  }

  function addQuickReplies(items = []) {
    if (!messages || !items.length) return;
    const row = document.createElement('div');
    row.className = 'chatbot-inline-actions';
    items.slice(0, 3).forEach(label => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => ask(label));
      row.appendChild(button);
    });
    messages.appendChild(row);
    scrollToBottom();
  }

  function getResponse(question) {
    const q = normalize(question);
    const match = responses.find(item => item.keys.some(key => q.includes(normalize(key))));
    return match || { answer: fallback, quick: ['cara daftar akun', 'harga premium', 'chat admin'] };
  }

  function ask(question) {
    const clean = String(question || '').trim();
    if (!clean) return;

    addBubble(clean, 'user');
    if (input) input.value = '';

    const typing = addTyping();
    const response = getResponse(clean);

    window.setTimeout(() => {
      typing?.remove();
      addBubble(response.answer, 'bot');
      addQuickReplies(response.quick || []);
    }, 260);
  }

  form?.addEventListener('submit', event => {
    event.preventDefault();
    ask(input?.value || '');
  });

  suggestButtons.forEach(button => {
    button.addEventListener('click', () => ask(button.getAttribute('data-chat-suggest')));
  });

  // Ensure the chat area is scrollable after browser UI/keyboard resize on mobile.
  window.addEventListener('resize', scrollToBottom, { passive: true });
  scrollToBottom();
});
