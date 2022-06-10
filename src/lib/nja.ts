// TODO:
// NJA@2.5.1 のバグ（型定義が読み込めない）のため、ここで型を定義する。
// NJA のバージョンアップ後に削除する
declare module '@geolonia/normalize-japanese-addresses' {
/**
 * 住所の正規化結果として戻されるオブジェクト
 */
  export interface NormalizeResult {
  /** 都道府県 */
    pref: string
    /** 市区町村 */
    city: string
    /** 町丁目 */
    town: string
    /** 正規化後の住所文字列 */
    addr: string
    /** 緯度。データが存在しない場合は null */
    lat: number | null
    /** 軽度。データが存在しない場合は null */
    lng: number | null
    /**
     * 住所文字列をどこまで判別できたかを表す正規化レベル
     * - 0 - 都道府県も判別できなかった。
     * - 1 - 都道府県まで判別できた。
     * - 2 - 市区町村まで判別できた。
     * - 3 - 町丁目まで判別できた。
     */
    level: number
  }
}

import {
  normalize,
  config as NJAConfig,
  NormalizeResult as NormalizeResultBase,
} from '@geolonia/normalize-japanese-addresses';
import njapkg from '@geolonia/normalize-japanese-addresses/package.json';

export interface NormalizeResult extends NormalizeResultBase {
  building?: string
}

const japaneseAddressesVersion = '0.2.0';
NJAConfig.japaneseAddressesApi = `https://japanese-addresses.geolonia.com/v${japaneseAddressesVersion}/ja`;

export const joinNormalizeResult = (n: Omit<NormalizeResult, 'lat' | 'lng' | 'level'>) => (
  `${n.pref}${n.city}${n.town}${n.addr}`
);

export const versions = {
  nja: njapkg.version,
  ja: japaneseAddressesVersion,
};

export {
  normalize,
};
