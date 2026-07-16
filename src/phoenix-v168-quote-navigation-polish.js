/* Phoenix Hibachi V168 — navigation behavior only. Travel calculation lives in script.js
   so the selected address, order summary, and saved travelFee share one source of truth. */
(function phoenixV168LaunchPolish(){
  'use strict';
  window.PHX_BUILD_VERSION='V168_QUOTE_NAVIGATION_POLISH';
  function boot(){
    const mobileNav=document.getElementById('mobileNav');
    mobileNav?.addEventListener('click',event=>{
      const link=event.target.closest('a[href^="#"]');
      if(!link)return;
      mobileNav.querySelectorAll('details[open]').forEach(group=>group.removeAttribute('open'));
    });
    const stateInput=document.getElementById('eventStateInput');
    stateInput?.addEventListener('change',()=>{
      const lat=document.getElementById('eventAddressLat')?.value;
      const lon=document.getElementById('eventAddressLon')?.value;
      const address=document.getElementById('eventAddressInput')?.value||'';
      if(lat&&lon&&address&&typeof window.updateTravelEstimateFromCoords==='function') window.updateTravelEstimateFromCoords(lat,lon,address);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
