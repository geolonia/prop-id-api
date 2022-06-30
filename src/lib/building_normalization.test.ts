import { joinNormalizeResult, normalize } from './nja';
import {
  normalizeBuildingName,
  extractBuildingName,
} from './building_normalization';
import { incrementPGeocode } from '.';

describe('extractBuildingName', () => {
  const testData = [
    { addr: '東京都文京区春日1-16-21 文京区役所', expected: '文京区役所' },
    { addr: '東京都文京区春日1-16-21文京区役所', expected: '文京区役所' },
    { addr: '東京都目黒区平町２丁目１７－２８中野エイコーハイツ', expected: '中野エイコーハイツ' },
    { addr: '東京都豊島区西巣鴨４丁目14-11ライオンズマンション南烏山', expected: 'ライオンズマンション南烏山' },
    { addr: '東京都板橋区本町６番４号ライオンズマンション南池袋', expected: 'ライオンズマンション南池袋' },
    { addr: '東京都江東区豊洲４丁目10-18自由が丘ミッテ', expected: '自由が丘ミッテ' },
    { addr: '東京都板橋区仲宿56-15ライオンズマンション南烏山', expected: 'ライオンズマンション南烏山' },
    { addr: '東京都世田谷区代田５丁目１６－２０ライオンズマンション板橋第弐', expected: 'ライオンズマンション板橋第弐' },
    { addr: '東京都新宿区下落合１－１７－１ライオンズマンション板橋区役所前', expected: 'ライオンズマンション板橋区役所前'},
    { addr: '東京都杉並区高円寺北１－２０－１２ライオンズマンション板橋本町', expected: 'ライオンズマンション板橋本町' },
    { addr: '東京都大田区大森東４－１９－２９ライオンズマンション南平台', expected: 'ライオンズマンション南平台' },
    { addr: '東京都世田谷区尾山台２丁目７－１５ガラ・シティ五反田', expected: 'ガラ・シティ五反田' },
    { addr: '東京都品川区南大井４-２-１６ライオンズマンション鉢山', expected: 'ライオンズマンション鉢山' },
    { addr: '東京都港区港南３丁目６番２１号朝日プラザ旗の台', expected: '朝日プラザ旗の台' },
    { addr: '東京都中央区新川２－１９－８ライオンズマンション哲学堂', expected: 'ライオンズマンション哲学堂' },
    { addr: '東京都渋谷区富ヶ谷１丁目１４番１６号クラッサ目黒かむろ坂', expected: 'クラッサ目黒かむろ坂' },
    { addr: '東京都世田谷区玉堤１丁目23-14朝日プラザ北新宿', expected: '朝日プラザ北新宿' },
    { addr: '東京都練馬区上石神井２－33-12アルカディアK', expected: 'アルカディアK' },
    { addr: '東京都品川区西五反田８丁目7‐7朝日サテライト二番町', expected: '朝日サテライト二番町' }, // 特殊ケース (NJAがビル名内の「二番町」を「二町」に変換する)
    { addr: '東京都渋谷区富ヶ谷２－１８－７中野荘', expected: '中野荘' },
    { addr: '東京都北区浮間4-6-10パレ・ホームズ中延', expected: 'パレ・ホームズ中延' },
    { addr: '東京都杉並区高井戸西１－２－４アーバハイツ高円寺南', expected: 'アーバハイツ高円寺南' },
    { addr: '東京都板橋区常盤台３－１３－１３芝パーク・タワー', expected: '芝パーク・タワー' },
    { addr: '東京都文京区目白台３丁目アーバイル池上', expected: 'アーバイル池上' },
    { addr: '東京都台東区千束２－３６-２アーバイルスパシエ芝浦ＢＡＹ－ＳＩＤＥ３０４', expected: 'アーバイルスパシエ芝浦ＢＡＹ－ＳＩＤＥ３０４' },
    { addr: '東京都板橋区常盤台２丁目10－６アーバイル目黒エピキュア', expected: 'アーバイル目黒エピキュア' },
    { addr: '東京都杉並区荻窪４丁目３３－９パークハウス芝タワー', expected: 'パークハウス芝タワー' },
    { addr: '東京都文京区白山２丁目３３－３ザ・タワー芝浦', expected: 'ザ・タワー芝浦' },
    { addr: '東京都品川区荏原１－２１－５アーバネックス新井薬師', expected: 'アーバネックス新井薬師' },
    { addr: '和歌山県東牟婁郡串本町田並1300', expected: '' },
    { addr: '和歌山県東牟婁郡串本町田並1300串本西中学校', expected: '串本西中学校' },
    { addr: '和歌山県東牟婁郡串本町田並1300 串本西中学校', expected: '串本西中学校' },
    { addr: '東京都文京区大塚４－５１－１平澤三陽ビル', expected: '平澤三陽ビル'},
    { addr: '東京都足立区島根２丁目22-10南篠崎二丁目住宅', expected: '南篠崎二丁目住宅'},
    { addr: '東京都新宿区高田馬場１－３１－８東池袋５丁目マンション', expected: '東池袋５丁目マンション'},
    { addr: '愛知県豊田市若林東町宮間22-1おはようビル', expected: 'おはようビル', expectedBanchiGo: '宮間22-1' }
  ];
  for (const d of testData) {
    test(`should extract '${d.expected}' from '${d.addr}'`, async () => {
      const normalization = await normalize(d.addr);
      const geocoding = await incrementPGeocode(joinNormalizeResult(normalization));
      if (geocoding === false) {
        expect(geocoding).not.toStrictEqual(false);
        return;
      }
      const normWithoutBuilding = extractBuildingName(d.addr, normalization, geocoding);
      const extracted = normWithoutBuilding.building || '';

      // if the building isn't in the address to begin with, we don't need these checks.
      if (d.expected !== '') {
        expect(normWithoutBuilding.addr).not.toStrictEqual(normalization.addr);
        expect(normWithoutBuilding.addr).not.toContain(d.expected);
      }

      if(d.expectedBanchiGo) {
        expect(normWithoutBuilding.addr).toEqual(d.expectedBanchiGo);
      }

      expect(extracted).toStrictEqual(d.expected);
    });
  }
});

describe('normalizeBuildingName', () => {
  test('Should normalize ダイアパレス北１０条 to ダイアパレス北10条', () => {
    expect(normalizeBuildingName('ダイアパレス北１０条')).toStrictEqual('ダイアパレス北10条');
  });

  test('Should normalize びゅうＭシティ上盛岡 to びゅうMシティ上盛岡', () => {
    expect(normalizeBuildingName('びゅうＭシティ上盛岡')).toStrictEqual('びゅうMシティ上盛岡');
  });

  test('Should normalize ａｉｅ北上駅前 to aie北上駅前', () => {
    expect(normalizeBuildingName('ａｉｅ北上駅前')).toStrictEqual('aie北上駅前');
  });

  test('Should normalize ザ・ガ﹣デンズ勾当台通タワ﹣レジデンス to ザ・ガーデンズ勾当台通タワーレジデンス', () => {
    expect(normalizeBuildingName('ザ・ガ﹣デンズ勾当台通タワ﹣レジデンス')).toStrictEqual('ザ・ガーデンズ勾当台通タワーレジデンス');
  });

  test('Should normalize Ｄ’クラディア八日町 to D’クラディア八日町', () => {
    expect(normalizeBuildingName('Ｄ’クラディア八日町')).toStrictEqual('D’クラディア八日町');
  });
});
