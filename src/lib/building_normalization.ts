import { NormalizeResult } from './nja';
import { IncrementPGeocodeResult, yokobo2zenchoonSymbol, zen2hanAscii } from '.';

export const extractBuildingName: (
  originalAddr: string,
  normalizedAddr: NormalizeResult,
  geocodedAddr: IncrementPGeocodeResult
) => NormalizeResult = ( originalAddr, normalizedAddr, geocodedAddr ) => {
  if ('building' in normalizedAddr && typeof normalizedAddr.building !== 'undefined') {
    // この住所のビル名が既に分離されています
    return normalizedAddr;
  }

  const { addr: banchiGoOther } = normalizedAddr;
  const { banchi_go: banchiGo, geocoding_level } = geocodedAddr.feature.properties;
  const ipc_geocoding_level_int = parseInt(geocoding_level, 10);
  const banchiGoPosInAddr = banchiGoOther.indexOf(banchiGo);

  if (ipc_geocoding_level_int <= 5) {
    const banchiPattern = ipc_geocoding_level_int === 5 ? banchiGo : '[1-9][0-9]*';
    const banchiGoRegex = new RegExp(`${banchiPattern}(-[1-9][0-9]*)?`);
    const match = normalizedAddr.addr.match(banchiGoRegex);
    if (match) {
      const foundBanchiGo = match[0];
      const building = normalizedAddr.addr.replace(foundBanchiGo, '');
      return {
        ...normalizedAddr,
        addr: foundBanchiGo,
        building,
      };
    } else {
      return normalizedAddr;
    }

  } else if (banchiGoPosInAddr >= 0) {
    const normAddrWithoutBuilding = {
      ...normalizedAddr,
      addr: banchiGoOther.slice(0, banchiGo.length + banchiGoPosInAddr),
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
      normAddrWithoutBuilding.building = originalAddr.slice(startPos);
    } else {
      // we didn't find a match, but NJA has something, so we'll just return that
      normAddrWithoutBuilding.building = buildingNameNJA;
    }
    return normAddrWithoutBuilding;
  }

  // We couldn't find a building, so we'll just return the input.
  return normalizedAddr;
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
