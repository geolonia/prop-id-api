import { config as NJAConfig } from '@geolonia/normalize-japanese-addresses';
import { normalize } from './nja';

it('works', async () => {
  const resp = await normalize('東京都文京区千石4丁目15-7');
  expect(resp).toMatchObject({
    "pref": "東京都",
    "city": "文京区",
    "town": "千石四丁目",
    "addr": "15-7",
    "lat": 35.729052,
    "lng": 139.740683,
    "level": 3,
  });
});

it('uses a versioned API for japanese-addresses', async () => {
  expect(NJAConfig.japaneseAddressesApi).toStrictEqual(
    'https://japanese-addresses.geolonia.com/v0.2.0/ja',
  );
});
