import {
  normalize as _normalize,
  config as NJAConfig,
  NormalizeResult as NormalizeResultBase,
} from '@geolonia/normalize-japanese-addresses';
import axios from 'axios';
import njapkg from '@geolonia/normalize-japanese-addresses/package.json';

export interface NormalizeResult extends NormalizeResultBase {
  exBanchiGo?: string
  building?: string
}

// TODO: https://japanese-addresses.geolonia.com を認証付きに置き換える予定があるため、一旦 -dev を使う
// https://japanese-addresses.geolonia.com を認証付きに変更後、速やかにこちらに戻す予定
const japaneseAddressesVersion = 'next';
NJAConfig.japaneseAddressesApi = `https://japanese-addresses-dev.geolonia.com/${japaneseAddressesVersion}/ja`;
NJAConfig.geoloniaApiKey = process.env.GEOLONIA_API_KEY;

export const joinNormalizeResult = (n: NormalizeResult) => (
  `${n.pref}${n.city}${n.town}${n.addr}`
);

export const versions = {
  nja: njapkg.version,
  ja: japaneseAddressesVersion,
};

export const normalize = async (input: string) => {
  const result = await _normalize(input) as NormalizeResult;
  // NJA は最大レベル8(住居表示、住居番号レベル)までの正規化を行うが、住居表示住所のデータは建物名の分離にのみ利用する
  if (result.level > 3) {
    result.level = 3;
    if (result.gaiku) {
      result.exBanchiGo = result.gaiku;
      delete result.gaiku;
      if (result.jyukyo) {
        result.exBanchiGo += `-${result.jyukyo}`;
        delete result.jyukyo;
      }
      result.addr = result.exBanchiGo + result.addr;
    }
  }
  return result;
};

export const listResidentials = async (pref: string, city: string, town: string) => {
  const url = encodeURI(`${NJAConfig.japaneseAddressesApi}/${pref}/${city}/${town}/住居表示.json?geolonia-api-key=${NJAConfig.geoloniaApiKey}`);
  let result;
  try {
    result = await axios(url);
    return result.data as { gaiku: string, jyukyo: string }[];
  } catch (error: any) {
    // TODO: japanese-addresses.geolonia.com が 404 エラーを返さないため403をハンドリングしている。
    // japanese-addresses.geolonia.com を改修後、条件分岐を404に返すように改修する。
    if (error.response.status === 404 || error.response.status === 403) {
      return [];
    } else {
      throw error;
    }
  }
};
