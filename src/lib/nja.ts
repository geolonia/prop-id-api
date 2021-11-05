import { normalize, config as NJAConfig, NormalizeResult } from '@geolonia/normalize-japanese-addresses';

NJAConfig.japaneseAddressesApi = 'https://japanese-addresses.geolonia.com/v0.2.0/ja';

export const joinNormalizeResult = (n: NormalizeResult) => (
  `${n.pref}${n.city}${n.town}${n.addr}`
);

export { normalize };
