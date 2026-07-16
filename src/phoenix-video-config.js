/* Public media configuration only. Never place Cloudflare API tokens here. */
window.PhoenixMediaConfig = Object.assign({
  enabled: true,
  tableName: 'video_assets',
  heroPlacement: 'hero_background',
  galleryPlacement: 'performance_gallery',
  maxGalleryItems: 8,
  keepExistingOnEmpty: true,
  debug: false,
  heroFallback: { sourceUrl: '', posterUrl: '' },
  galleryFallback: []
}, window.PhoenixMediaConfig || {});
