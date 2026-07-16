(() => {
  'use strict';

  const cfg = window.PhoenixMediaConfig || {};
  if (cfg.enabled === false) return;

  const log = (...args) => cfg.debug && console.info('[Phoenix Media]', ...args);
  const safeText = (value, fallback = '') => String(value ?? fallback);

  function getSupabaseClient() {
    try {
      const liveClient = window.getPhoenixSupabaseClient?.();
      if (liveClient && typeof liveClient.from === 'function') return liveClient;
    } catch (error) {
      log('Shared Supabase client lookup skipped.', error);
    }
    const candidates = [
      window.PhoenixSupabaseClient,
      window.supabaseClient,
      window.phoenixSupabase,
      window.__supabaseClient,
      window.SUPABASE_CLIENT
    ];
    return candidates.find((client) => client && typeof client.from === 'function') || null;
  }

  async function readPublishedAssets() {
    const client = getSupabaseClient();
    if (!client) {
      log('No existing Supabase client found; using configured fallbacks.');
      return [];
    }
    try {
      const { data, error } = await client
        .from(cfg.tableName || 'video_assets')
        .select('id,title,description,provider,placement,source_url,embed_url,poster_url,duration_seconds,sort_order,is_featured,metadata')
        .eq('status', 'published')
        .eq('is_public', true)
        .order('sort_order', { ascending: true })
        .limit(50);
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn('[Phoenix Media] Supabase media load skipped:', error?.message || error);
      return [];
    }
  }

  function selectHero(records) {
    return records
      .filter((item) => item.placement === (cfg.heroPlacement || 'hero_background') && item.provider === 'cloudflare_r2' && item.source_url)
      .sort((a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)) || (a.sort_order || 0) - (b.sort_order || 0))[0] || null;
  }

  function selectGallery(records) {
    return records
      .filter((item) => item.placement === (cfg.galleryPlacement || 'performance_gallery') && item.provider === 'cloudflare_stream' && item.embed_url)
      .sort((a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)) || (a.sort_order || 0) - (b.sort_order || 0))
      .slice(0, Number(cfg.maxGalleryItems || 8));
  }

  function applyHero(asset) {
    const video = document.querySelector('.hero-live-video');
    if (!video || !asset?.source_url) return false;
    const existingSource = video.querySelector('source');
    if (existingSource) {
      existingSource.src = asset.source_url;
      existingSource.type = asset.metadata?.mime_type || 'video/mp4';
    } else {
      video.src = asset.source_url;
    }
    if (asset.poster_url) video.poster = asset.poster_url;
    video.dataset.provider = 'cloudflare-r2';
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.load();
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
    return true;
  }

  function ensureModal() {
    let modal = document.getElementById('phxStreamModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'phxStreamModal';
    modal.className = 'phx-stream-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="phx-stream-dialog" role="document">
        <div class="phx-stream-head"><strong id="phxStreamTitle">Phoenix Hibachi Show</strong><button class="phx-stream-close" type="button" aria-label="Close video">×</button></div>
        <div class="phx-stream-frame-wrap" id="phxStreamFrameWrap"></div>
        <div class="phx-stream-copy" id="phxStreamDescription"></div>
      </div>`;
    document.body.appendChild(modal);

    const close = () => {
      modal.dataset.open = 'false';
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      const wrap = modal.querySelector('#phxStreamFrameWrap');
      if (wrap) wrap.replaceChildren();
    };
    modal.querySelector('.phx-stream-close')?.addEventListener('click', close);
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal.dataset.open === 'true') close(); });
    return modal;
  }

  function openStream(asset) {
    if (!asset?.embed_url) return;
    const modal = ensureModal();
    const title = modal.querySelector('#phxStreamTitle');
    const description = modal.querySelector('#phxStreamDescription');
    const wrap = modal.querySelector('#phxStreamFrameWrap');
    if (title) title.textContent = safeText(asset.title, 'Phoenix Hibachi Show');
    if (description) description.textContent = safeText(asset.description);
    if (wrap) {
      const iframe = document.createElement('iframe');
      iframe.src = asset.embed_url;
      iframe.title = safeText(asset.title, 'Phoenix Hibachi performance video');
      iframe.allow = 'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen';
      iframe.allowFullscreen = true;
      iframe.loading = 'lazy';
      wrap.replaceChildren(iframe);
    }
    modal.dataset.open = 'true';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    modal.querySelector('.phx-stream-close')?.focus();
  }

  function durationLabel(seconds) {
    const total = Number(seconds || 0);
    if (!total) return 'Watch the show';
    if (total < 60) return `${Math.round(total)} sec`;
    const minutes = Math.floor(total / 60);
    const secs = Math.round(total % 60);
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }

  function renderGallery(records) {
    const grid = document.querySelector('#performance .media-grid');
    if (!grid || !records.length) return false;
    const fragment = document.createDocumentFragment();
    records.forEach((asset) => {
      const article = document.createElement('article');
      article.className = 'media-card reveal phx-media-clickable';
      article.tabIndex = 0;
      article.setAttribute('role', 'button');
      article.setAttribute('aria-label', `Play ${safeText(asset.title, 'Phoenix Hibachi video')}`);

      const image = document.createElement('img');
      image.src = asset.poster_url || 'assets/media-fire-show.webp';
      image.alt = safeText(asset.title, 'Phoenix Hibachi performance');
      image.loading = 'lazy';
      image.decoding = 'async';

      const badge = document.createElement('span');
      badge.className = 'phx-media-provider-badge';
      badge.textContent = asset.metadata?.badge || 'Video';

      const copy = document.createElement('div');
      const small = document.createElement('small');
      small.textContent = asset.metadata?.subtitle || durationLabel(asset.duration_seconds);
      const heading = document.createElement('h3');
      heading.textContent = safeText(asset.title, 'Phoenix Hibachi Show');
      const paragraph = document.createElement('p');
      paragraph.textContent = safeText(asset.description, 'A signature Phoenix Hibachi live performance moment.');
      copy.append(small, heading, paragraph);
      article.append(image, badge, copy);

      article.addEventListener('click', () => openStream(asset));
      article.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openStream(asset);
        }
      });
      fragment.appendChild(article);
    });
    grid.replaceChildren(fragment);
    return true;
  }

  function normalizeFallbacks() {
    const hero = cfg.heroFallback?.sourceUrl ? {
      provider: 'cloudflare_r2',
      placement: cfg.heroPlacement || 'hero_background',
      source_url: cfg.heroFallback.sourceUrl,
      poster_url: cfg.heroFallback.posterUrl || '',
      is_featured: true,
      sort_order: 0
    } : null;
    const gallery = Array.isArray(cfg.galleryFallback) ? cfg.galleryFallback.map((item, index) => ({
      provider: 'cloudflare_stream',
      placement: cfg.galleryPlacement || 'performance_gallery',
      sort_order: index,
      ...item,
      embed_url: item.embed_url || item.embedUrl,
      poster_url: item.poster_url || item.posterUrl,
      duration_seconds: item.duration_seconds || item.durationSeconds
    })) : [];
    return { hero, gallery };
  }

  async function init() {
    const records = await readPublishedAssets();
    const fallbacks = normalizeFallbacks();
    const hero = selectHero(records) || fallbacks.hero;
    const gallery = selectGallery(records);
    const finalGallery = gallery.length ? gallery : fallbacks.gallery;

    const heroApplied = applyHero(hero);
    const galleryApplied = renderGallery(finalGallery);
    log({ heroApplied, galleryApplied, recordCount: records.length });

    if (!heroApplied && !galleryApplied && cfg.keepExistingOnEmpty !== false) {
      log('No Cloudflare media configured; existing local media remains unchanged.');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
