/* Public media configuration only. Never place Cloudflare API tokens here. */
window.PhoenixMediaConfig = Object.assign({
  enabled: true,
  tableName: 'video_assets',
  heroPlacement: 'hero_background',
  galleryPlacement: 'performance_gallery',
  maxGalleryItems: 8,
  keepExistingOnEmpty: true,
  debug: false,
  heroFallback: { sourceUrl: 'assets/hero-live-show-video.mp4', posterUrl: 'assets/hero-live-show-poster.webp' },
  galleryFallback: []
}, window.PhoenixMediaConfig || {});
