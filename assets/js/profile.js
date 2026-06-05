document.addEventListener('DOMContentLoaded', async()=>{
  setActiveSide('profile');
  const user = await NB.requireAuth(); if(!user) return;
  let profile = await NB.getProfile(user.id);
  if(!profile){ profile = await NB.upsertProfile({user_id:user.id,email:user.email,username:NB.slugify(user.email.split('@')[0]),display_name:user.email.split('@')[0],plan:'free',role:user.email===NB.cfg.ADMIN_EMAIL?'admin':'user',status:'active',theme_name:'service'}); }
  profileName.value=profile.display_name||''; profileUsername.value=profile.username||''; profileBio.value=profile.bio||''; profileWhatsApp.value=profile.whatsapp_number||''; avatarPreview.src=profile.avatar_url||'assets/img/logo.jpg';
  profileForm.addEventListener('submit', async(e)=>{ e.preventDefault(); const btn=profileForm.querySelector('button[type="submit"]'); btn.disabled=true; try{ let avatar=profile.avatar_url||''; if(profileAvatar.files[0]) avatar = await NB.uploadFile(profileAvatar.files[0],'avatars'); const updated={...profile,user_id:user.id,display_name:profileName.value.trim(),username:NB.slugify(profileUsername.value),bio:profileBio.value.trim(),whatsapp_number:profileWhatsApp.value.trim(),avatar_url:avatar}; await NB.upsertProfile(updated); nbToast('Profil berhasil disimpan.'); }catch(err){ nbToast(err.message||'Gagal simpan profil','danger'); }finally{ btn.disabled=false; } });
  profileAvatar.addEventListener('change',()=>{ if(profileAvatar.files[0]) avatarPreview.src=URL.createObjectURL(profileAvatar.files[0]); });
});