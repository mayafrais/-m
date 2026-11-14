/* Shared script for the website pages (welcome, faq, privacy, terms, accessibility). */
(function(){
  var SB_URL='https://wdwfpjprdffkbvthtcuy.supabase.co', SB_KEY='sb_publishable_Z_gT_Mjz2-BecNNOVXmY9A_0bCRPD8w';

  // ---- where the visitor came from (first touch). Same key the app reads at signup. ----
  try{
    var q=new URLSearchParams(location.search), clean=function(v){ return String(v||'').toLowerCase().replace(/[^a-z0-9_\-]/g,'').slice(0,40); };
    var v=clean(q.get('src')||q.get('utm_source')), camp=clean(q.get('c')||q.get('utm_campaign'));
    var cur=null; try{ cur=JSON.parse(localStorage.getItem('gp-src')||'null'); }catch(_){}
    var ua=navigator.userAgent||'', r=document.referrer||'';
    if(v){ if(!cur||cur.auto) localStorage.setItem('gp-src',JSON.stringify({src:v,camp:camp||'',auto:false,at:Date.now()})); }
    else if(!cur){
      var g=/Instagram/i.test(ua)?'instagram':/FBAN|FBAV|FB_IAB/i.test(ua)?'facebook':/TikTok|musical_ly/i.test(ua)?'tiktok':
            /instagram/.test(r)?'instagram':/facebook|fb\.com/.test(r)?'facebook':/google\./.test(r)?'google':/whatsapp|wa\.me/.test(r)?'whatsapp':/tiktok/.test(r)?'tiktok':(r&&r.indexOf(location.origin)!==0?'other':'');
      if(g) localStorage.setItem('gp-src',JSON.stringify({src:g,camp:'',auto:true,at:Date.now()}));
    }
    if(v||camp){ ['src','utm_source','c','utm_campaign','utm_medium'].forEach(function(k){ q.delete(k); }); var qs=q.toString(); history.replaceState(null,'',location.pathname+(qs?'?'+qs:'')+location.hash); }
  }catch(_){}

  // ---- mobile menu ----
  var mb=document.getElementById('menu-btn'), mn=document.getElementById('mnav');
  if(mb&&mn){
    mb.addEventListener('click',function(){ var open=mb.getAttribute('aria-expanded')!=='true'; mb.setAttribute('aria-expanded',open); mn.classList.toggle('open',open); if(open){ var a=mn.querySelector('a'); if(a) a.focus(); } });
    mn.addEventListener('click',function(e){ if(e.target.closest('a')){ mb.setAttribute('aria-expanded','false'); mn.classList.remove('open'); } });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&mn.classList.contains('open')){ mb.setAttribute('aria-expanded','false'); mn.classList.remove('open'); mb.focus(); } });
  }

  // ---- reveal on scroll ----
  var els=document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){ var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} }); },{rootMargin:'0px 0px -8% 0px'}); els.forEach(function(e){io.observe(e)}); }
  else els.forEach(function(e){e.classList.add('in')});

  // ---- install tabs ----
  var tabs=[].slice.call(document.querySelectorAll('[role=tab]'));
  function sel(t){ tabs.forEach(function(x){ var on=x===t; x.setAttribute('aria-selected',on); x.tabIndex=on?0:-1; var p=document.getElementById(x.getAttribute('aria-controls')); p.hidden=!on; if(!on){var vv=p.querySelector('video'); if(vv) vv.pause();} }); }
  tabs.forEach(function(t,i){ t.addEventListener('click',function(){sel(t)}); t.addEventListener('keydown',function(e){ if(e.key==='ArrowLeft'||e.key==='ArrowRight'){ var n=tabs[(i+(e.key==='ArrowLeft'?1:-1)+tabs.length)%tabs.length]; sel(n); n.focus(); e.preventDefault(); } }); });
  if(tabs.length>1&&/android/i.test(navigator.userAgent)) sel(tabs[1]);

  function post(body){ return fetch(SB_URL+'/rest/v1/feedback',{method:'POST',headers:{'apikey':SB_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(body)}).then(function(res){ if(!res.ok) throw new Error(res.status); }); }
  function status(el,msg,ok){ el.className='status '+(ok?'ok':'err'); el.textContent=msg; }

  // ---- feedback form (stars) ----
  var stars=document.getElementById('stars');
  function paint(){ if(!stars) return; var val=+((stars.querySelector('input:checked')||{}).value||0); [].forEach.call(stars.querySelectorAll('label'),function(l){ var n=+l.getAttribute('for').slice(1); l.classList.toggle('on',n<=val); }); }
  if(stars) stars.addEventListener('change',paint);
  var f=document.getElementById('fbform');
  if(f){
    var st=document.getElementById('fbstatus'), btn=document.getElementById('fbsend');
    f.addEventListener('submit',function(e){
      e.preventDefault();
      if(f.website.value){ status(st,'תודה! המשוב נשלח.',true); return; }
      var r=f.querySelector('input[name=rating]:checked'), role=f.querySelector('input[name=role]:checked');
      var body={ rating:r?+r.value:null, role:role?role.value:null, liked:f.liked.value.trim()||null, improve:f.improve.value.trim()||null, contact:f.contact.value.trim()||null, source:'landing' };
      if(!body.rating&&!body.liked&&!body.improve){ status(st,'אפשר לבחור דירוג או לכתוב כמה מילים לפני השליחה.',false); f.liked.focus(); return; }
      try{ var last=+localStorage.getItem('gp-fb-at')||0; if(Date.now()-last<20000){ status(st,'המשוב הקודם שלך כבר התקבל. אפשר לשלוח עוד אחד בעוד רגע.',false); return; } }catch(_){}
      btn.disabled=true; btn.textContent='שולחים...';
      post(body).then(function(){ try{ localStorage.setItem('gp-fb-at',String(Date.now())); }catch(_){} f.reset(); paint(); status(st,'תודה רבה! המשוב התקבל, והוא באמת עוזר לנו להשתפר 💗',true); })
        .catch(function(){ status(st,'משהו השתבש בשליחה. בדקו את החיבור לאינטרנט ונסו שוב.',false); })
        .then(function(){ btn.disabled=false; btn.textContent='שליחת משוב'; });
    });
  }

  // ---- contact form (name + email required) ----
  var c=document.getElementById('ctform');
  if(c){
    var cst=document.getElementById('ctstatus'), cbtn=document.getElementById('ctsend');
    function fieldErr(input,msg){ var id=input.id+'-err', old=document.getElementById(id); if(old) old.remove(); input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby');
      if(msg){ var p=document.createElement('p'); p.id=id; p.className='err-msg'; p.textContent=msg; input.insertAdjacentElement('afterend',p); input.setAttribute('aria-invalid','true'); input.setAttribute('aria-describedby',id); } }
    c.addEventListener('submit',function(e){
      e.preventDefault();
      if(c.website2.value){ status(cst,'תודה! ההודעה הגיעה אליי.',true); return; }
      var nm=c.ctname.value.trim(), em=c.ctemail.value.trim(), msg=c.ctmsg.value.trim();
      fieldErr(c.ctname,''); fieldErr(c.ctemail,''); fieldErr(c.ctmsg,''); cst.className=''; cst.textContent='';
      var bad=null;
      if(!nm){ fieldErr(c.ctname,'כתבו את השם שלכם.'); bad=bad||c.ctname; }
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)){ fieldErr(c.ctemail,'בדקו שכתובת המייל נכונה.'); bad=bad||c.ctemail; }
      if(!msg){ fieldErr(c.ctmsg,'כתבו משהו לפני השליחה.'); bad=bad||c.ctmsg; }
      if(bad){ bad.focus(); return; }
      cbtn.disabled=true; cbtn.textContent='שולחת...';
      post({source:'contact',role:nm.slice(0,40),contact:em.slice(0,200),message:msg.slice(0,2000)})
        .then(function(){ c.reset(); status(cst,'תודה! ההודעה הגיעה אליי, ואחזור אלייך למייל.',true); })
        .catch(function(){ status(cst,'ההודעה לא נשלחה. בדקו את החיבור לאינטרנט ונסו שוב.',false); })
        .then(function(){ cbtn.disabled=false; cbtn.textContent='שליחה'; });
    });
  }
})();
