import { NormalizeResult } from '@geolonia/normalize-japanese-addresses';
import { IncrementPGeocodeResult, yokobo2zenchoonSymbol, zen2hanAscii } from '.';

export const extractBuildingName: (
  originalAddr: string,
  normalizedAddr: NormalizeResult,
  geocodedAddr: IncrementPGeocodeResult
) => [NormalizeResult, string] = ( originalAddr, normalizedAddr, geocodedAddr ) => {
  const { addr: banchiGoOther } = normalizedAddr;
  const { banchi_go: banchiGo } = geocodedAddr.feature.properties;
  const banchiGoPosInAddr = banchiGoOther.indexOf(banchiGo);
  if (banchiGoPosInAddr >= 0) {
    const normAddrWithoutBuilding = {
      ...normalizedAddr,
      addr: banchiGoOther.slice(0, banchiGo.length),
    };
    const buildingNameNJA = banchiGoOther
      .slice(banchiGoPosInAddr + banchiGo.length)
      .trim();
    let startPos;
    let buildingNamePartial = buildingNameNJA;
    while (buildingNamePartial.length >= 2 && (startPos = originalAddr.lastIndexOf(buildingNamePartial)) === -1) {
      buildingNamePartial = buildingNamePartial.slice(0, -1);
    }
    if (startPos && startPos >= 0) {
      // we found a match, and can use it to extract the original building name
      return [normAddrWithoutBuilding, originalAddr.slice(startPos)];
    } else {
      // we didn't find a match, but NJA has something, so we'll just return that
      return [normAddrWithoutBuilding, buildingNameNJA];
    }
  } else {
    return [normalizedAddr, ''];
  }
};

export const normalizeBuildingName = (building: string): string => {
  let b = building.trim();
  if (b === '') {
    return '';
  }
  b = zen2hanAscii(b);
  b = yokobo2zenchoonSymbol(b);

  return b;
};
