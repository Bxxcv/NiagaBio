document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
  document.querySelectorAll('[data-sidebar-toggle]').forEach(btn=>btn.addEventListener('click',()=>document.querySelector('.sidebar')?.classList.toggle('show')));
  const logout = document.querySelector('[data-logout]');
  if(logout){ logout.addEventListener('click', async(e)=>{ e.preventDefault(); await NB.signOut(); location.href='login.html'; }); }
  const user = await NB.currentUser();
  if(document.body.dataset.protected === 'true' && !user){ location.href='login.html'; return; }
  document.querySelectorAll('[data-auth-show]').forEach(el => { el.classList.toggle('d-none', !user); });
  document.querySelectorAll('[data-auth-hide]').forEach(el => { el.classList.toggle('d-none', !!user); });
});
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