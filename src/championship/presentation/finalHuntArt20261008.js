import {isOriginalRuntimeLocation,isOriginalLoopbackLocation,isApprovedOriginalPublicLocation} from './originalRuntimeLocation.js';
import {publicMapManifestPath} from './publicMapRequests.js';
// Owner-authorized local art integration; native field identity and simulation stay unchanged.

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

export function finalHuntArtManifestUrl(fieldId, nativeHuntIndex, location = globalThis.location) {

  if (!isOriginalRuntimeLocation(location)) return null;

  const params = new URLSearchParams(location?.search ?? '');
  if (isOriginalLoopbackLocation(location) && (params.get('industrialReview') === 'r1' || ['natural-r10', 'natural-r11'].includes(params.get('caveReview')))) return null;
  return publicMapManifestPath(fieldId === 'field_hm10_01' && nativeHuntIndex === 17 ? 'hunt-night' : 'hunt-accepted');

}
