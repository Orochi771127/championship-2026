import {isOriginalRuntimeLocation,isOriginalLoopbackLocation,isApprovedOriginalPublicLocation} from './originalRuntimeLocation.js';
// Owner-authorized local art integration; native field identity and simulation stay unchanged.

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

export function finalHuntArtManifestUrl(fieldId, nativeHuntIndex, location = globalThis.location) {

  if (!isOriginalRuntimeLocation(location)) return null;

  const params = new URLSearchParams(location?.search ?? '');
  if (isOriginalLoopbackLocation(location) && (params.get('industrialReview') === 'r1' || ['natural-r10', 'natural-r11'].includes(params.get('caveReview')))) return null;
  return (isApprovedOriginalPublicLocation(location)?'assets/production/hunt/accepted-20261010/':'assets/production/hunt/final-intake-20261008/')

    + (fieldId === 'field_hm10_01' && nativeHuntIndex === 17 ? 'hm10-night.manifest.json' : 'manifest.json');

}
