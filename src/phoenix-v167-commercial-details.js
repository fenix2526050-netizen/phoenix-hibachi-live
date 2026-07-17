/* Phoenix Hibachi V167 — requested commercial rules and detail fixes.
   Loaded after V166. Owns avatar crop/position UI, address interaction boundary,
   waitstaff controls, and customer-visible business copy. */
(function phoenixV167CommercialDetails(){
  if(window.__PHX_V167_COMMERCIAL_DETAILS__) return;
  window.__PHX_V167_COMMERCIAL_DETAILS__=true;
  window.__PHX_V167_AVATAR_EDITOR_ENABLED__=true;
  window.PHX_BUILD_VERSION='V167_COMMERCIAL_LAUNCH';

  /* V166 contains older delegated payment-preview listeners that can receive every
     input/change event before the newer scoped payment tools run. Give those legacy
     listeners safe global helpers so unrelated booking/profile inputs do not throw
     and interrupt the rest of the event pipeline. The active V107 payment panel
     keeps using its own scoped implementation. */
  if(typeof window.paymentFieldOrderId!=='function'){
    window.paymentFieldOrderId=function(el){
      if(!el||!el.dataset) return '';
      return el.dataset.v107PaymentStatus||el.dataset.v107PaymentMethod||el.dataset.v107PaymentReceived||el.dataset.v107Discount||el.dataset.v107FinalTotal||el.dataset.v107TravelFee||el.dataset.v107WaiveTravel||el.dataset.v107Reason||el.dataset.v107CustomerNote||'';
    };
  }
  if(typeof window.updatePaymentPreview!=='function') window.updatePaymentPreview=function(){};

  const OFFICIAL={
    name:'Phoenix Hibachi',phone:'516-518-3325',phoneDigits:'15165183325',
    email:'booking@phoenix-hibachi.com',website:'phoenix-hibachi.com',
    hours:'Daily 9:00 AM–9:00 PM',serviceArea:'NY · NJ · CT · PA'
  };
  const AVATAR_BUCKET='profile-avatars';
  const AVATAR_PREFIX='phoenix_member_avatar_v133_';
  let editor=null,canvas=null,ctx=null,statusEl=null,zoomEl=null;
  let state={file:null,image:null,objectUrl:'',rotation:0,zoom:1,offsetX:0,offsetY:0,mode:'cover',dragging:false,lastX:0,lastY:0};

  const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function currentEmail(){
    try{return String(window.supabaseSession?.user?.email||window.supabaseProfile?.email||JSON.parse(localStorage.getItem('phoenixPortalSessionMetaV1')||'{}')?.email||'local-member').trim().toLowerCase();}catch{return 'local-member';}
  }
  function avatarKey(){return AVATAR_PREFIX+(currentEmail()||'local-member');}
  function avatarInitial(){const t=String(window.supabaseProfile?.full_name||currentEmail()||'Member').trim();return (t.charAt(0)||'M').toUpperCase();}
  function applyAvatar(url){
    const finalUrl=String(url||'');
    document.querySelectorAll('[data-member-avatar-preview-v133],[data-member-profile-avatar-v133]').forEach(target=>{
      target.innerHTML=finalUrl?`<img src="${esc(finalUrl)}" alt="Profile photo">`:`<span>${esc(avatarInitial())}</span>`;
    });
    const header=document.getElementById('accountAvatar');
    if(header){header.classList.toggle('has-photo-v166',!!finalUrl);header.innerHTML=finalUrl?`<img src="${esc(finalUrl)}" alt="Profile photo">`:esc(avatarInitial());}
  }
  function setProfileStatus(message,type='ok'){
    const block=document.querySelector('[data-member-avatar-block-v133]');
    if(!block) return;
    let el=block.querySelector('[data-v1642-avatar-status]');
    if(!el){el=document.createElement('div');el.setAttribute('data-v1642-avatar-status','');block.appendChild(el);}
    el.className=`phx-v1642-avatar-status ${type}`;el.textContent=message||'';
  }
  function setEditorStatus(message){if(statusEl) statusEl.textContent=message||'';}

  function ensureEditor(){
    if(editor) return editor;
    editor=document.createElement('dialog');
    editor.id='phxAvatarEditorV167';editor.className='phx-avatar-editor-v167';
    editor.innerHTML=`<div class="phx-avatar-editor-card-v167">
      <div class="phx-avatar-editor-head-v167"><div><p class="eyebrow">Profile Photo</p><h2>Adjust your avatar.</h2></div><button type="button" class="phx-avatar-editor-close-v167" data-v167-avatar-cancel aria-label="Close">×</button></div>
      <div class="phx-avatar-editor-grid-v167">
        <div class="phx-avatar-canvas-wrap-v167"><canvas id="phxAvatarCanvasV167" width="512" height="512" aria-label="Drag to reposition avatar"></canvas></div>
        <div class="phx-avatar-controls-v167">
          <p class="phx-avatar-editor-help-v167">Drag the photo to reposition it. Any horizontal, vertical, square, or high-resolution image is accepted.</p>
          <fieldset><legend>Display style</legend><label><input type="radio" name="phxAvatarModeV167" value="cover" checked> Fill avatar (best for people)</label><label><input type="radio" name="phxAvatarModeV167" value="contain"> Show full image (best for logos)</label></fieldset>
          <fieldset><legend>Zoom</legend><input id="phxAvatarZoomV167" type="range" min="1" max="3" value="1" step="0.01" aria-label="Avatar zoom"></fieldset>
          <div class="phx-avatar-control-buttons-v167"><button type="button" data-v167-rotate-left>↶ Rotate left</button><button type="button" data-v167-rotate-right>↷ Rotate right</button><button type="button" data-v167-avatar-reset>Reset position</button><button type="button" data-v167-avatar-center>Center image</button></div>
          <div class="phx-avatar-editor-status-v167" id="phxAvatarStatusV167"></div>
        </div>
      </div>
      <div class="phx-avatar-actions-v167"><button type="button" data-v167-avatar-cancel>Cancel</button><button type="button" class="primary" data-v167-avatar-save>Save profile photo</button></div>
    </div>`;
    document.body.appendChild(editor);
    canvas=editor.querySelector('#phxAvatarCanvasV167');ctx=canvas.getContext('2d');
    statusEl=editor.querySelector('#phxAvatarStatusV167');zoomEl=editor.querySelector('#phxAvatarZoomV167');
    editor.addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
    editor.addEventListener('click',e=>{
      if(e.target.closest('[data-v167-avatar-cancel]')){closeEditor();return;}
      if(e.target.closest('[data-v167-rotate-left]')){state.rotation=(state.rotation+270)%360;draw();return;}
      if(e.target.closest('[data-v167-rotate-right]')){state.rotation=(state.rotation+90)%360;draw();return;}
      if(e.target.closest('[data-v167-avatar-reset]')){state.rotation=0;state.zoom=1;state.offsetX=0;state.offsetY=0;if(zoomEl)zoomEl.value='1';draw();return;}
      if(e.target.closest('[data-v167-avatar-center]')){state.offsetX=0;state.offsetY=0;draw();return;}
      if(e.target.closest('[data-v167-avatar-save]')) saveEditedAvatar();
    });
    editor.addEventListener('change',e=>{if(e.target.name==='phxAvatarModeV167'){state.mode=e.target.value;state.offsetX=0;state.offsetY=0;draw();}});
    zoomEl.addEventListener('input',()=>{state.zoom=Number(zoomEl.value||1);draw();});
    const pointer=(e)=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*(canvas.width/r.width),y:(e.clientY-r.top)*(canvas.height/r.height)};};
    canvas.addEventListener('pointerdown',e=>{if(!state.image)return;const p=pointer(e);state.dragging=true;state.lastX=p.x;state.lastY=p.y;canvas.classList.add('dragging');canvas.setPointerCapture?.(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!state.dragging)return;const p=pointer(e);state.offsetX+=p.x-state.lastX;state.offsetY+=p.y-state.lastY;state.lastX=p.x;state.lastY=p.y;draw();});
    const end=e=>{state.dragging=false;canvas.classList.remove('dragging');try{canvas.releasePointerCapture?.(e.pointerId);}catch{}};
    canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
    return editor;
  }
  function closeEditor(){if(state.objectUrl){URL.revokeObjectURL(state.objectUrl);state.objectUrl='';}try{editor?.close();}catch{editor?.removeAttribute('open');}state.file=null;state.image=null;}
  function openEditor(file){
    if(!file||!file.type?.startsWith('image/')){setProfileStatus('Please choose an image file.','error');return;}
    ensureEditor();
    if(state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state={file,image:new Image(),objectUrl:URL.createObjectURL(file),rotation:0,zoom:1,offsetX:0,offsetY:0,mode:'cover',dragging:false,lastX:0,lastY:0};
    state.image.onload=()=>{zoomEl.value='1';editor.querySelector('input[name="phxAvatarModeV167"][value="cover"]').checked=true;setEditorStatus('Drag to position, then save.');draw();try{editor.showModal();}catch{editor.setAttribute('open','');}};
    state.image.onerror=()=>{setProfileStatus('Could not read this image. Please try another file.','error');closeEditor();};
    state.image.src=state.objectUrl;
  }
  function geometry(){
    const C=canvas.width,w=state.image?.naturalWidth||1,h=state.image?.naturalHeight||1,swap=state.rotation%180!==0;
    const rw=swap?h:w,rh=swap?w:h;
    const base=state.mode==='contain'?Math.min(C/rw,C/rh):Math.max(C/rw,C/rh);
    return{C,w,h,scale:base*state.zoom};
  }
  function draw(){
    if(!ctx||!state.image)return;const {C,w,h,scale}=geometry();ctx.clearRect(0,0,C,C);
    ctx.save();ctx.beginPath();ctx.arc(C/2,C/2,C/2-1,0,Math.PI*2);ctx.clip();
    if(state.mode==='contain'){ctx.fillStyle='rgba(255,255,255,0)';ctx.fillRect(0,0,C,C);}
    ctx.translate(C/2+state.offsetX,C/2+state.offsetY);ctx.rotate(state.rotation*Math.PI/180);ctx.scale(scale,scale);ctx.drawImage(state.image,-w/2,-h/2,w,h);ctx.restore();
    ctx.save();ctx.strokeStyle='rgba(255,215,121,.85)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(C/2,C/2,C/2-3,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  function canvasBlob(){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not create avatar image.')),'image/webp',.9));}
  function canvasDataUrl(){try{return canvas.toDataURL('image/webp',.9);}catch{return canvas.toDataURL('image/png');}}
  function extension(file){return(String(file?.name||'image').split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';}
  async function saveEditedAvatar(){
    const saveBtn=editor?.querySelector('[data-v167-avatar-save]');if(saveBtn)saveBtn.disabled=true;
    try{
      setEditorStatus('Saving your adjusted profile photo…');setProfileStatus('Saving adjusted profile photo…','warn');
      const blob=await canvasBlob();const localUrl=canvasDataUrl();
      let finalUrl=localUrl;
      const client=typeof window.initSupabaseClient==='function'?window.initSupabaseClient():null;
      const session=window.supabaseSession||(await client?.auth?.getSession?.().catch(()=>({data:null})))?.data?.session||null;
      const user=session?.user||null;
      if(client&&user?.id){
        const stamp=Date.now();
        const originalPath=`${user.id}/original-${stamp}.${extension(state.file)}`;
        const avatarPath=`${user.id}/avatar-${stamp}.webp`;
        const originalResult=await client.storage.from(AVATAR_BUCKET).upload(originalPath,state.file,{cacheControl:'3600',upsert:true,contentType:state.file.type});
        if(originalResult?.error) console.warn('Original avatar backup upload warning:',originalResult.error);
        const upload=await client.storage.from(AVATAR_BUCKET).upload(avatarPath,blob,{cacheControl:'3600',upsert:true,contentType:'image/webp'});
        if(upload?.error) throw upload.error;
        finalUrl=client.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath)?.data?.publicUrl||localUrl;
        const profileUpdate=await client.from('profiles').update({avatar_url:finalUrl,updated_at:new Date().toISOString()}).eq('id',user.id);
        if(profileUpdate?.error) throw profileUpdate.error;
        window.supabaseProfile={...(window.supabaseProfile||{}),avatar_url:finalUrl};
      }
      try{localStorage.setItem(avatarKey(),finalUrl);}catch{}
      applyAvatar(finalUrl);setProfileStatus('Profile photo saved. You can upload any shape and adjust it again anytime.','ok');
      setEditorStatus('Saved.');setTimeout(closeEditor,180);
    }catch(error){console.error(error);setEditorStatus(error?.message||'Could not save photo.');setProfileStatus(error?.message||'Could not save this profile photo.','error');}
    finally{if(saveBtn)saveBtn.disabled=false;document.querySelectorAll('[data-member-avatar-input-v133]').forEach(i=>i.value='');}
  }

  function initAvatar(){
    document.addEventListener('change',e=>{const input=e.target?.closest?.('[data-member-avatar-input-v133]');if(!input)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();const file=input.files?.[0];if(file)openEditor(file);},true);
    document.addEventListener('click',e=>{
      const remove=e.target?.closest?.('[data-member-avatar-remove-v133]');if(!remove)return;
      setTimeout(()=>{const url=window.supabaseProfile?.avatar_url||'';if(!url)applyAvatar('');},180);
    });
  }

  function initAddressBoundary(){
    const box=document.getElementById('addressSuggestBox');const input=document.getElementById('eventAddressInput');
    document.addEventListener('pointerdown',e=>{
      if(e.target.closest?.('[data-address-display-only]')){e.stopPropagation();box?.classList.remove('open');}
      else if(box?.classList.contains('open')&&!e.target.closest?.('#eventAddressInput,#addressSuggestBox')) box.classList.remove('open');
    },true);
    document.addEventListener('click',e=>{if(e.target.closest?.('[data-address-display-only]')){e.preventDefault();box?.classList.remove('open');}},true);
    input?.setAttribute('aria-controls','addressSuggestBox');input?.setAttribute('aria-autocomplete','list');
  }

  function initStaffing(){
    const check=document.getElementById('waitstaffRequested'),count=document.getElementById('waitstaffCount');
    const sync=()=>{if(!count)return;count.disabled=!check?.checked;if(!check?.checked)count.value='1';try{window.updateSummary?.();}catch{}};
    check?.addEventListener('change',sync);count?.addEventListener('input',()=>{count.value=String(Math.max(1,Math.min(10,Number(count.value||1))));try{window.updateSummary?.();}catch{}});sync();
  }

  function updateOfficialDom(){
    document.querySelectorAll('a[href^="mailto:"]').forEach(a=>{if(/phoenix-hibachi|phoenixhibachi/i.test(a.href))a.href=`mailto:${OFFICIAL.email}`;});
    const email=document.getElementById('contactEmailText');if(email)email.textContent=OFFICIAL.email;
    const card=document.getElementById('contactEmailCard');if(card)card.href=`mailto:${OFFICIAL.email}`;
  }
  function boot(){initAvatar();initAddressBoundary();initStaffing();updateOfficialDom();applyAvatar((()=>{try{return window.supabaseProfile?.avatar_url||localStorage.getItem(avatarKey())||'';}catch{return '';}})());}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
