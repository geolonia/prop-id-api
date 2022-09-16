import { config as NJAConfig } from '@geolonia/normalize-japanese-addresses';
import { normalize } from './nja';

it('works', async () => {
  const resp = await normalize('東京都文京区千石4丁目15-7');
  expect(resp).toEqual(
    expect.objectContaining({
      pref: "東京都",
      city: "文京区",
      town: "千石四丁目",
      exBanchiGo: '15-7',
      level: 3,
    })
  );
});

it('uses a versioned API for japanese-addresses', async () => {
  expect(NJAConfig.japaneseAddressesApi).toMatchSnapshot();
});
