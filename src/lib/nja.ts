import { normalize, config as NJAConfig } from '@geolonia/normalize-japanese-addresses';

NJAConfig.japaneseAddressesApi = "https://japanese-addresses.geolonia.com/v0.2.0/ja";

export { normalize };
