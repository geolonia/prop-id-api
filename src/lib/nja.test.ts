import { config as NJAConfig } from '@geolonia/normalize-japanese-addresses';
import { normalize } from './nja';

it('works', async () => {
  const resp = await normalize('東京都文京区千石4丁目15-7');
  expect(resp).toContain({
    pref: "東京都",
    city: "文京区",
    town: "千石四丁目",
    gaiku: 15,
    jyukyo: 7,
    level: 8,
  });
});

it('uses a versioned API for japanese-addresses', async () => {
  expect(NJAConfig.japaneseAddressesApi).toMatchSnapshot();
});
