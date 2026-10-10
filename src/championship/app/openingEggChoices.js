// Existing original production portraits. Public selection preserves exact RGBA; no gameplay stats.
import {isApprovedOriginalPublicLocation} from "../presentation/originalRuntimeLocation.js";
export const OPENING_EGG_CHOICES=Object.freeze([
  {
    "speciesIndex": 0,
    "entityId": "e000_digitama",
    "src": "assets/production/internal-character-review/e000_digitama-dot-intake-r01/hud-r01/main-cell_000.png",
    "sha256": "3e7f28b8cd8e1c67c90d55f3bea4158b8c3ac7175658cffd77115dbe00143b7d",
    "width": 196,
    "height": 183
  },
  {
    "speciesIndex": 1,
    "entityId": "e001_digitama",
    "src": "assets/production/internal-character-review/e001_digitama-dot-intake-r01/hud-r01/main-cell_000.png",
    "sha256": "e6b173b519cbadb9f58c447dc3c66dd72c68e089d0deb2c362eb04b45d7c6099",
    "width": 214,
    "height": 262
  },
  {
    "speciesIndex": 2,
    "entityId": "e002_digitama",
    "src": "assets/production/internal-character-review/e002_digitama-dot-intake-r01/hud-r01/main-cell_000.png",
    "sha256": "4520febedcbc4fd5859d525b3472958a4cd904ab97cdf6d4221a402c8aeb6c9e",
    "width": 193,
    "height": 190
  },
  {
    "speciesIndex": 3,
    "entityId": "e003_digitama",
    "src": "assets/production/internal-character-review/e003_digitama-dot-intake-r01/hud-r01/main-cell_000.png",
    "sha256": "b0e65fc0988d5aa476adab6dab5280db9be2f4ca2055e7eb7c30301e9db2c965",
    "width": 173,
    "height": 211
  },
  {
    "speciesIndex": 4,
    "entityId": "e004_digitama",
    "src": "assets/production/internal-character-review/e004_digitama-dot-intake-r01/hud-r01/main-cell_000.png",
    "sha256": "2947e6a163340a4e9730c2f70952a89af575bd6e6d6e4f0f03f2d597f6bd27c9",
    "width": 233,
    "height": 222
  },
  {
    "speciesIndex": 5,
    "entityId": "e005_digitama",
    "src": "assets/production/internal-character-review/e005_digitama-dot-intake-r01/hud-r01/main-cell_000.png",
    "sha256": "7ba40475711f8b0df27afd5c5d8a115cfd703ce2e7835d367d1196dda680d8e6",
    "width": 246,
    "height": 220
  },
  {
    "speciesIndex": 6,
    "entityId": "e006_digitama",
    "src": "assets/production/internal-character-review/e006_digitama-dot-intake-r01/hud-r01/main-cell_000.png",
    "sha256": "dda7f44564e0d32af2281a17aa5488bd926880d75fedb95434274be5cb49e61d",
    "width": 212,
    "height": 237
  },
  {
    "speciesIndex": 7,
    "entityId": "e007_digitama",
    "src": "assets/production/internal-character-review/e007_digitama-dot-intake-r01/hud-r01/main-cell_000.png",
    "sha256": "9efbef3f165760c4891f3669434f00ac488ace7d472867fd8f0f0b3900be726b",
    "width": 241,
    "height": 273
  }
].map(Object.freeze));

const PUBLIC_OPENING_EGG_CHOICES=Object.freeze([
  {
    "speciesIndex": 0,
    "entityId": "e000_digitama",
    "src": "assets/production/characters/accepted-20261010/e000_digitama-dot-intake-r01/hud-r01/main-cell_000.webp",
    "sha256": "9658418351b273f59d08c3a97594f32917e92767f50e7dec3bd7d827a9da184c",
    "width": 196,
    "height": 183
  },
  {
    "speciesIndex": 1,
    "entityId": "e001_digitama",
    "src": "assets/production/characters/accepted-20261010/e001_digitama-dot-intake-r01/hud-r01/main-cell_000.webp",
    "sha256": "399fc686e578f8d8773a4aff81556d0b279d8770929d86e204197c0918cb4893",
    "width": 214,
    "height": 262
  },
  {
    "speciesIndex": 2,
    "entityId": "e002_digitama",
    "src": "assets/production/characters/accepted-20261010/e002_digitama-dot-intake-r01/hud-r01/main-cell_000.webp",
    "sha256": "ca5d0549a3639437f9e14802b30191d4f128de9a64a102a120d3fa1a3a6e21d7",
    "width": 193,
    "height": 190
  },
  {
    "speciesIndex": 3,
    "entityId": "e003_digitama",
    "src": "assets/production/characters/accepted-20261010/e003_digitama-dot-intake-r01/hud-r01/main-cell_000.webp",
    "sha256": "381ddbf72aa917491bd489265a96aa06c4dce9097546e5388e5eb6890786fbae",
    "width": 173,
    "height": 211
  },
  {
    "speciesIndex": 4,
    "entityId": "e004_digitama",
    "src": "assets/production/characters/accepted-20261010/e004_digitama-dot-intake-r01/hud-r01/main-cell_000.webp",
    "sha256": "ab93369d395bde5698e827a2e643d50fa17cfab2cebf1448d256318e34915b16",
    "width": 233,
    "height": 222
  },
  {
    "speciesIndex": 5,
    "entityId": "e005_digitama",
    "src": "assets/production/characters/accepted-20261010/e005_digitama-dot-intake-r01/hud-r01/main-cell_000.webp",
    "sha256": "3cd00bdf391700ca0c940626da18d5551d436eb589b65ea95e2cc5f5efb7f24f",
    "width": 246,
    "height": 220
  },
  {
    "speciesIndex": 6,
    "entityId": "e006_digitama",
    "src": "assets/production/characters/accepted-20261010/e006_digitama-dot-intake-r01/hud-r01/main-cell_000.webp",
    "sha256": "5193eba6562cadc0c1f53ba44f5628cf5bd1cbb5f87809939b2828328bc97812",
    "width": 212,
    "height": 237
  },
  {
    "speciesIndex": 7,
    "entityId": "e007_digitama",
    "src": "assets/production/characters/accepted-20261010/e007_digitama-dot-intake-r01/hud-r01/main-cell_000.webp",
    "sha256": "e273e36e758c8e1aa3228db7adbc2f3e51ec5755d0638c931d39a8c749921c7c",
    "width": 241,
    "height": 273
  }
].map(Object.freeze));
export function openingEggChoices(location=globalThis.location){return isApprovedOriginalPublicLocation(location)?PUBLIC_OPENING_EGG_CHOICES:OPENING_EGG_CHOICES;}
