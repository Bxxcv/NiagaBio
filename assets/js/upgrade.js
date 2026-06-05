document.addEventListener('DOMContentLoaded',async()=>{
  setActiveSide('upgrade');
  const user=await NB.requireAuth(); if(!user)return;
  let profile=await NB.getProfile(user.id);
  adminQris.src = NB.cfg.PLATFORM_QRIS_IMAGE || 'assets/img/admin-qris.svg';
  upgradeWhatsapp.value = profile?.whatsapp_number || '';
  if(NB.isPremium(profile)) premiumAlready.classList.remove('d-none');
  async function renderHistory(){ const reqs=await NB.list('upgrade_requests',user.id); upgradeHistory.innerHTML=reqs.map(r=>`<tr><td>${new Date(r.created_at).toLocaleString('id-ID')}</td><td>${r.proof_image_url?`<a href="${NB.escapeHtml(r.proof_image_url)}" target="_blank"><img src="${NB.escapeHtml(r.proof_image_url)}" class="proof-img"></a>`:'-'}</td><td><span class="badge ${r.status==='approved'?'text-bg-success':r.status==='rejected'?'text-bg-secondary':'text-bg-warning'}">${NB.escapeHtml(r.status||'pending')}</span></td><td>${NB.escapeHtml(r.note||'-')}</td></tr>`).join('')||`<tr><td colspan="4" class="text-center text-muted">Belum ada request.</td></tr>`; }
  upgradeForm.addEventListener('submit',async(e)=>{ e.preventDefault(); const btn=upgradeForm.querySelector('button[type="submit"]'); btn.disabled=true; btn.innerHTML='<span class="spinner-border spinner-border-sm me-2"></span>Mengirim...'; try{ let proof=''; if(upgradeProof.files[0]) proof=await NB.uploadFile(upgradeProof.files[0],'upgrade-proofs'); await NB.save('upgrade_requests',{id:NB.uid('upr'),user_id:user.id,email:profile.email,display_name:profile.display_name,username:profile.username,whatsapp_number:upgradeWhatsapp.value.trim(),amount:Number(NB.cfg.PREMIUM_PRICE||80000),status:'pending',proof_image_url:proof,note:upgradeNote.value.trim(),created_at:NB.now(),reviewed_at:null}); await NB.upsertProfile({...profile,whatsapp_number:upgradeWhatsapp.value.trim()}); nbToast('Request upgrade terkirim ke admin. Tunggu approval ya.'); upgradeForm.reset(); upgradeWhatsapp.value=profile.whatsapp_number||''; renderHistory(); }catch(err){ nbToast(err.message||'Gagal mengirim request','danger'); }finally{ btn.disabled=false; btn.textContent='Kirim Request Upgrade'; } });
  renderHistory();
});
