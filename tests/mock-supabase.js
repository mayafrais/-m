// Test-only stand-in for supabase-js: a signed-in family with one baby and a few events.

(function(){
 const now=Date.now();
 const born=new Date(now-200*864e5).toISOString().slice(0,10); // ~6.5 months
 let state={babies:[{id:'b1',name:'מאיה',born}],active:{},sleep:{},milestones:{},allergens:{},prefs:{}};
 let events=[{id:'e1',baby:'b1',type:'feed',t:now-3600e3,data:{side:'L',mins:12},by_user:'u1'},
   {id:'e2',baby:'b1',type:'taste',t:now-86400e3,data:{food:'egg',liked:'yes',style:'mashed',reaction:true,reactionTypes:['rash'],note:'קצת אודם'},by_user:'u1'},
   {id:'e3',baby:'b1',type:'taste',t:now-2*86400e3,data:{food:'sweetpotato',liked:'meh'},by_user:'u2'}];
 let nextId=10;
 const merge=(a,b)=>{const r=Object.assign({},a);for(const k in b){const v=b[k];r[k]=(v&&typeof v==='object'&&!Array.isArray(v)&&r[k]&&typeof r[k]==='object')?merge(r[k],v):v;}return r;};
 function q(table){
  const st={table,filters:[]};
  const api={select(){return api},eq(){return api},order(){return api},limit(){return api},
   maybeSingle(){ return Promise.resolve({data:table==='families'?{state,invite_code:'123456'}:null}); },
   insert(row){ if(table==='feedback'){ (window.__fb=window.__fb||[]).push(row); } if(table==='events'&&window.__failIns){ return Promise.resolve({error:{message:'Failed to fetch'}}); } if(table==='events'){ events.unshift({id:'e'+(nextId++),baby:row.baby,type:row.type,t:row.t,data:row.data,by_user:'u1'}); } return Promise.resolve({error:null}); },
   update(row){ window.__upd=row; const c={eq(){return c},then(r){return Promise.resolve({error:null}).then(r)}}; return c; },
   delete(){ return {eq(_,id){ events=events.filter(e=>e.id!==id); return Promise.resolve({error:null}); }}; },
   then(res){ let data=[]; if(table==='family_members') data=[{family_id:'f1',user_id:'u1',display_name:'אמא'},{family_id:'f1',user_id:'u2',display_name:'אבא'}];
     if(table==='events') data=events; if(table==='meds') data=[]; return Promise.resolve({data,error:null}).then(res); }};
  return api;
 }
 window.supabase={createClient(){ return {
  auth:{getSession:()=>Promise.resolve({data:{session:{user:{id:'u1',email:'test@example.com'}}}}),onAuthStateChange(){},signOut(){}},
  from:q,
  rpc(name,args){ if(name==='patch_family_state'){ state=merge(state,args.p_patch); return Promise.resolve({data:state,error:null}); } return Promise.resolve({data:null,error:null}); },
  channel(){ const c={on(){return c},subscribe(){return c}}; return c; }, removeChannel(){} }; }};
 window.__state=()=>state; window.__events=()=>events;
})();
