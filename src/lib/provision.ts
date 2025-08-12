export function totalProvisionWei(
  perOfferWei: bigint,
  nOffers: bigint
): bigint {
  return perOfferWei * nOffers;
}

export function missingProvisionWei(
  neededWei: bigint,
  lockedWei: bigint,
  freeWei: bigint
): bigint {
  const available = lockedWei + freeWei;
  return neededWei > available ? neededWei - available : BigInt(0);
}

export function minGivesUnits(
  density: bigint,
  offerGasbase: bigint,
  gasreq: bigint
): bigint {
  return density * (gasreq + offerGasbase);
}
