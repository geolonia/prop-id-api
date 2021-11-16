import {
  normalize,
  config as NJAConfig,
  NormalizeResult as NormalizeResultBase,
} from '@geolonia/normalize-japanese-addresses';

export interface NormalizeResult extends NormalizeResultBase {
  building?: string
}

NJAConfig.japaneseAddressesApi = 'https://japanese-addresses.geolonia.com/v0.2.0/ja';

export const joinNormalizeResult = (n: NormalizeResult) => (
  `${n.pref}${n.city}${n.town}${n.addr}`
);

export {
  normalize,
};
