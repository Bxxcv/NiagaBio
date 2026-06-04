(function(){
  const cfg = window.NIAGABIO_CONFIG || {};
  const urlReady = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR_');
  const keyReady = cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes('YOUR_');
  const canSupabase = !!(window.supabase && urlReady && keyReady && cfg.DEMO_MODE !== true);
  const sb = canSupabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const LS = {
    users:'nb_users', session:'nb_session', profiles:'nb_profiles', products:'nb_products', links:'nb_links', socials:'nb_socials', galleries:'nb_galleries', checkout:'nb_checkout_settings', orders:'nb_orders'
  };
  const limits = { free:{products:5, links:5, socials:3, gallery:0, themes:['service','minimal']}, premium:{products:500, links:100, socials:20, gallery:50, themes:['service','minimal','fashion','gadget','food','beauty','dark','luxury','neon','portfolio']} };
  const themes = [
    {id:'service',name:'Niaga Clean',premium:false,desc:'Hijau clean untuk toko umum'},
    {id:'minimal',name:'Minimal White',premium:false,desc:'Putih simpel dan profesional'},
    {id:'fashion',name:'Fashion Pink',premium:true,desc:'Cocok untuk fashion dan apparel'},
    {id:'gadget',name:'Gadget Blue',premium:true,desc:'Cocok untuk elektronik dan aksesoris'},
    {id:'food',name:'Food Orange',premium:true,desc:'Cocok untuk makanan dan minuman'},
    {id:'beauty',name:'Beauty Pop',premium:true,desc:'Cocok untuk skincare dan beauty'},
    {id:'dark',name:'Dark Store',premium:true,desc:'Tema gelap modern'},
    {id:'luxury',name:'Luxury Gold',premium:true,desc:'Premium dan elegan'},
    {id:'neon',name:'Neon Fresh',premium:true,desc:'Modern untuk kreator muda'},
    {id:'portfolio',name:'Portfolio Violet',premium:true,desc:'Cocok untuk jasa dan karya'}
  ];
  function read(key, fallback){ try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch(e){return fallback} }
  function write(key, val){ localStorage.setItem(key, JSON.stringify(val)); return val }
  function uid(prefix='id'){ return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8) }
  function slugify(v){ return String(v||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,32) }
  function now(){ return new Date().toISOString() }
  function money(v){ return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0)) }
  function escapeHtml(str){ return String(str??'').replace(/[&<>'"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m])) }
  function seed(){
    if(localStorage.getItem('nb_seeded_v1')) return;
    const adminId='user_admin';
    const sellerId='user_demo';
    write(LS.users,[
      {id:adminId,email:cfg.ADMIN_EMAIL||'unrageunrage@gmail.com',password:'admin123',created_at:now()},
      {id:sellerId,email:'demo@niagabio.local',password:'demo123',created_at:now()}
    ]);
    write(LS.profiles,[
      {id:'profile_admin',user_id:adminId,email:cfg.ADMIN_EMAIL||'unrageunrage@gmail.com',username:'admin',display_name:'Admin NiagaBio',bio:'Admin utama platform.',avatar_url:'assets/img/logo.jpg',whatsapp_number:'6281234567890',plan:'premium',role:'admin',status:'active',plan_end_date:'2099-12-31T00:00:00Z',theme_name:'service',created_at:now()},
      {id:'profile_demo',user_id:sellerId,email:'demo@niagabio.local',username:'demo',display_name:'Niaga Store',bio:'Katalog produk pilihan dengan checkout WhatsApp dan QRIS manual.',avatar_url:'assets/img/logo.jpg',whatsapp_number:'6281234567890',plan:'premium',role:'user',status:'active',plan_end_date:'2099-12-31T00:00:00Z',theme_name:'service',created_at:now()}
    ]);
    write(LS.products,[
      {id:'prd_1',user_id:sellerId,name:'Hoodie Basic',price:120000,description:'Hoodie nyaman untuk harian.',image_url:'assets/img/placeholder-product.svg',category:'Fashion',is_active:true,is_featured:true,sort_order:1,created_at:now()},
      {id:'prd_2',user_id:sellerId,name:'Kaos Oversize',price:85000,description:'Kaos bahan adem dan cutting oversize.',image_url:'assets/img/placeholder-product.svg',category:'Fashion',is_active:true,is_featured:true,sort_order:2,created_at:now()},
      {id:'prd_3',user_id:sellerId,name:'Paket Stiker UMKM',price:45000,description:'Stiker custom untuk packaging.',image_url:'assets/img/placeholder-product.svg',category:'Bisnis',is_active:true,is_featured:false,sort_order:3,created_at:now()}
    ]);
    write(LS.links,[
      {id:'lnk_1',user_id:sellerId,title:'Katalog Lengkap',url:'https://example.com',icon:'bi-bag',is_active:true,sort_order:1,click_count:0,created_at:now()},
      {id:'lnk_2',user_id:sellerId,title:'Lokasi Toko',url:'https://maps.google.com',icon:'bi-geo-alt',is_active:true,sort_order:2,click_count:0,created_at:now()}
    ]);
    write(LS.socials,[
      {id:'soc_1',user_id:sellerId,platform:'instagram',url:'https://instagram.com/',sort_order:1,created_at:now()},
      {id:'soc_2',user_id:sellerId,platform:'whatsapp',url:'https://wa.me/6281234567890',sort_order:2,created_at:now()},
      {id:'soc_3',user_id:sellerId,platform:'tiktok',url:'https://tiktok.com/',sort_order:3,created_at:now()}
    ]);
    write(LS.galleries,[
      {id:'gal_1',user_id:sellerId,image_url:'assets/img/placeholder-product.svg',caption:'Contoh gallery produk',sort_order:1,created_at:now()}
    ]);
    write(LS.checkout,[{id:'chk_1',user_id:sellerId,checkout_mode:'whatsapp',whatsapp_number:'6281234567890',qris_enabled:false,qris_image_url:'',qris_name:'NIAGA STORE',payment_note:'Transfer sesuai nominal lalu upload bukti pembayaran.',created_at:now()}]);
    write(LS.orders,[
      {id:'ord_1',seller_id:sellerId,buyer_name:'Rizky',buyer_phone:'628111111111',product_id:'prd_1',product_name:'Hoodie Basic',quantity:1,total_price:120000,payment_method:'whatsapp',payment_status:'paid',proof_image_url:'',created_at:now(),paid_at:now()},
      {id:'ord_2',seller_id:sellerId,buyer_name:'Dina',buyer_phone:'628222222222',product_id:'prd_2',product_name:'Kaos Oversize',quantity:2,total_price:170000,payment_method:'qris_manual',payment_status:'pending',proof_image_url:'',created_at:now(),paid_at:null}
    ]);
    localStorage.setItem('nb_seeded_v1','1');
  }
  seed();
  async function uploadFile(file, folder='uploads'){
    if(!file) return '';
    if(sb){
      const ext = (file.name.split('.').pop()||'jpg').toLowerCase();
      const path = folder+'/'+uid('file')+'.'+ext;
      const {error} = await sb.storage.from('niagabio').upload(path,file,{upsert:false});
      if(error) throw error;
      const {data} = sb.storage.from('niagabio').getPublicUrl(path);
      return data.publicUrl;
    }
    return await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); });
  }
  async function currentUser(){
    if(sb){ const {data} = await sb.auth.getUser(); return data.user ? {id:data.user.id,email:data.user.email} : null; }
    const id = localStorage.getItem(LS.session); if(!id) return null; return read(LS.users,[]).find(u=>u.id===id) || null;
  }
  async function signUp(email,password,name){
    if(sb){
      const {data,error} = await sb.auth.signUp({email,password,options:{data:{display_name:name}}});
      if(error) throw error;
      const user = data.user;
      if(user){ await upsertProfile({user_id:user.id,email,username:slugify(name||email.split('@')[0]),display_name:name||email.split('@')[0],plan:'free',role:email===(cfg.ADMIN_EMAIL||'')?'admin':'user',status:'active',theme_name:'service'}); }
      return user;
    }
    const users = read(LS.users,[]); if(users.some(u=>u.email===email)) throw new Error('Email sudah terdaftar.');
    const user = {id:uid('user'),email,password,created_at:now()}; users.push(user); write(LS.users,users); localStorage.setItem(LS.session,user.id);
    const profiles = read(LS.profiles,[]); const uname = uniqueUsername(slugify(name||email.split('@')[0])||'user');
    profiles.push({id:uid('profile'),user_id:user.id,email,username:uname,display_name:name||'User NiagaBio',bio:'',avatar_url:'assets/img/logo.jpg',whatsapp_number:'',plan:'free',role:email===(cfg.ADMIN_EMAIL||'')?'admin':'user',status:'active',plan_end_date:null,theme_name:'service',created_at:now()}); write(LS.profiles,profiles);
    return user;
  }
  async function signIn(email,password){
    if(sb){ const {data,error} = await sb.auth.signInWithPassword({email,password}); if(error) throw error; return data.user; }
    const user = read(LS.users,[]).find(u=>u.email===email && u.password===password); if(!user) throw new Error('Email atau password salah. Demo: demo@niagabio.local / demo123'); localStorage.setItem(LS.session,user.id); return user;
  }
  async function signOut(){ if(sb) await sb.auth.signOut(); localStorage.removeItem(LS.session); }
  async function requireAuth(){ const u=await currentUser(); if(!u){ location.href='login.html'; return null; } return u; }
  function uniqueUsername(base){ const used = read(LS.profiles,[]).map(p=>p.username); let val=base||'user', i=1; while(used.includes(val)){ val=base+'-'+i++; } return val; }
  async function getProfile(userId){
    if(sb){ const {data,error} = await sb.from('profiles').select('*').eq('user_id',userId).maybeSingle(); if(error) throw error; return data; }
    return read(LS.profiles,[]).find(p=>p.user_id===userId) || null;
  }
  async function getProfileByUsername(username){
    if(sb){ const {data,error} = await sb.from('profiles').select('*').eq('username',username).eq('status','active').maybeSingle(); if(error) throw error; return data; }
    return read(LS.profiles,[]).find(p=>p.username===username && p.status!=='blocked') || null;
  }
  async function upsertProfile(profile){
    if(sb){ const payload = {...profile}; if(!payload.user_id){ const u=await currentUser(); payload.user_id=u.id; } const {data,error} = await sb.from('profiles').upsert(payload,{onConflict:'user_id'}).select().single(); if(error) throw error; return data; }
    const arr=read(LS.profiles,[]); let idx=arr.findIndex(p=>p.user_id===profile.user_id); if(idx<0) idx=arr.findIndex(p=>p.id===profile.id); if(idx>=0) arr[idx]={...arr[idx],...profile}; else arr.push({...profile,id:profile.id||uid('profile'),created_at:now()}); write(LS.profiles,arr); return arr[idx>=0?idx:arr.length-1];
  }
  async function list(table,userId,field='user_id'){
    if(sb){
      let q = sb.from(table).select('*').eq(field,userId);
      if(['orders','checkout_settings'].includes(table)) q = q.order('created_at',{ascending:false});
      else q = q.order('sort_order',{ascending:true}).order('created_at',{ascending:false});
      const {data,error}=await q; if(error) throw error; return data||[];
    }
    const key = {products:LS.products,custom_links:LS.links,social_links:LS.socials,gallery:LS.galleries,checkout_settings:LS.checkout,orders:LS.orders}[table];
    let rows=read(key,[]).filter(x=>x[field]===userId); rows.sort((a,b)=>(a.sort_order||0)-(b.sort_order||0) || String(b.created_at||'').localeCompare(a.created_at||'')); return rows;
  }
  async function save(table,row){
    if(sb){ const payload={...row}; if(payload.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.id)) delete payload.id; const {data,error}=await sb.from(table).upsert(payload).select().single(); if(error) throw error; return data; }
    const key = {products:LS.products,custom_links:LS.links,social_links:LS.socials,gallery:LS.galleries,checkout_settings:LS.checkout,orders:LS.orders}[table]; const arr=read(key,[]); let idx=arr.findIndex(x=>x.id===row.id); if(idx>=0) arr[idx]={...arr[idx],...row}; else arr.push({...row,id:row.id||uid(table.slice(0,3)),created_at:now()}); write(key,arr); return idx>=0?arr[idx]:arr[arr.length-1];
  }
  async function remove(table,id){
    if(sb){ const {error}=await sb.from(table).delete().eq('id',id); if(error) throw error; return true; }
    const key = {products:LS.products,custom_links:LS.links,social_links:LS.socials,gallery:LS.galleries,checkout_settings:LS.checkout,orders:LS.orders}[table]; write(key,read(key,[]).filter(x=>x.id!==id)); return true;
  }
  async function all(table){
    if(sb){ const {data,error}=await sb.from(table).select('*').order('created_at',{ascending:false}); if(error) throw error; return data||[]; }
    const key = {profiles:LS.profiles,products:LS.products,custom_links:LS.links,social_links:LS.socials,gallery:LS.galleries,checkout_settings:LS.checkout,orders:LS.orders}[table]; return read(key,[]);
  }
  function getLimits(plan){ return limits[plan==='premium'?'premium':'free']; }
  function socialIcon(platform){ return {instagram:'bi-instagram',whatsapp:'bi-whatsapp',tiktok:'bi-tiktok',facebook:'bi-facebook',youtube:'bi-youtube',x:'bi-twitter-x',telegram:'bi-telegram',shopee:'bi-bag-heart',website:'bi-globe2'}[platform] || 'bi-link-45deg'; }
  function isPremium(profile){ return !!profile && profile.plan==='premium' && profile.status !== 'blocked'; }
  function whatsappUrl(phone,text){ let p=String(phone||'').replace(/[^0-9]/g,''); if(p.startsWith('0')) p='62'+p.slice(1); return 'https://wa.me/'+p+'?text='+encodeURIComponent(text||'Halo kak.'); }
  window.NB = {sb, cfg, canSupabase, themes, limits, uid, slugify, money, escapeHtml, uploadFile, currentUser, signUp, signIn, signOut, requireAuth, getProfile, getProfileByUsername, upsertProfile, list, save, remove, all, getLimits, socialIcon, isPremium, whatsappUrl, now};
})();