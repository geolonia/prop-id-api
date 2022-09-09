import {
  normalize,
  config as NJAConfig,
  NormalizeResult as NormalizeResultBase,
} from '@geolonia/normalize-japanese-addresses';
import njapkg from '@geolonia/normalize-japanese-addresses/package.json';

export interface NormalizeResult extends NormalizeResultBase {
  building?: string
}

const japaneseAddressesVersion = 'next';
NJAConfig.japaneseAddressesApi = `https://japanese-addresses-dev.geolonia.com/v${japaneseAddressesVersion}/ja`;
NJAConfig.geoloniaApiKey = process.env.GEOLONIA_API_KEY;

export const joinNormalizeResult = (n: NormalizeResult) => (
  `${n.pref}${n.city}${n.town}${n.addr}`
);

export const versions = {
  nja: njapkg.version,
  ja: japaneseAddressesVersion,
};

export {
  normalize,
};
