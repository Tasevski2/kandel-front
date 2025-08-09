export function perOfferProvisionWei(
  gasPriceWeiPerGas: bigint,
  offerGasbase: bigint,
  gasreq: bigint
): bigint {
  return gasPriceWeiPerGas * (gasreq + offerGasbase);
}

export function totalProvisionWei(
  perOfferWei: bigint,
  nOffers: bigint
): bigint {
  return perOfferWei * nOffers;
}

export function minGivesUnits(
  density: bigint,
  offerGasbase: bigint,
  gasreq: bigint
): bigint {
  return density * (gasreq + offerGasbase);
}

export function missingProvisionWei(
  neededWei: bigint,
  lockedWei: bigint,
  freeWei: bigint
): bigint {
  const available = lockedWei + freeWei;
  return neededWei > available ? neededWei - available : BigInt(0);
}

export function useProvision() {
  return {
    perOffer: perOfferProvisionWei,
    total: totalProvisionWei,
    minGives: minGivesUnits,
    missing: missingProvisionWei,
  };
}
