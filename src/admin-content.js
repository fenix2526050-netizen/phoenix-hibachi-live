/* Phoenix Hibachi V146: Admin pricing, add-on menu CRUD, social-style rich posts, social link/QR controls, shop, and hero media controls.
   This layer is additive and keeps the stable booking/dashboard core intact. */
(function initPhoenixV140(){
  if (window.__PHX_V140_ADMIN_CONTENT__) return;
  window.__PHX_V140_ADMIN_CONTENT__ = true;

  const esc = (value='') => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const money = (value) => `$${Number(value || 0).toLocaleString(undefined,{maximumFractionDigits:2})}`;
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  const cssEsc = (value) => (window.CSS && CSS.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&'));
  const read = (key, fallback) => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

  const KEYS = {
    recipes: 'phoenixRecipesV140',
    stories: 'phoenixStoriesV140',
    products: 'phoenixShopProductsV140',
    media: 'phoenixHeroMediaV140',
    addons: 'phoenixAddonCatalogV141',
    socialLinks: 'phoenixSocialLinksV146'
  };


  /* V148 Supabase global sync
     - Public visitors read published menu/social/content settings from app_settings.
     - Admin saves write to app_settings, so changes become global after deployment.
     - Image uploads go to the public-images bucket when Admin is logged in. */
  const REMOTE_SETTING_KEYS_V148 = {
    recipes: 'recipes_v140',
    stories: 'stories_v140',
    products: 'shop_products_v140',
    media: 'hero_media_v140',
    addons: 'addon_catalog_v141',
    socialLinks: 'social_links_v146',
    pricing: 'pricing_settings_v140'
  };
  function clientV148(){
    try {
      if (typeof initSupabaseClient === 'function') return initSupabaseClient();
      if (window.phoenixSupabaseClient) return window.phoenixSupabaseClient;
      if (window.supabaseClient) return window.supabaseClient;
    } catch {}
    return null;
  }
  function sessionV148(){
    try { if (typeof supabaseSession !== 'undefined') return supabaseSession; } catch {}
    return window.supabaseSession || null;
  }
  function roleV148(){
    try { if (typeof supabaseProfile !== 'undefined' && supabaseProfile?.role) return String(supabaseProfile.role).toLowerCase(); } catch {}
    try { const meta = JSON.parse(localStorage.getItem('phoenixPortalSessionMetaV1') || 'null'); return String(meta?.role || '').toLowerCase(); } catch {}
    return '';
  }
  function canWriteRemoteV148(){
    const role = roleV148();
    return !!sessionV148() && ['admin','manager','customer service','customer_service','staff'].includes(role);
  }
  async function remoteReadSettingV148(remoteKey){
    const client = clientV148();
    if (!client || !remoteKey) return null;
    try {
      const { data, error } = await client.from('app_settings').select('value').eq('key', remoteKey).maybeSingle();
      if (error) { console.warn('V148 Supabase setting read failed:', remoteKey, error.message || error); return null; }
      return data?.value ?? null;
    } catch (error) {
      console.warn('V148 Supabase setting read threw:', remoteKey, error);
      return null;
    }
  }
  async function remoteSaveSettingV148(remoteKey, value){
    const client = clientV148();
    if (!client || !remoteKey || !canWriteRemoteV148()) return false;
    try {
      const { error } = await client.from('app_settings').upsert({
        key: remoteKey,
        value,
        public_read: true,
        updated_by: sessionV148()?.user?.id || null
      }, { onConflict: 'key' });
      if (error) throw error;
      return true;
    } catch (error) {
      console.warn('V148 Supabase setting save failed:', remoteKey, error.message || error);
      return false;
    }
  }
  function remoteSaveLocalKeyV148(localKey, value){
    const remoteKey = REMOTE_SETTING_KEYS_V148[localKey];
    if (!remoteKey) return;
    remoteSaveSettingV148(remoteKey, value).then(ok => {
      if (ok) document.dispatchEvent(new CustomEvent('phoenix:remote-setting-saved', { detail:{ key:remoteKey } }));
    });
  }
  async function hydrateRemoteContentV148(){
    const pairs = [
      ['pricing', REMOTE_SETTING_KEYS_V148.pricing],
      ['addons', REMOTE_SETTING_KEYS_V148.addons],
      ['recipes', REMOTE_SETTING_KEYS_V148.recipes],
      ['stories', REMOTE_SETTING_KEYS_V148.stories],
      ['products', REMOTE_SETTING_KEYS_V148.products],
      ['media', REMOTE_SETTING_KEYS_V148.media],
      ['socialLinks', REMOTE_SETTING_KEYS_V148.socialLinks]
    ];
    let changed = false;
    for (const [localKey, remoteKey] of pairs) {
      const value = await remoteReadSettingV148(remoteKey);
      if (value == null) continue;
      if (localKey === 'pricing') {
        try { localStorage.setItem('phoenixPricingSettingsV140', JSON.stringify(value)); } catch {}
        try { if (typeof window.PHX_SET_PRICING_V140 === 'function') window.PHX_SET_PRICING_V140(value); } catch {}
      } else if (KEYS[localKey]) {
        write(KEYS[localKey], value);
      }
      changed = true;
    }
    if (changed) {
      try { syncAddonPricingToCore(getAddons()); } catch {}
      try { renderPublicContent(); } catch {}
      try { renderAdminLists(); } catch {}
      try { applyHeroMedia(); } catch {}
      try { applyPricingToDom(); } catch {}
      try { document.dispatchEvent(new CustomEvent('phoenix:pricing-updated')); } catch {}
    }
  }
  async function uploadPublicImageV148(file, folder='admin'){
    const client = clientV148();
    if (!client || !file || !canWriteRemoteV148()) return '';
    const safeName = String(file.name || 'image').toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    const path = `${folder}/${Date.now()}-${safeName}`;
    const { data, error } = await client.storage.from('public-images').upload(path, file, { upsert:false, cacheControl:'3600' });
    if (error) throw error;
    const { data: publicUrl } = client.storage.from('public-images').getPublicUrl(data.path);
    return publicUrl?.publicUrl || '';
  }

  const defaultAddons = [
    {id:'addon-sushi-roll', name:'Sushi Roll Tray', price:85, tag:'Popular', image:'assets/addon-sushi.webp', note:'California roll, spicy tuna, shrimp tempura, vegetable roll. Approx. 6–8 rolls / 48 pcs.', bookingNote:'California, spicy tuna, shrimp tempura, vegetable roll. Approx. 6–8 rolls.', published:true},
    {id:'addon-premium-sushi', name:'Premium Sushi Tray', price:130, tag:'Premium', image:'assets/addon-premium-sushi.webp', note:'Assorted hand-pressed sushi only: tuna, salmon, yellowtail, shrimp, eel, and chef-selected nigiri. No rolls, no sashimi. Approx. 32–40 pcs.', bookingNote:'Assorted hand-pressed sushi only. No rolls, no sashimi. Approx. 32–40 pieces / 4–6 people.', published:true},
    {id:'addon-sashimi-combo', name:'Sushi & Sashimi Combo', price:160, tag:'', image:'assets/addon-sashimi.webp', note:'Assorted sushi plus sashimi. Approx. 4–6 people / 32–40 pieces. Fish depends on availability.', bookingNote:'Assorted sushi plus sashimi. Approx. 4–6 people / 32–40 pieces. Fish depends on availability.', published:true},
    {id:'addon-gyoza', name:'Extra Gyoza Tray', price:45, tag:'', image:'assets/addon-gyoza.webp', note:'Pan-fried dumplings, approx. 24 pcs. Serves 6–8 people. Dipping sauce included.', bookingNote:'Pan-fried dumplings, approx. 24 pcs. Serves 6–8 people. Garlic ponzu available.', published:true},
    {id:'addon-edamame', name:'Extra Edamame Tray', price:35, tag:'', image:'assets/addon-edamame.webp', note:'Steamed edamame tray. Serves approx. 8–10 people. Garlic-style option can be requested.', bookingNote:'Steamed edamame tray. Serves approx. 8–10 people. Garlic-style option available.', published:true},
    {id:'addon-noodle', name:'Noodle / Yakisoba Tray', price:50, tag:'Kids Fav', image:'assets/addon-noodle.webp', note:'Stir-fried noodles with vegetables. Serves approx. 6–8 people as a side.', bookingNote:'Stir-fried noodles with vegetables. Serves approx. 6–8 people as a side.', published:true},
    {id:'addon-kid-soda', name:'Kid Soda', price:0, tag:'Kids', image:'assets/phoenix-logo-transparent.png', note:'Draft item for kid-friendly soda. Edit the price, upload a real picture, then publish when ready.', bookingNote:'Kid soda option. Please write quantity and preferred flavors in party notes.', published:false}
  ];
  const defaultRecipes = [
    {id:'recipe-yum-yum', title:'Yum Yum Sauce for Hibachi Night', category:'Sauce', image:'assets/package-premium.webp', summary:'A creamy, sweet, tangy sauce inspired by backyard hibachi parties.', body:'Mix mayonnaise, ketchup, melted butter, garlic powder, paprika, sugar, and rice vinegar. Rest cold for 30 minutes before serving.', published:true},
    {id:'recipe-teriyaki', title:'Glossy Teriyaki Sauce', category:'Sauce', image:'assets/media-fire-show.webp', summary:'Sweet, savory, glossy teriyaki for chicken, steak, salmon, or fried rice.', body:'Simmer soy sauce, mirin, sugar, garlic, ginger, and a little cornstarch slurry until glossy.', published:true},
    {id:'recipe-steak', title:'Steak Doneness Guide', category:'Technique', image:'assets/package-signature.webp', summary:'Rare, medium rare, medium, and well-done explained in plain English.', body:'Let steak rest before cooking, sear hot, and slice after resting. Guests should tell the chef their doneness preference before the show starts.', published:true}
  ];
  const defaultStories = [
    {id:'story-behind-fire', title:'Behind the Fire', category:'Chef Story', image:'assets/media-knife-rhythm.webp', summary:'The clean two-hour show starts long before the chef arrives.', body:'Knife rhythm, timing, clean prep, packing, and route planning are all part of the private hibachi experience.', published:true},
    {id:'story-prep', title:'Why Prep Work Matters', category:'Operations', image:'assets/visual-hero-live-show.webp', summary:'Every onion volcano depends on quiet prep work.', body:'A smooth party depends on packed sauces, proteins, vegetables, rice, equipment, timing, and rain backup before the chef leaves.', published:true},
    {id:'story-rain', title:'Rain Day Party Planning', category:'Party Tips', image:'assets/occasion-backyard.webp', summary:'A safe covered cooking area keeps the party moving.', body:'Weather changes fast. Customers should prepare a safe covered area or contact Customer Service for route and reschedule review.', published:true}
  ];
  const defaultProducts = [
    {id:'shop-gift-card', title:'Phoenix Hibachi Gift Card', price:100, image:'assets/phoenix-logo-transparent.png', link:'#calendar', status:'Available', summary:'A flexible gift toward a future private hibachi party.', published:true},
    {id:'shop-sauce-kit', title:'Sauce Bottle / Party Kit', price:18, image:'assets/addon-edamame.webp', link:'#shop', status:'Coming soon', summary:'Feature sauces, bottles, or party tools here when your ecommerce link is ready.', published:true},
    {id:'shop-shirt', title:'Phoenix Hibachi Merch', price:25, image:'assets/phoenix-logo-transparent.png', link:'#shop', status:'Coming soon', summary:'T-shirts, hats, aprons, and chef-themed merchandise.', published:true}
  ];
  const defaultMedia = {
    title:'Hibachi Live Show',
    subtitle:'Fire · Food · Performance',
    items:[
      {id:'hero-1', src:'', poster:'assets/hero-live-show-poster.webp', enabled:false},
      {id:'hero-2', src:'', poster:'assets/hero-live-show-poster.webp', enabled:false},
      {id:'hero-3', src:'', poster:'assets/hero-live-show-poster.webp', enabled:false}
    ]
  };

  const defaultSocialLinks = [
    {id:'social-google', platform:'Google', label:'Leave a Google Review', url:'https://g.page/r/CfGCBLKWHZ4WEBM/review?utm_source=gbp&utm_medium=reviews&utm_campaign=qr', qr:'assets/qr-google-review.png', note:'Your review helps more families discover Phoenix Hibachi.', published:true},
    {id:'social-instagram', platform:'Instagram', label:'Follow on Instagram', url:'https://www.instagram.com/phoenixhibachi/', qr:'assets/qr-instagram.png', note:'Party videos, chef performances, and customer memories.', published:true},
    {id:'social-tiktok', platform:'TikTok', label:'Watch us on TikTok', url:'https://www.tiktok.com/@fenix6050', qr:'assets/qr-tiktok.png', note:'Live hibachi shows, onion volcanoes, and chef tricks.', published:true},
    {id:'social-facebook', platform:'Facebook', label:'Follow on Facebook', url:'https://www.facebook.com/profile.php?id=61591914391136', qr:'assets/qr-facebook.png', note:'Promotions, photos, updates, and upcoming events.', published:true},
    {id:'social-yelp', platform:'Yelp', label:'Find us on Yelp', url:'https://www.yelp.com/', qr:'', note:'Add your Yelp page when ready.', published:false},
    {id:'social-youtube', platform:'YouTube', label:'Watch show videos', url:'https://www.youtube.com/', qr:'', note:'Add your YouTube channel when ready.', published:false}
  ];

  function corePriceMap(){
    try { return (typeof window.PHX_GET_PRICING_V140 === 'function' ? window.PHX_GET_PRICING_V140()?.addons : null) || {}; }
    catch { return {}; }
  }
  function normalizeAddon(item = {}, index = 0){
    const prices = corePriceMap();
    const name = String(item.name || item.title || `Add-on ${index + 1}`).trim();
    return {
      id: item.id || uid('addon'),
      name,
      price: Number(prices[name] ?? item.price ?? 0),
      tag: item.tag || '',
      image: item.image || 'assets/phoenix-logo-transparent.png',
      note: item.note || item.summary || item.description || '',
      bookingNote: item.bookingNote || item.booking_note || item.note || item.summary || '',
      published: item.published !== false
    };
  }
  function getRecipes(){ return read(KEYS.recipes, defaultRecipes); }
  function getStories(){ return read(KEYS.stories, defaultStories); }
  function getProducts(){ return read(KEYS.products, defaultProducts); }
  function getAddons(){
    const saved = read(KEYS.addons, null);
    const source = Array.isArray(saved) ? saved : defaultAddons;
    return source.map(normalizeAddon);
  }
  function saveAddons(list){
    const clean = (Array.isArray(list) ? list : []).map(normalizeAddon);
    write(KEYS.addons, clean);
    syncAddonPricingToCore(clean);
    remoteSaveLocalKeyV148('addons', clean);
    return clean;
  }
  function getMedia(){
    const saved = read(KEYS.media, defaultMedia);
    return {...defaultMedia, ...saved, items: [0,1,2].map(i => ({...defaultMedia.items[i], ...(saved.items?.[i] || {})}))};
  }

  function normalizeSocialLink(item = {}, index = 0){
    const platform = String(item.platform || item.title || `Social ${index + 1}`).trim();
    const key = platform.toLowerCase();
    const official = defaultSocialLinks.find(x => String(x.platform).toLowerCase() === key);
    let rawUrl = normalizeUrl(item.url || item.link || '');
    const isPlaceholder = !rawUrl || rawUrl === '#reviews' || rawUrl === 'https://www.instagram.com/' || rawUrl === 'https://www.tiktok.com/' || rawUrl === 'https://www.facebook.com/';
    if (official && isPlaceholder) rawUrl = official.url;
    const rawNote = item.note || item.summary || '';
    const noteLooksPlaceholder = /placeholder|add your official|replace with your real/i.test(rawNote);
    return {
      id: item.id || official?.id || uid('social'),
      platform,
      label: item.label || item.linkLabel || official?.label || platform,
      url: rawUrl || official?.url || '',
      qr: item.qr || item.image || official?.qr || '',
      note: (!rawNote || noteLooksPlaceholder) ? (official?.note || '') : rawNote,
      published: item.published !== false
    };
  }
  function getSocialLinks(){
    const saved = read(KEYS.socialLinks, null);
    const source = Array.isArray(saved) ? saved : defaultSocialLinks;
    return source.map(normalizeSocialLink);
  }
  function saveSocialLinks(list){
    const clean = (Array.isArray(list) ? list : []).map(normalizeSocialLink);
    write(KEYS.socialLinks, clean);
    remoteSaveLocalKeyV148('socialLinks', clean);
    return clean;
  }
  function addonPriceMap(list = getAddons()){
    return Object.fromEntries((list || []).filter(x => x && x.name).map(item => [item.name, Number(item.price || 0)]));
  }
  function syncAddonPricingToCore(list = getAddons()){
    if (typeof window.PHX_GET_PRICING_V140 !== 'function' || typeof window.PHX_SET_PRICING_V140 !== 'function') return;
    const current = window.PHX_GET_PRICING_V140();
    current.addons = addonPriceMap(list);
    window.PHX_SET_PRICING_V140(current);
  }
  function syncCatalogPricesFromCore(priceMap = {}){
    const list = getAddons().map(item => Object.prototype.hasOwnProperty.call(priceMap, item.name) ? {...item, price:Number(priceMap[item.name] || 0)} : item);
    write(KEYS.addons, list);
    return list;
  }
  window.PHX_GET_ADDON_CATALOG_V141 = getAddons;
  window.PHX_SET_ADDON_CATALOG_V141 = saveAddons;

  function normalizeUrl(value = ''){
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(https?:|mailto:|tel:|#)/i.test(raw)) return raw;
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)) return `https://${raw}`;
    return raw;
  }
  function isSafeHref(value = ''){
    return /^(https?:|mailto:|tel:|#)/i.test(String(value || '').trim());
  }
  function isSafeImageSrc(value = ''){
    return /^(https?:|data:image\/|assets\/|\.\/|\/)/i.test(String(value || '').trim());
  }
  function cleanStyle(styleText = ''){
    const allowed = new Set(['font-family','font-size','font-weight','font-style','text-decoration','text-align','color','background-color']);
    return String(styleText || '').split(';').map(rule => rule.trim()).filter(rule => {
      const [name, value] = rule.split(':').map(x => (x || '').trim());
      if (!name || !value || !allowed.has(name.toLowerCase())) return false;
      if (/url\s*\(|expression\s*\(|javascript:/i.test(value)) return false;
      return true;
    }).join('; ');
  }
  function sanitizeRichHtml(html = ''){
    if (!html) return '';
    const template = document.createElement('template');
    template.innerHTML = String(html);
    const allowedTags = new Set(['p','br','div','span','strong','b','em','i','u','s','ul','ol','li','blockquote','h2','h3','h4','a','img','font']);
    const walk = (node) => {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === Node.COMMENT_NODE) { child.remove(); return; }
        if (child.nodeType !== Node.ELEMENT_NODE) return;
        const tag = child.tagName.toLowerCase();
        if (!allowedTags.has(tag)) {
          const frag = document.createDocumentFragment();
          while (child.firstChild) frag.appendChild(child.firstChild);
          child.replaceWith(frag);
          walk(node);
          return;
        }
        Array.from(child.attributes).forEach(attr => {
          const name = attr.name.toLowerCase();
          const value = attr.value || '';
          if (name.startsWith('on')) { child.removeAttribute(attr.name); return; }
          if (tag === 'a' && name === 'href') {
            const safe = normalizeUrl(value);
            if (isSafeHref(safe)) child.setAttribute('href', safe); else child.removeAttribute('href');
            child.setAttribute('target', '_blank');
            child.setAttribute('rel', 'noopener noreferrer');
            return;
          }
          if (tag === 'img' && name === 'src') {
            if (isSafeImageSrc(value)) child.setAttribute('src', value); else child.remove();
            return;
          }
          if (tag === 'img' && ['alt','title'].includes(name)) return;
          if (tag === 'font' && ['face','size','color'].includes(name)) return;
          if (name === 'style') {
            const clean = cleanStyle(value);
            if (clean) child.setAttribute('style', clean); else child.removeAttribute('style');
            return;
          }
          child.removeAttribute(attr.name);
        });
        walk(child);
      });
    };
    walk(template.content);
    return template.innerHTML.trim();
  }
  function plainToRich(text = ''){
    const raw = String(text || '').trim();
    if (!raw) return '';
    if (/<[a-z][\s\S]*>/i.test(raw)) return sanitizeRichHtml(raw);
    return raw.split(/\n{2,}/).map(part => `<p>${esc(part).replace(/\n/g, '<br>')}</p>`).join('');
  }
  function richBody(item = {}){
    return plainToRich(item.bodyHtml || item.body || '');
  }
  function postLinkMarkup(item = {}){
    const link = normalizeUrl(item.link || '');
    if (!link || !isSafeHref(link)) return '';
    const label = item.linkLabel || 'Open link';
    const target = link.startsWith('#') ? '_self' : '_blank';
    return `<a class="outline-btn block v142-post-link" href="${esc(link)}" target="${target}" rel="noopener noreferrer">${esc(label)}</a>`;
  }

  function cardMarkup(item, type){
    const body = type === 'product'
      ? `<p>${esc(item.summary || '')}</p><div class="shop-price-row"><strong>${money(item.price)}</strong><span>${esc(item.status || 'Available')}</span></div><a class="outline-btn block" href="${esc(item.link || '#shop')}" target="${String(item.link||'').startsWith('http')?'_blank':'_self'}" rel="noreferrer">View Product</a>`
      : `<small>${esc(item.category || '')}</small><h3>${esc(item.title)}</h3><p>${esc(item.summary || '')}</p><details><summary>Read more</summary><div class="v140-rich-output">${richBody(item)}</div></details>${postLinkMarkup(item)}`;
    return `<article class="v140-content-card"><img src="${esc(item.image || 'assets/phoenix-logo-transparent.png')}" alt="${esc(item.title || 'Phoenix Hibachi content')}"><div>${type === 'product' ? `<h3>${esc(item.title)}</h3>` : ''}${body}</div></article>`;
  }


  function socialLinkCardMarkup(item){
    const link = normalizeUrl(item.url || '#reviews') || '#reviews';
    const href = isSafeHref(link) ? link : '#reviews';
    const target = href.startsWith('#') ? '_self' : '_blank';
    const key = String(item.platform || '').toLowerCase();
    const marks = {google:'G',instagram:'◎',tiktok:'♪',facebook:'f',youtube:'▶',yelp:'Y'};
    const mark = marks[key] || '↗';
    const qr = String(item.qr || '').trim();
    const qrMarkup = qr ? `<span class="phx-card-qr"><img src="${esc(qr)}" alt="${esc(item.platform)} QR code"></span>` : '';
    return `<a class="social-link-card phx-social-action-card phx-${esc(key)}" href="${esc(href)}" target="${target}" rel="noopener noreferrer"><b class="phx-platform-mark">${esc(mark)}</b><strong>${esc(item.platform)}</strong><span>${esc(item.label || item.platform)}</span><small>${esc(item.note || '')}</small>${qrMarkup}<em>Open ${esc(item.platform)}</em></a>`;
  }
  function renderSocialLinks(){
    const target = document.getElementById('socialLinksGrid');
    if (!target) return;
    const links = getSocialLinks().filter(x => x.published !== false);
    target.innerHTML = links.map(socialLinkCardMarkup).join('') || '<div class="empty-state">Social links coming soon.</div>';
  }

  function renderPublicContent(){
    const recipesGrid = document.getElementById('recipesGrid');
    const storiesGrid = document.getElementById('storiesGrid');
    const productsGrid = document.getElementById('shopProductsGrid');
    if (recipesGrid) recipesGrid.innerHTML = getRecipes().filter(x => x.published !== false).map(x => cardMarkup(x, 'post')).join('') || '<div class="empty-state">Recipes coming soon.</div>';
    if (storiesGrid) storiesGrid.innerHTML = getStories().filter(x => x.published !== false).map(x => cardMarkup(x, 'post')).join('') || '<div class="empty-state">Stories coming soon.</div>';
    if (productsGrid) productsGrid.innerHTML = getProducts().filter(x => x.published !== false).map(x => cardMarkup(x, 'product')).join('') || '<div class="empty-state">Shop products coming soon.</div>';
    renderDynamicAddons();
    renderSocialLinks();
  }

  function pricing(){
    if (typeof window.PHX_GET_PRICING_V140 === 'function') return window.PHX_GET_PRICING_V140();
    return {packages:{Classic:55, Premium:65, Signature:110}, addons:addonPriceMap(defaultAddons), proteinUpcharge:5, moneyRules:{depositRequired:200, minimumBillableGuests:0, minimumFoodOrder:550, chefAdultRate:15, chefKidRate:7.5, chefMinimumPayout:150, firstPartyCoupon:50, birthdayCoupon:50, socialCoupon:50, couponMinimumParty:600, defaultTravelFee:50, travelFeeBase:50, travelFeeIncludedMiles:20, travelFeePerExtraMile:2, njTollFee:30, travelFeeCustomQuoteMiles:100, estimatedFoodCostRate:35, salesTaxRate:8.875}};
  }

  function addonArticleMarkup(item){
    const badge = item.tag ? `<b>${esc(item.tag)}</b>` : '';
    return `<article>${badge}<img class="addon-photo" src="${esc(item.image || 'assets/phoenix-logo-transparent.png')}" alt="${esc(item.name)}"><h3>${esc(item.name)}</h3><p>${esc(item.note || item.bookingNote || '')}</p></article>`;
  }
  function addonChoiceMarkup(item){
    const note = item.bookingNote || item.note || '';
    return `<div class="choice-card addon-choice addon-qty-card" data-addon-card="${esc(item.name)}"><input type="checkbox" name="addons" value="${esc(item.name)}" data-price="${Number(item.price || 0)}" data-unit-price="${Number(item.price || 0)}"><img class="addon-photo" src="${esc(item.image || 'assets/phoenix-logo-transparent.png')}" alt="${esc(item.name)}"><div class="addon-copy"><strong>${esc(item.name)}</strong><em>${esc(note)}</em></div><b class="addon-price">+${money(item.price)} each</b><div class="addon-qty-controls" aria-label="${esc(item.name)} quantity"><button type="button" data-addon-action="minus">−</button><input class="addon-qty-input" type="number" min="0" max="20" value="0" inputmode="numeric"><button type="button" data-addon-action="plus">+</button></div></div>`;
  }
  function renderDynamicAddons(){
    const publicAddons = getAddons().filter(x => x.published !== false);
    const pageGrid = document.querySelector('#addons .addon-grid');
    if (pageGrid) pageGrid.innerHTML = publicAddons.map(addonArticleMarkup).join('') || '<div class="empty-state">Add-ons coming soon.</div>';

    const choiceGrid = document.getElementById('addonChoiceGrid');
    if (choiceGrid) {
      const selected = new Set([...choiceGrid.querySelectorAll('input[name="addons"]:checked')].map(x => x.value));
      const quantities = new Map([...choiceGrid.querySelectorAll('input[name="addons"]')].map(input => [input.value, input.closest('.addon-choice')?.querySelector('.addon-qty-input')?.value || (input.checked ? '1' : '0')]));
      const noChoice = choiceGrid.querySelector('.no-addon-choice');
      choiceGrid.querySelectorAll('.addon-choice:not(.no-addon-choice)').forEach(x => x.remove());
      const html = publicAddons.map(addonChoiceMarkup).join('');
      if (noChoice) noChoice.insertAdjacentHTML('beforebegin', html); else choiceGrid.insertAdjacentHTML('afterbegin', html);
      choiceGrid.querySelectorAll('input[name="addons"]').forEach(input => {
        const qtyInput = input.closest('.addon-choice')?.querySelector('.addon-qty-input');
        const qty = Math.max(0, Number(quantities.get(input.value) || (selected.has(input.value) ? 1 : 0)));
        if (qtyInput) qtyInput.value = String(qty);
        input.checked = qty > 0 || selected.has(input.value);
        input.closest('.addon-choice')?.classList.toggle('selected', input.checked);
      });
    }

    const footerAddons = [...document.querySelectorAll('footer h4')].find(h => h.textContent.trim() === 'Add-ons')?.nextElementSibling;
    if (footerAddons) footerAddons.innerHTML = publicAddons.slice(0, 8).map(x => esc(x.name)).join('<br>');
    bindDynamicAddonChoiceEvents();
  }
  function bindDynamicAddonChoiceEvents(){
    if (document.body?.dataset.v141AddonChoiceBound) return;
    if (document.body) document.body.dataset.v141AddonChoiceBound = '1';
    document.addEventListener('change', event => {
      const input = event.target.closest?.('.addon-choice input');
      if (!input || input.classList.contains('addon-qty-input')) return;
      const noChoice = document.getElementById('noAddonChoice');
      if (input === noChoice && input.checked) {
        document.querySelectorAll('.addon-choice input[name="addons"]').forEach(addonInput => {
          addonInput.checked = false;
          const card = addonInput.closest('.addon-choice');
          const qty = card?.querySelector('.addon-qty-input');
          if (qty) qty.value = '0';
          card?.classList.remove('selected');
        });
      }
      if (input.name === 'addons' && input.checked && noChoice) {
        noChoice.checked = false;
        noChoice.closest('.addon-choice')?.classList.remove('selected');
      }
      input.closest('.addon-choice')?.classList.toggle('selected', input.checked);
      try { if (typeof window.updateAddonsState === 'function') window.updateAddonsState(); } catch {}
      try { if (typeof window.updateSummary === 'function') window.updateSummary(); } catch {}
    }, true);
  }

  function applyPricingToDom(){
    const p = pricing();
    Object.entries(p.packages || {}).forEach(([name, price]) => {
      document.querySelectorAll(`.package-${name.toLowerCase()} .price`).forEach(el => el.innerHTML = `${money(price)} <span>/ person</span>`);
      document.querySelectorAll(`[data-package-card="${cssEsc(name)}"] strong`).forEach(el => el.innerHTML = `${money(price)} <span>/ person</span>`);
    });
    renderDynamicAddons();
    Object.entries(p.addons || {}).forEach(([name, price]) => {
      document.querySelectorAll(`input[name="addons"][value="${cssEsc(name)}"]`).forEach(input => {
        input.dataset.price = String(price);
        const label = input.closest('label');
        const b = label?.querySelector('.addon-price, b:last-child');
        if (b) b.textContent = `+${money(price)} each`;
        input.dataset.unitPrice = String(price);
      });
    });
    document.querySelectorAll('.premium-protein span').forEach(span => span.textContent = `Premium +${money(p.proteinUpcharge || 0)} per portion`);
    const help = document.getElementById('proteinHelpText');
    if (help) help.textContent = `Classic for 10 adult-equivalent meal portions includes 20 protein portions. Premium proteins add ${money(p.proteinUpcharge || 0)} per selected portion.`;
    const footerPackage = [...document.querySelectorAll('footer h4')].find(h => h.textContent.trim() === 'Packages')?.nextElementSibling;
    if (footerPackage) footerPackage.innerHTML = `Classic — ${money(p.packages.Classic)} / person<br>Premium — ${money(p.packages.Premium)} / person<br>Signature — ${money(p.packages.Signature)} / person`;
  }

  function applyHeroMedia(){
    const media = getMedia();
    const video = document.querySelector('.hero-live-video');
    if (!video) return;
    const items = media.items.filter(x => x.enabled !== false && /^https:\/\//i.test(String(x.src || '')));
    if (!items.length) return;
    let index = Number(video.dataset.v140Index || 0);
    if (index >= items.length) index = 0;
    const item = items[index];
    const source = video.querySelector('source') || document.createElement('source');
    source.src = item.src;
    source.type = item.src.endsWith('.webm') ? 'video/webm' : 'video/mp4';
    if (!source.parentNode) video.appendChild(source);
    if (item.poster) video.poster = item.poster;
    const note = document.querySelector('.hero-photo-card .card-note');
    if (note) note.innerHTML = `<strong>${esc(media.title || 'Hibachi Live Show')}</strong><span>${esc(media.subtitle || 'Fire · Food · Performance')}</span>`;
    try { video.load(); video.play?.().catch(()=>{}); } catch {}
    let controls = document.querySelector('.hero-media-controls-v140');
    if (!controls && items.length > 1) {
      controls = document.createElement('div');
      controls.className = 'hero-media-controls-v140';
      document.querySelector('.hero-photo-card')?.appendChild(controls);
    }
    if (controls) controls.innerHTML = items.map((_, i) => `<button type="button" class="${i===index?'active':''}" data-v140-hero-index="${i}" aria-label="Hero video ${i+1}"></button>`).join('');
  }

  document.addEventListener('click', event => {
    const hero = event.target.closest?.('[data-v140-hero-index]');
    if (hero) {
      const video = document.querySelector('.hero-live-video');
      if (video) video.dataset.v140Index = hero.dataset.v140HeroIndex;
      applyHeroMedia();
    }
  });

  function getDashboardRole(){
    const title = document.getElementById('dashboardTitle')?.textContent || '';
    if (/Admin/i.test(title)) return 'Admin';
    if (/Manager/i.test(title)) return 'Manager';
    if (/Customer Service/i.test(title)) return 'Customer Service';
    if (/Chef/i.test(title)) return 'Chef';
    if (/Member/i.test(title)) return 'Member';
    return '';
  }

  function ensureAdminTabs(){
    const tabs = document.querySelector('.dashboard-tabs');
    const pages = document.querySelector('.dashboard-pages');
    if (!tabs || !pages) return;
    const role = getDashboardRole();
    const allowed = /Admin|Manager/i.test(role);
    const tabDefs = [
      ['pricing','Pricing / Menu Settings'],
      ['addons','Add-ons Menu Manager'],
      ['social','Social Links / QR'],
      ['recipes','Recipes Manager'],
      ['stories','Stories Manager'],
      ['shop','Shop Products'],
      ['media','Hero Videos']
    ];
    tabDefs.forEach(([key,label]) => {
      let btn = tabs.querySelector(`[data-v140-admin-tab="${key}"]`);
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.v140AdminTab = key;
        btn.textContent = label;
        tabs.appendChild(btn);
      }
      const shouldHide = !allowed;
      if (btn.hidden !== shouldHide) btn.hidden = shouldHide;
      const wantedDisplay = allowed ? '' : 'none';
      if (btn.style.display !== wantedDisplay) btn.style.display = wantedDisplay;
    });
    let wrap = document.getElementById('v140AdminPages');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'v140AdminPages';
      wrap.className = 'v140-admin-pages';
      pages.appendChild(wrap);
    }
    if (!wrap.dataset.ready) {
      wrap.dataset.ready = '1';
      wrap.innerHTML = `
        <section class="v140-admin-page" data-v140-page="pricing">${pricingPage()}</section>
        <section class="v140-admin-page" data-v140-page="addons">${addonManagerPage()}</section>
        <section class="v140-admin-page" data-v140-page="social">${socialLinksManagerPage()}</section>
        <section class="v140-admin-page" data-v140-page="recipes">${postManagerPage('recipes')}</section>
        <section class="v140-admin-page" data-v140-page="stories">${postManagerPage('stories')}</section>
        <section class="v140-admin-page" data-v140-page="shop">${shopManagerPage()}</section>
        <section class="v140-admin-page" data-v140-page="media">${mediaManagerPage()}</section>`;
      bindAdminForms();
    }
  }

  function showV140Page(key){
    document.querySelectorAll('[data-dashboard-tab]').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('[data-v140-admin-tab]').forEach(x => x.classList.toggle('active', x.dataset.v140AdminTab === key));
    document.querySelectorAll('[data-dashboard-page]').forEach(x => { x.classList.remove('active'); x.hidden = true; });
    document.querySelectorAll('[data-v140-page]').forEach(x => { const show = x.dataset.v140Page === key; x.classList.toggle('active', show); x.hidden = !show; });
  }

  document.addEventListener('click', event => {
    const btn = event.target.closest?.('[data-v140-admin-tab]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    showV140Page(btn.dataset.v140AdminTab);
  }, true);

  document.addEventListener('click', event => {
    const old = event.target.closest?.('[data-dashboard-tab]');
    if (old) {
      document.querySelectorAll('[data-v140-admin-tab]').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('[data-v140-page]').forEach(x => { x.classList.remove('active'); x.hidden = true; });
    }
  }, true);

  function pricingPage(){
    const p = pricing();
    const pkg = p.packages || {}, addons = p.addons || {}, rules = p.moneyRules || {};
    const num = (name, value, label) => `<label>${label}<input type="number" step="0.01" data-price-field="${esc(name)}" value="${esc(value)}"></label>`;
    const travelBase = rules.travelFeeBase ?? rules.defaultTravelFee ?? 50;
    const includedMiles = rules.travelFeeIncludedMiles ?? 20;
    const perExtraMile = rules.travelFeePerExtraMile ?? 2;
    const njTollFee = rules.njTollFee ?? 30;
    const customQuoteMiles = rules.travelFeeCustomQuoteMiles ?? 100;
    return `<div class="v140-admin-panel"><div class="section-row"><div><h3>Pricing / Menu Settings</h3><p class="small-muted">Change prices once. Homepage, booking calculation, invoice, payment panel, and revenue view will read the same pricing source in this browser. Supabase sync can make it global later.</p></div><button type="button" class="outline-btn" data-v140-reset-pricing>Reset defaults</button></div>
      <div class="v140-settings-grid">
        <article><h4>Package prices</h4>${num('packages.Classic', pkg.Classic, 'Classic')}${num('packages.Premium', pkg.Premium, 'Premium')}${num('packages.Signature', pkg.Signature, 'Signature')}${num('moneyRules.minimumFoodOrder', rules.minimumFoodOrder || 550, 'Minimum food order ($)')}</article>
        <article><h4>Add-ons / side orders</h4><p class="small-muted">These food items count toward the minimum food order. For adding/deleting photos and notes, use the Add-ons Menu Manager tab.</p>${Object.entries(addons).map(([k,v]) => num(`addons.${k}`, v, k)).join('')}</article>
        <article><h4>Protein / Deposit / Coupons</h4>${num('proteinUpcharge', p.proteinUpcharge, 'Premium protein upcharge')}${num('moneyRules.depositRequired', rules.depositRequired, 'Deposit required')}${num('moneyRules.firstPartyCoupon', rules.firstPartyCoupon, 'First party coupon')}${num('moneyRules.birthdayCoupon', rules.birthdayCoupon, 'Birthday coupon')}${num('moneyRules.socialCoupon', rules.socialCoupon, 'Social share coupon')}${num('moneyRules.couponMinimumParty', rules.couponMinimumParty, 'Coupon minimum')}</article>
        <article><h4>Travel fee rules</h4><p class="small-muted">Saved here updates address estimates, Booking totals, Admin cards, customer Portal, and Invoice display in this browser immediately. Supabase sync makes the rule global after admin save.</p>${num('moneyRules.travelFeeBase', travelBase, 'Base travel fee ($)')}${num('moneyRules.travelFeeIncludedMiles', includedMiles, 'Miles included in base')}${num('moneyRules.travelFeePerExtraMile', perExtraMile, 'Extra mileage rate ($ / mile)')}${num('moneyRules.njTollFee', njTollFee, 'NJ toll fee ($)')}${num('moneyRules.travelFeeCustomQuoteMiles', customQuoteMiles, 'Custom quote above miles')}</article>
        <article><h4>Chef payout / business rules</h4>${num('moneyRules.chefAdultRate', rules.chefAdultRate, 'Chef adult payout')}${num('moneyRules.chefKidRate', rules.chefKidRate, 'Chef kid payout')}${num('moneyRules.chefMinimumPayout', rules.chefMinimumPayout, 'Chef minimum payout')}${num('moneyRules.defaultTravelFee', rules.defaultTravelFee ?? travelBase, 'Manual travel fee default')}${num('moneyRules.estimatedFoodCostRate', rules.estimatedFoodCostRate || 35, 'Estimated food cost %')}${num('moneyRules.salesTaxRate', rules.salesTaxRate || 8.875, 'Sales tax %')}</article>
      </div><div class="v140-admin-actions"><button type="button" class="gold-btn" data-v140-save-pricing>Save pricing</button><span class="small-muted" id="v140PricingStatus"></span></div></div>`;
  }

  function addonManagerPage(){
    return `<div class="v140-admin-panel"><div class="section-row"><div><h3>Add-ons Menu Manager</h3><p class="small-muted">Add, delete, hide, price, upload image, and write customer-facing notes for booking add-ons. Kid Soda is already prepared as a draft item; edit it and publish when ready.</p></div><button type="button" class="outline-btn" data-v140-new-addon>New Add-on</button></div>
      <div class="v140-editor-grid"><form class="v140-addon-form"><input type="hidden" name="id"><label>Menu name<input name="name" required placeholder="Kid Soda"></label><label>Price<input name="price" type="number" step="0.01" placeholder="0"></label><label>Badge / label<input name="tag" placeholder="Kids / Popular / Premium"></label><label>Image path / URL<input name="image" placeholder="assets/addon-sushi.webp or https://..."></label><label>Upload image from computer<input type="file" accept="image/*" data-v140-image-file="addon"></label><label>Public note<textarea name="note" rows="3" placeholder="Shown on the Add-ons section."></textarea></label><label>Booking note<textarea name="bookingNote" rows="3" placeholder="Shown inside the booking add-on card."></textarea></label><label class="checkline"><input type="checkbox" name="published" checked> Visible on website</label><button type="submit" class="gold-btn">Save add-on</button><span class="small-muted" id="v140AddonStatus"></span></form><div class="v140-list" data-v140-list="addons"></div></div></div>`;
  }

  function socialLinksManagerPage(){
    return `<div class="v140-admin-panel v146-social-manager"><div class="section-row"><div><h3>Social Links / QR Manager</h3><p class="small-muted">Add, edit, delete, hide, and publish official platform links and QR codes. Use this for Google review, Instagram, TikTok, Facebook, YouTube, Yelp, or any booking/social link.</p></div><button type="button" class="outline-btn" data-v146-new-social>New Social Link</button></div>
      <div class="v140-editor-grid"><form class="v146-social-form"><input type="hidden" name="id"><label>Platform name<input name="platform" required placeholder="Google / Instagram / TikTok"></label><label>Button text<input name="label" placeholder="Leave a review / Follow us"></label><label>Platform link URL<input name="url" placeholder="https://..."></label><label>QR image path / URL<input name="qr" placeholder="assets/qr-google.webp or https://..."></label><label>Upload QR image<input type="file" accept="image/*" data-v140-image-file="social-qr" data-v140-image-target="qr"></label><label>Note / instruction<textarea name="note" rows="3" placeholder="Shown under the social link. Example: Scan after your party to leave a review."></textarea></label><label class="checkline"><input type="checkbox" name="published" checked> Visible on website</label><button type="submit" class="gold-btn">Save social link</button><span class="small-muted" id="v146SocialStatus"></span></form><div class="v140-list v146-social-admin-list" data-v140-list="social"></div></div></div>`;
  }

  function postManagerPage(kind){
    const title = kind === 'recipes' ? 'Recipes Manager' : 'Stories Manager';
    const hint = kind === 'recipes'
      ? 'Create recipe-style posts like a social feed: formatted text, photos, links, and a cover image.'
      : 'Create story-style posts like a social feed: formatted text, photos, links, and a cover image.';
    return `<div class="v140-admin-panel v142-social-admin"><div class="section-row"><div><h3>${title}</h3><p class="small-muted">${hint} Images may use assets/xxx.webp, a full image URL, or local upload.</p></div><button type="button" class="outline-btn" data-v140-new-post="${kind}">New Post</button></div>
      <div class="v140-editor-grid v142-social-grid"><form class="v140-post-form v142-social-composer" data-v140-post-form="${kind}"><input type="hidden" name="id"><input type="hidden" name="body" data-v140-rich-hidden>
        <div class="v142-composer-head"><div class="v142-avatar">🔥</div><div><b>Phoenix Hibachi Post</b><span>Write once, publish to the website content feed.</span></div></div>
        <label>Title<input name="title" required placeholder="Post title"></label>
        <div class="v142-two-fields"><label>Category<input name="category" placeholder="Sauce / Party Tips / Chef Story"></label><label>Button text<input name="linkLabel" placeholder="Learn more / Book now"></label></div>
        <label>Cover image path / URL<input name="image" placeholder="assets/package-classic.webp or https://..."></label>
        <label>Upload cover image<input type="file" accept="image/*" data-v140-image-file="post-cover"></label>
        <label>External link / CTA<input name="link" placeholder="https://... or #calendar"></label>
        <label>Short caption / summary<textarea name="summary" rows="2" placeholder="Shown on the card before Read more."></textarea></label>
        <div class="v142-rich-wrap"><div class="v142-rich-label">Post body</div><div class="v142-rich-toolbar">
          <select data-v140-rich-font aria-label="Font family"><option value="">Font</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times</option><option value="Courier New">Courier</option><option value="Verdana">Verdana</option></select>
          <select data-v140-rich-size aria-label="Font size"><option value="">Size</option><option value="2">Small</option><option value="3">Normal</option><option value="4">Large</option><option value="5">XL</option></select>
          <button type="button" data-v140-rich-cmd="bold"><b>B</b></button><button type="button" data-v140-rich-cmd="italic"><i>I</i></button><button type="button" data-v140-rich-cmd="underline"><u>U</u></button><button type="button" data-v140-rich-cmd="insertUnorderedList">• List</button><button type="button" data-v140-rich-block="blockquote">Quote</button><button type="button" data-v140-rich-block="h3">H3</button><button type="button" data-v140-rich-link>Link</button><button type="button" data-v140-rich-image-url>Image URL</button><label class="v142-file-pill">Upload inline image<input type="file" accept="image/*" data-v140-rich-image-file hidden></label><button type="button" data-v140-rich-clear>Clear format</button>
        </div><div class="v142-rich-editor" contenteditable="true" data-v140-rich-editor><p>Write your post here. Add photos, links, tips, specials, or party stories.</p></div></div>
        <label class="checkline"><input type="checkbox" name="published" checked> Published</label><button type="submit" class="gold-btn">Publish / Save</button><span class="small-muted" data-v140-post-status></span></form><div class="v140-list v142-social-feed" data-v140-list="${kind}"></div></div></div>`;
  }

  function shopManagerPage(){
    return `<div class="v140-admin-panel"><div class="section-row"><div><h3>Shop Products</h3><p class="small-muted">Show merchandise, gift cards, sauces, party kits, or ecommerce links. Use external Buy Now links for Shopify/TikTok/Amazon until checkout is connected.</p></div><button type="button" class="outline-btn" data-v140-new-product>New</button></div>
      <div class="v140-editor-grid"><form class="v140-product-form"><input type="hidden" name="id"><label>Name<input name="title" required></label><label>Price<input name="price" type="number" step="0.01"></label><label>Image path / URL<input name="image"></label><label>Buy link<input name="link"></label><label>Status<input name="status" placeholder="Available / Coming soon"></label><label>Summary<textarea name="summary" rows="3"></textarea></label><label class="checkline"><input type="checkbox" name="published" checked> Published</label><button type="submit" class="gold-btn">Save product</button></form><div class="v140-list" data-v140-list="products"></div></div></div>`;
  }

  function mediaManagerPage(){
    const m = getMedia();
    return `<div class="v140-admin-panel"><div class="section-row"><div><h3>Hero Videos</h3><p class="small-muted">Set up to three homepage videos. Keep files compressed for mobile. Recommended: MP4/WebM under 5–12MB each.</p></div></div>
      <form class="v140-media-form"><div class="v140-settings-grid"><article><h4>Overlay text</h4><label>Title<input name="title" value="${esc(m.title)}"></label><label>Subtitle<input name="subtitle" value="${esc(m.subtitle)}"></label></article>${m.items.map((item,i)=>`<article><h4>Video ${i+1}</h4><label>Video src<input name="src${i}" value="${esc(item.src)}"></label><label>Poster<input name="poster${i}" value="${esc(item.poster)}"></label><label class="checkline"><input type="checkbox" name="enabled${i}" ${item.enabled!==false?'checked':''}> Enabled</label></article>`).join('')}</div><button class="gold-btn" type="submit">Save hero videos</button><span class="small-muted" id="v140MediaStatus"></span></form></div>`;
  }

  function collectPricingFromForm(){
    const merged = pricing();
    document.querySelectorAll('[data-price-field]').forEach(input => {
      const path = input.dataset.priceField.split('.');
      let obj = merged;
      while (path.length > 1) {
        const k = path.shift();
        obj[k] = obj[k] || {};
        obj = obj[k];
      }
      obj[path[0]] = Number(input.value || 0);
    });
    return merged;
  }

  function bindAdminForms(){
    renderAdminLists();
    const pages = document.getElementById('v140AdminPages');
    if (!pages || pages.dataset.bound) return;
    pages.dataset.bound = '1';
    pages.addEventListener('click', event => {
      const savePricing = event.target.closest('[data-v140-save-pricing]');
      if (savePricing) {
        const next = collectPricingFromForm();
        if (typeof window.PHX_SET_PRICING_V140 === 'function') window.PHX_SET_PRICING_V140(next);
        syncCatalogPricesFromCore(next.addons || {});
        applyPricingToDom();
        renderAdminLists();
        const status = document.getElementById('v140PricingStatus');
        remoteSaveSettingV148(REMOTE_SETTING_KEYS_V148.pricing, next).then(ok => {
          const status = document.getElementById('v140PricingStatus');
          if (status) status.textContent = ok ? 'Saved to Supabase. Booking totals now update for all visitors.' : 'Saved locally. Login as Admin and check Supabase RLS to make it global.';
        });
      }
      if (event.target.closest('[data-v140-reset-pricing]')) {
        try { localStorage.removeItem('phoenixPricingSettingsV140'); location.reload(); } catch {}
      }
      const richCmd = event.target.closest('[data-v140-rich-cmd]');
      if (richCmd) { event.preventDefault(); applyRichCommand(richCmd.dataset.v140RichCmd); return; }
      const richBlock = event.target.closest('[data-v140-rich-block]');
      if (richBlock) { event.preventDefault(); applyRichBlock(richBlock.dataset.v140RichBlock); return; }
      if (event.target.closest('[data-v140-rich-link]')) { event.preventDefault(); insertRichLink(); return; }
      if (event.target.closest('[data-v140-rich-image-url]')) { event.preventDefault(); insertRichImageUrl(); return; }
      if (event.target.closest('[data-v140-rich-clear]')) { event.preventDefault(); applyRichCommand('removeFormat'); return; }
      const edit = event.target.closest('[data-v140-edit]');
      if (edit) editItem(edit.dataset.v140Edit, edit.dataset.v140Kind);
      const del = event.target.closest('[data-v140-delete]');
      if (del) deleteItem(del.dataset.v140Delete, del.dataset.v140Kind);
      const newPost = event.target.closest('[data-v140-new-post]');
      if (newPost) fillPostForm(newPost.dataset.v140NewPost, {});
      if (event.target.closest('[data-v140-new-product]')) fillProductForm({});
      if (event.target.closest('[data-v140-new-addon]')) fillAddonForm({published:true});
      if (event.target.closest('[data-v146-new-social]')) fillSocialForm({published:true});
    });
    pages.addEventListener('submit', event => {
      const addonForm = event.target.closest('.v140-addon-form');
      if (addonForm) { event.preventDefault(); saveAddonForm(addonForm); }
      const postForm = event.target.closest('[data-v140-post-form]');
      if (postForm) { event.preventDefault(); savePostForm(postForm.dataset.v140PostForm, postForm); }
      const productForm = event.target.closest('.v140-product-form');
      if (productForm) { event.preventDefault(); saveProductForm(productForm); }
      const socialForm = event.target.closest('.v146-social-form');
      if (socialForm) { event.preventDefault(); saveSocialForm(socialForm); }
      const mediaForm = event.target.closest('.v140-media-form');
      if (mediaForm) { event.preventDefault(); saveMediaForm(mediaForm); }
    });
    pages.addEventListener('change', event => {
      const font = event.target.closest('[data-v140-rich-font]');
      if (font && font.value) { applyRichCommand('fontName', font.value); font.value = ''; return; }
      const size = event.target.closest('[data-v140-rich-size]');
      if (size && size.value) { applyRichCommand('fontSize', size.value); size.value = ''; return; }
      const richFile = event.target.closest('[data-v140-rich-image-file]');
      if (richFile) { handleRichImageFile(richFile); return; }
      const file = event.target.closest('[data-v140-image-file]');
      if (file) handleImageFileInput(file);
    });
    pages.addEventListener('input', event => {
      const editor = event.target.closest('[data-v140-rich-editor]');
      if (editor) syncRichEditorToHidden(editor.closest('form'));
    });
  }

  function renderAdminLists(){
    const renderPosts = (kind, items) => {
      const target = document.querySelector(`[data-v140-list="${kind}"]`);
      if (!target) return;
      target.innerHTML = items.map(item => {
        const image = item.image ? `<img class="v142-feed-thumb" src="${esc(item.image)}" alt="${esc(item.title || 'Post image')}">` : '';
        const status = item.published === false ? 'Draft' : 'Published';
        const rich = richBody(item);
        const cta = postLinkMarkup(item);
        return `<article class="v140-list-card v142-feed-card"><div class="v142-feed-top"><div class="v142-avatar">🔥</div><div><b>${esc(item.title)}</b><small>${esc(item.category || 'Post')} · ${status}</small></div></div>${image}<p>${esc(item.summary || '')}</p>${rich ? `<div class="v142-feed-body v140-rich-output">${rich}</div>` : ''}${cta}<div class="v142-feed-actions"><button type="button" data-v140-edit="${esc(item.id)}" data-v140-kind="${kind}">Edit</button><button type="button" data-v140-delete="${esc(item.id)}" data-v140-kind="${kind}">Delete</button></div></article>`;
      }).join('') || '<div class="empty-state">No items yet.</div>';
    };
    renderPosts('recipes', getRecipes());
    renderPosts('stories', getStories());
    const addonsTarget = document.querySelector('[data-v140-list="addons"]');
    if (addonsTarget) addonsTarget.innerHTML = getAddons().map(item => `<article class="v140-list-card"><b>${esc(item.name)}</b><small>${money(item.price)} · ${esc(item.tag || 'No badge')} · ${item.published === false ? 'Hidden / Draft' : 'Visible'}</small><p>${esc(item.note || item.bookingNote || '')}</p><div><button type="button" data-v140-edit="${esc(item.id)}" data-v140-kind="addons">Edit</button><button type="button" data-v140-delete="${esc(item.id)}" data-v140-kind="addons">Delete</button></div></article>`).join('') || '<div class="empty-state">No add-ons yet.</div>';
    const socialTarget = document.querySelector('[data-v140-list="social"]');
    if (socialTarget) socialTarget.innerHTML = getSocialLinks().map(item => {
      const status = item.published === false ? 'Hidden / Draft' : 'Visible';
      const qr = item.qr && isSafeImageSrc(item.qr)
        ? `<img class="v146-admin-qr-thumb" src="${esc(item.qr)}" alt="${esc(item.platform)} QR">`
        : `<span class="v146-admin-social-initial">${esc((item.platform || '?').slice(0,1).toUpperCase())}</span>`;
      return `<article class="v140-list-card v146-social-admin-card"><div class="v146-social-admin-media">${qr}</div><div class="v146-social-admin-main"><b>${esc(item.platform)}</b><small>${esc(item.label || '')} · ${status}</small><p>${esc(item.note || '')}</p><p class="v146-admin-url">${esc(item.url || '')}</p></div><div class="v146-social-admin-actions"><button type="button" data-v140-edit="${esc(item.id)}" data-v140-kind="social">Edit</button><button type="button" data-v140-delete="${esc(item.id)}" data-v140-kind="social">Delete</button></div></article>`;
    }).join('') || '<div class="empty-state">No social links yet.</div>';
    const productsTarget = document.querySelector('[data-v140-list="products"]');
    if (productsTarget) productsTarget.innerHTML = getProducts().map(item => `<article class="v140-list-card"><b>${esc(item.title)}</b><small>${money(item.price)} · ${esc(item.status || '')} · ${item.published === false ? 'Draft' : 'Published'}</small><p>${esc(item.summary || '')}</p><div><button type="button" data-v140-edit="${esc(item.id)}" data-v140-kind="products">Edit</button><button type="button" data-v140-delete="${esc(item.id)}" data-v140-kind="products">Delete</button></div></article>`).join('') || '<div class="empty-state">No products yet.</div>';
  }

  function getCollection(kind){ return kind === 'recipes' ? getRecipes() : kind === 'stories' ? getStories() : kind === 'addons' ? getAddons() : kind === 'social' ? getSocialLinks() : getProducts(); }
  function saveCollection(kind, data){
    if (kind === 'recipes') { write(KEYS.recipes, data); remoteSaveLocalKeyV148('recipes', data); }
    else if (kind === 'stories') { write(KEYS.stories, data); remoteSaveLocalKeyV148('stories', data); }
    else if (kind === 'addons') saveAddons(data);
    else if (kind === 'social') saveSocialLinks(data);
    else { write(KEYS.products, data); remoteSaveLocalKeyV148('products', data); }
  }

  function editItem(id, kind){
    const item = getCollection(kind).find(x => String(x.id) === String(id));
    if (!item) return;
    if (kind === 'products') fillProductForm(item);
    else if (kind === 'addons') fillAddonForm(item);
    else if (kind === 'social') fillSocialForm(item);
    else fillPostForm(kind, item);
  }
  function deleteItem(id, kind){
    if (!confirm('Delete this item?')) return;
    saveCollection(kind, getCollection(kind).filter(x => String(x.id) !== String(id)));
    if (kind === 'addons') refreshPricingPage();
    renderPublicContent(); renderAdminLists();
  }
  function fillAddonForm(item){
    const form = document.querySelector('.v140-addon-form'); if (!form) return;
    ['id','name','price','tag','image','note','bookingNote'].forEach(name => form.elements[name].value = item[name] ?? '');
    form.elements.published.checked = item.published !== false;
    const status = document.getElementById('v140AddonStatus'); if (status) status.textContent = item.id ? 'Editing existing add-on.' : 'Creating new add-on.';
  }
  function saveAddonForm(form){
    const data = Object.fromEntries(new FormData(form).entries());
    data.id = data.id || uid('addon');
    data.price = Number(data.price || 0);
    data.published = !!form.elements.published.checked;
    const list = getAddons().filter(x => String(x.id) !== String(data.id));
    list.unshift(normalizeAddon(data));
    saveAddons(list);
    fillAddonForm({published:true});
    refreshPricingPage(); renderPublicContent(); renderAdminLists();
    const status = document.getElementById('v140AddonStatus'); if (status) status.textContent = 'Saved. Homepage, booking add-ons, and invoice pricing are updated.';
  }

  function fillSocialForm(item){
    const form = document.querySelector('.v146-social-form'); if (!form) return;
    ['id','platform','label','url','qr','note'].forEach(name => { if (form.elements[name]) form.elements[name].value = item[name] ?? ''; });
    form.elements.published.checked = item.published !== false;
    const status = document.getElementById('v146SocialStatus'); if (status) status.textContent = item.id ? 'Editing existing social link.' : 'Creating new social link.';
  }
  function saveSocialForm(form){
    const data = Object.fromEntries(new FormData(form).entries());
    data.id = data.id || uid('social');
    data.url = normalizeUrl(data.url || '');
    data.published = !!form.elements.published.checked;
    const list = getSocialLinks().filter(x => String(x.id) !== String(data.id));
    list.unshift(normalizeSocialLink(data));
    saveSocialLinks(list);
    fillSocialForm({published:true});
    renderPublicContent(); renderAdminLists();
    const status = document.getElementById('v146SocialStatus'); if (status) status.textContent = 'Saved. Public social links and QR cards are updated in this browser.';
  }
  function fillPostForm(kind, item){
    const form = document.querySelector(`[data-v140-post-form="${kind}"]`); if (!form) return;
    ['id','title','category','image','summary','link','linkLabel'].forEach(name => { if (form.elements[name]) form.elements[name].value = item[name] || ''; });
    const body = richBody(item) || '<p>Write your post here. Add photos, links, tips, specials, or party stories.</p>';
    const editor = form.querySelector('[data-v140-rich-editor]');
    if (editor) editor.innerHTML = body;
    if (form.elements.body) form.elements.body.value = body;
    form.elements.published.checked = item.published !== false;
    const status = form.querySelector('[data-v140-post-status]');
    if (status) status.textContent = item.id ? 'Editing existing post.' : 'Creating a new post.';
  }
  function savePostForm(kind, form){
    syncRichEditorToHidden(form);
    const data = Object.fromEntries(new FormData(form).entries());
    data.id = data.id || uid(kind);
    data.link = normalizeUrl(data.link || '');
    data.body = sanitizeRichHtml(data.body || '');
    data.published = !!form.elements.published.checked;
    const list = getCollection(kind).filter(x => String(x.id) !== String(data.id));
    list.unshift(data);
    saveCollection(kind, list);
    fillPostForm(kind, {}); renderPublicContent(); renderAdminLists();
    const status = form.querySelector('[data-v140-post-status]');
    if (status) status.textContent = 'Saved. The public Recipes / Stories feed now uses the formatted post.';
  }
  function fillProductForm(item){
    const form = document.querySelector('.v140-product-form'); if (!form) return;
    ['id','title','price','image','link','status','summary'].forEach(name => form.elements[name].value = item[name] || '');
    form.elements.published.checked = item.published !== false;
  }
  function saveProductForm(form){
    const data = Object.fromEntries(new FormData(form).entries());
    data.id = data.id || uid('product');
    data.price = Number(data.price || 0);
    data.published = !!form.elements.published.checked;
    const list = getProducts().filter(x => String(x.id) !== String(data.id));
    list.unshift(data);
    write(KEYS.products, list);
    fillProductForm({}); renderPublicContent(); renderAdminLists();
  }
  function saveMediaForm(form){
    const media = {title: form.elements.title.value, subtitle: form.elements.subtitle.value, items: [0,1,2].map(i => ({id:`hero-${i+1}`, src: form.elements[`src${i}`].value, poster: form.elements[`poster${i}`].value, enabled: !!form.elements[`enabled${i}`].checked}))};
    write(KEYS.media, media);
    remoteSaveLocalKeyV148('media', media);
    applyHeroMedia();
    const status = document.getElementById('v140MediaStatus'); if (status) status.textContent = 'Saved. Homepage hero media updated.';
  }
  function activeRichEditor(){
    const activePage = document.querySelector('[data-v140-page].active');
    return activePage?.querySelector('.v140-post-form [data-v140-rich-editor]') || document.querySelector('.v140-post-form [data-v140-rich-editor]');
  }
  function syncRichEditorToHidden(form){
    if (!form) return;
    const editor = form.querySelector('[data-v140-rich-editor]');
    const hidden = form.querySelector('[data-v140-rich-hidden]');
    if (editor && hidden) hidden.value = sanitizeRichHtml(editor.innerHTML || '');
  }
  function applyRichCommand(command, value = null){
    const editor = activeRichEditor();
    if (!editor) return;
    editor.focus();
    try { document.execCommand(command, false, value); } catch {}
    syncRichEditorToHidden(editor.closest('form'));
  }
  function applyRichBlock(block){
    const tag = ['blockquote','h2','h3','h4','p'].includes(block) ? block : 'p';
    applyRichCommand('formatBlock', tag);
  }
  function insertRichLink(){
    const url = normalizeUrl(prompt('Paste link URL. Example: https://example.com or #calendar') || '');
    if (!url || !isSafeHref(url)) return;
    applyRichCommand('createLink', url);
  }
  function insertRichImageUrl(){
    const url = prompt('Paste image URL. Example: https://...jpg or assets/photo.webp') || '';
    if (!url || !isSafeImageSrc(url)) return;
    const editor = activeRichEditor();
    if (!editor) return;
    editor.focus();
    try { document.execCommand('insertHTML', false, `<img src="${esc(url)}" alt="Phoenix Hibachi post image">`); } catch {}
    syncRichEditorToHidden(editor.closest('form'));
  }
  function handleRichImageFile(input){
    const file = input.files?.[0];
    const editor = activeRichEditor();
    if (!file || !editor) return;
    if (file.size > 1200000) alert('Image is large. A compressed WebP/JPG under 1MB is safer for page speed.');
    (async () => {
      let src = '';
      try { src = await uploadPublicImageV148(file, 'posts'); } catch (error) { console.warn('V148 storage upload failed, falling back to browser image:', error); }
      if (src) {
        editor.focus();
        try { document.execCommand('insertHTML', false, `<img src="${esc(src)}" alt="Uploaded post image">`); } catch {}
        syncRichEditorToHidden(editor.closest('form'));
        input.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        editor.focus();
        try { document.execCommand('insertHTML', false, `<img src="${esc(reader.result || '')}" alt="Uploaded post image">`); } catch {}
        syncRichEditorToHidden(editor.closest('form'));
        input.value = '';
      };
      reader.readAsDataURL(file);
    })();
  }
  function handleImageFileInput(input){
    const file = input.files?.[0];
    const form = input.closest('form');
    const targetName = input.dataset.v140ImageTarget || 'image';
    const imageField = form?.elements?.[targetName];
    if (!file || !imageField) return;
    if (file.size > 1200000) alert('Image is large. A compressed WebP/JPG under 1MB is safer for page speed.');
    (async () => {
      let src = '';
      try { src = await uploadPublicImageV148(file, targetName === 'qr' ? 'qr' : 'menu'); } catch (error) { console.warn('V148 storage upload failed, falling back to browser image:', error); }
      if (src) { imageField.value = src; input.value = ''; return; }
      const reader = new FileReader();
      reader.onload = () => { imageField.value = reader.result || ''; input.value = ''; };
      reader.readAsDataURL(file);
    })();
  }
  function refreshPricingPage(){
    const page = document.querySelector('[data-v140-page="pricing"]');
    if (page) page.innerHTML = pricingPage();
  }

  function boot(){
    syncAddonPricingToCore(getAddons());
    renderPublicContent();
    applyPricingToDom();
    applyHeroMedia();
    ensureAdminTabs();
    hydrateRemoteContentV148().catch(error => console.warn('V148 Supabase content hydrate skipped:', error));
  }
  document.addEventListener('DOMContentLoaded', boot);
  document.addEventListener('phoenix:pricing-updated', () => { renderDynamicAddons(); applyPricingToDom(); });
  /* V166: the old document-wide observer repeatedly rewrote seven tab buttons,
     creating a self-triggering hidden/style mutation loop and visible portal flicker. */
  document.addEventListener('phoenix:v166-dashboard-ready', ensureAdminTabs);
  try {
    const title = document.getElementById('dashboardTitle');
    if (title) new MutationObserver(ensureAdminTabs).observe(title, {childList:true, characterData:true, subtree:true});
  } catch {}
  setTimeout(boot, 300);
})();
