import presentation from "../../../docs/contracts/championship/raising-home-presentation.v1.json" with { type: "json" };

/** Temporary product-authored VS1 cage regions; no original-parity claim. */
export const RAISING_CAGES = Object.freeze(presentation.cages.map((cage) => Object.freeze({
  cageId: cage.cageId,
  name: cage.name,
  region: Object.freeze({ ...cage.region })
})));
