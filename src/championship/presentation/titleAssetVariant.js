// Pick once per title lifetime: rotation must not start another image download.
// The layout caps the art at 520 CSS pixels; a DPR above two adds little detail.
export function selectTitleAsset(element, fallback, view = element?.ownerDocument?.defaultView) {
  const data = element?.dataset ?? {};
  const width = Number(view?.innerWidth) || 520;
  const height = Number(view?.innerHeight) || 960;
  const dpr = Math.min(2, Math.max(1, Number(view?.devicePixelRatio) || 1));
  const artWidth = width > height ? width : Math.min(width, height * 9 / 16, 520);
  const compact = artWidth * dpr <= 800
    || view?.navigator?.connection?.saveData === true;
  return (compact && data.titleCompactSrc) || data.titleOptimizedSrc || fallback;
}
