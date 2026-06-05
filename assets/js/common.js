document.addEventListener('DOMContentLoaded', async () => {
  document.body.insertAdjacentHTML('afterbegin','<div id="pageLoader" class="page-loader"><div><img src="assets/img/logo.jpg" alt="NiagaBio"><span>Memuat NiagaBio...</span></div></div>');
  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
  document.querySelectorAll('[data-sidebar-toggle]').forEach(btn=>btn.addEventListener('click',()=>document.querySelector('.sidebar')?.classList.toggle('show')));
  document.addEventListener('click',(e)=>{ if(window.innerWidth<992 && !e.target.closest('.sidebar') && !e.target.closest('[data-sidebar-toggle]')) document.querySelector('.sidebar')?.classList.remove('show'); });
  const logout = document.querySelector('[data-logout]');
  if(logout){ logout.addEventListener('click', async(e)=>{ e.preventDefault(); await NB.signOut(); location.href=NB.route('login'); }); }
  let user = await NB.currentUser();
  let profile = user ? await NB.getProfile(user.id) : null;
  if(document.body.dataset.protected === 'true' && !user){ location.href=NB.route('login'); return; }
  const path = location.pathname.replace(/\.html$/,'').replace(/\/$/,'') || '/';
  const allowedMaintenance = ['/login', '/admin', '/maintenance'];
  try{
    const maintenance = await NB.getSetting('maintenance');
    const isAdmin = profile?.role === 'admin';
    if(maintenance?.enabled && !isAdmin && !allowedMaintenance.includes(path)){
      location.href = NB.route('maintenance'); return;
    }
  }catch(err){ console.warn('maintenance check skipped', err); }
  if(profile && ['blocked','deleted'].includes(profile.status) && path !== '/login'){
    await NB.signOut();
    document.body.innerHTML=`<main class="container py-5"><div class="auth-card text-center mx-auto" style="max-width:520px"><img src="assets/img/logo.jpg" class="nb-logo mb-3"><h1 class="h3 fw-black">Akun tidak aktif</h1><p class="text-muted">Akun kamu sedang diblokir atau sudah dihapus. Hubungi admin NiagaBio.</p><a class="btn btn-nb" href="/login">Kembali Login</a></div></main>`; return;
  }
  document.querySelectorAll('[data-auth-show]').forEach(el => { el.classList.toggle('d-none', !user); });
  document.querySelectorAll('[data-auth-hide]').forEach(el => { el.classList.toggle('d-none', !!user); });
  if(profile){
    document.querySelectorAll('[data-plan]').forEach(el=>{ el.textContent = NB.isPremium(profile) ? 'Premium' : 'Free'; el.className='badge-soft'; });
    document.querySelectorAll('[data-preview-link]').forEach(el=>{ el.href=NB.publicUrl(profile.username); });
  }
  const obs = 'IntersectionObserver' in window ? new IntersectionObserver((entries)=>{ entries.forEach(entry=>{ if(entry.isIntersecting){ entry.target.classList.add('show'); obs.unobserve(entry.target); } }); },{threshold:.12}) : null;
  document.querySelectorAll('.reveal, .card-nb, .feature-card, .price-card').forEach(el=>{ el.classList.add('reveal'); obs ? obs.observe(el) : el.classList.add('show'); });
});
window.addEventListener('load',()=>{ setTimeout(()=>{ document.body.classList.add('loaded'); document.getElementById('pageLoader')?.remove(); },250); });
function nbToast(message, type='success'){
  let wrap = document.querySelector('.toast-container');
  if(!wrap){ wrap=document.createElement('div'); wrap.className='toast-container position-fixed bottom-0 end-0 p-3'; document.body.appendChild(wrap); }
  const id='toast_'+Date.now();
  const cls = type==='danger'?'text-bg-danger':type==='warning'?'text-bg-warning':'text-bg-success';
  wrap.insertAdjacentHTML('beforeend', `<div id="${id}" class="toast ${cls}" role="alert"><div class="d-flex"><div class="toast-body fw-semibold">${NB.escapeHtml(message)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>`);
  const el=document.getElementById(id); const toast = window.bootstrap ? new bootstrap.Toast(el,{delay:3500}) : null; toast ? toast.show() : alert(message);
  el.addEventListener('hidden.bs.toast',()=>el.remove());
}
function setActiveSide(key){ document.querySelectorAll('.side-link').forEach(a=>a.classList.toggle('active', a.dataset.nav===key)); }
function loadingHtml(text='Memuat data...'){ return `<div class="empty-state"><div class="spinner-border text-success mb-3"></div><p class="mb-0">${text}</p></div>`; }
