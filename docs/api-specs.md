# 不動産共通ID仕様（β）

## API 共通仕様

### 不動産共通IDのフォーマット

```
[都道府県コード]-[UUID]
```

例: `13-xxxx-xxxx-xxxx-xxxx`

### 認証

#### 認証用パラメータ

<table>
  <tr>
    <th>Name</th>
    <th>Type</th>
    <th>In</th>
    <th>Description</th>
  </tr>
  <tr>
    <td>api-key</td>
    <td>string</td>
    <td>query</td>
    <td>API キー</td>
  </tr>
  <tr>
    <td>x-access-token</td>
    <td>string</td>
    <td>header</td>
    <td>アクセストークン</td>
  </tr>
</table>

#### リクエスト例

```
GET /v1/?api-key={api-key}
Host: api.propid.jp:443
X-Access-Token: {access-token}
Content-Type: application/json
```

## 不動産共通ID取得API

住所から不動産共通IDを取得します。有料プラン向けには正規化後の住所や位置情報などもレスポンスに追加されます。

### エンドポイント

```
https://api.propid.jp/v1
```

### リクエスト

```
[GET] /?api-key={api-key}&q={address}
```

<table>
  <tr>
    <th>Name</th>
    <th>Type</th>
    <th>In</th>
    <th>Description</th>
  </tr>
  <tr>
    <td>address</td>
    <td>string</td>
    <td>query</td>
    <td>物件の住所</td>
  </tr>
</table>

### レスポンス

#### 無料プラン

```
[
  {
    "ID": "xxxx-xxxx-xxxx-xxxx",
    "normalization_level": 0-3,
    "address": {
      "ja": {
        "prefecture": "東京都",
        "city": "千代田区",
        "address1": "永田町一丁目",
        "address2": "7-1",
        "other": "xxx ビル"
      }
    }
  }
]
```

#### 有料プラン

```
[
  {
    "ID": "xxxx-xxxx-xxxx-xxxx",
    "normalization_level": 0-3,
    "geocoding_level": 1-9,
    "address": {
      "ja": {
        "prefecture": "東京都",
        "city": "千代田区",
        "address1": "永田町一丁目",
        "address2": "7-1",
        "other": "xxx ビル"
      }
    },
    "location": {
      "lat": "緯度",
      "lng": "経度"
    }
  }
]
```

## 不動産共通ID参照API

不動産共通IDから物件情報を取得することができます。有料プランでのご提供です。

```
[GET] https://api.propid.jp/v1/{id}?api-key={api-key}&lang={language}
```

#### パラメータ

<table>
  <tr>
    <th>Name</th>
    <th>Type</th>
    <th>In</th>
    <th>Description</th>
  </tr>
  <tr>
    <td>id</td>
    <td>string</td>
    <td>path</td>
    <td>不動産共通ID</td>
  </tr>
  <tr>
    <td>language</td>
    <td>string</td>
    <td>query</td>
    <td>言語コード</td>
  </tr>
</table>

#### レスポンス

```
[
  {
    "ID": "xxxx-xxxx-xxxx-xxxx",
    "normalization_level": 0-3,
    "geocoding_level": 1-9,
    "address": {
      "ja": {
        "prefecture": "東京都",
        "city": "千代田区",
        "address1": "永田町一丁目",
        "address2": "7-1",
        "other": "xxx ビル"
      }
    },
    "location": {
      "lat": "緯度",
      "lng": "経度"
    }
  }
]
```

## 不動産共通ID統合時の仕様

地名変更等で不動産共通IDが統合された時、レスポンスの ID は統合先のIDを返します。

#### 例

地名変更で、東京府千代田区永田町1丁目7-1（ID：`xxxx-xxxx-xxxx-xxxx`）が、東京都千代田区永田町1丁目7-2（ID：`zzzz-zzzz-zzzz-zzzz`）に統合。

#### レスポンス

```
[
  {
    "ID": "zzzz-zzzz-zzzz-zzzz",
    ...
  }
]
```

## 解析レベル
不動産共通ID取得API及び、不動産共通ID参照APIのレスポンスは、住所の解析レベル情報を含みます。
無料版では `normalization_level` のみ、有料版ではより詳細な解析レベルの `geocoding_level` も含みます。

### `normalization_level`

<table>
  <tr>
    <th>解析レベル</th>
    <th>解析レベルの数字</th>
    <th>エラー時の値</th>
    <th>説明</th>
  </tr>
  <tr>
    <td>解析できません</td>
    <td>0</td>
    <td><code>prefecture_not_recognized</code></td>
    <td>都道府県も判別できなかった</td>
  </tr>
  <tr>
    <td>都道府県</td>
    <td>1</td>
    <td><code>city_not_recognized</code></td>
    <td>都道府県まで判別できた</td>
  </tr>
  <tr>
    <td>市区町村</td>
    <td>2</td>
    <td><code>neighborhood_not_recognized</code></td>
    <td>市区町村まで判別できた</td>
  </tr>
  <tr>
    <td>町丁目</td>
    <td>3</td>
    <td></td>
    <td>町丁目まで判別できた</td>
  </tr>
</table>

### `geocoding_level`

<table>
  <tr>
    <th>解析レベル</th>
    <th>レベルの数字</th>
    <th>エラー時の値</th>
    <th>説明</th>
  </tr>
  <tr>
    <td>都道府県</td>
    <td>1</td>
    <td><code>geo_prefecture</code><td>
    <td>県レベルでマッチしました</td>
  </tr>
  <tr>
    <td>市区町村</td>
    <td>2</td>
    <td><code>geo_city</code><td>
    <td>市区町村レベルでマッチしました</td>
  </tr>
  <tr>
    <td>町域 (大字)	</td>
    <td>3</td>
    <td><code>geo_oaza</code><td>
    <td>町域レベルでマッチしました</td>
  </tr>
  <tr>
    <td>丁目 / 小字	</td>
    <td>4</td>
    <td><code>geo_koaza</code><td>
    <td>丁目または小字レベルでマッチしました</td>
  </tr>
  <tr>
    <td>番地（番）</td>
    <td>5</td>
    <td><code>geo_banchi</code><td>
    <td>番地（番）レベルでマッチしました</td>
  </tr>
  <tr>
    <td>号情報が存在しない番地</td>
    <td>7</td>
    <td><code>geo_ok_no_go</code><td>
    <td>番地（番）レベルでマッチしました（号情報が存在しない地域）</td>
  </tr>
  <tr>
    <td>号</td>
    <td>8</td>
    <td><code>geo_ok_go</code><td>
    <td>号レベルでマッチしました</td>
  </tr>
  <tr>
    <td>不明</td>
    <td>-1</td>
    <td><code>geo_undefined</code><td>
    <td>不明</td>
  </tr>
</table>

## レート制限

各APIは現在のレート制限状況を確認できる、レスポンスヘッダーを返します。制限を超えた場合はこのヘッダーを確認して、いつ再試行できるかを判断できます。

```
$ curl -D /dev/stderr -G -H "x-access-token: <アクセストークン>" --data-urlencode "q=東京都千代田区永田町1-7-1" --data-urlencode "api-key=<APIキー>" "https://api.propid.jp/v1/"
> x-ratelimit-limit: 10000
> x-ratelimit-remaining: 9938
> x-ratelimit-reset: 2021-06-01T00:00:00.000+09:00
```

<table>
  <tr>
    <th>ヘッダー名</th>
    <th>説明</th>
  </tr>
  <tr>
    <td style="min-width: 210px;"><code>x-ratelimit-limit</code></td>
    <td>一ヶ月当たりのリクエスト上限回数</td>
  </tr>
  <tr>
    <td style="min-width: 210px;"><code>x-ratelimit-remaining</code></td>
    <td>リクエスト残数</td>
  </tr>
  <tr>
    <td style="min-width: 210px;"><code>x-ratelimit-reset</code></td>
    <td>次にレート制限がリセットされる予定時刻 (<a href="https://ja.wikipedia.org/wiki/%E6%97%A5%E6%9C%AC%E6%A8%99%E6%BA%96%E6%99%82" target="_blank" rel="noopener noreferrer">JST</a> <a href="https://ja.wikipedia.org/wiki/ISO_8601" target="_blank" rel="noopener noreferrer">ISO8601</a>形式)</td>
  </tr>
</table>

## エラー

不動産共通ID取得API及び、不動産共通ID参照APIが リクエストの処理に成功すると、API はステータスコード「200」を返します。リクエストでエラーが発生すると、エラーの種類に基づいて HTTP ステータスコード、理由を含むレスポンスが API から返されます。 レスポンスの本文には、エラーの原因についての詳しい説明が記述されています。

## 標準エラーレスポンス

<table>
  <tr>
    <th>ステータス</th>
    <th>説明</th>
    <th>メッセージ</th>
  </tr>
  <tr>
    <td>403</td>
    <td>Forbidden</td>
    <td><code>{"message":"Incorrect querystring parameter `api-key` or `x-access-token` header value."}</code></td>
  </tr>
  <tr>
    <td>429</td>
    <td>Too Many Requests</td>
    <td><code>{"message":"Exceed requests limit."}</code></td>
  </tr>
</table>

## 不動産共通ID取得API

<table>
  <tr>
    <th>ステータス</th>
    <th>説明</th>
    <th>メッセージ</th>
  </tr>
  <tr>
    <td>400</td>
    <td>Bad Request</td>
    <td><code>{"message":"Missing querystring parameter `q`."}</code></td>
  </tr>
  <tr>
    <td>400</td>
    <td>Bad Request</td>
    <td><code>{"error":true,"error_code":"normalization_failed","error_code_detail":"city_not_recognized","address":"和歌山県東牟婁郡"}</code></td>
  </tr>
  <tr>
    <td>400</td>
    <td>Bad Request</td>
    <td><code>{"error":true,"error_code":"normalization_failed","error_code_detail":"prefecture_not_recognized","address":"XXX"}</code></td>
  </tr>
  <tr>
    <td>404</td>
    <td>Not Found</td>
    <td><code>{"error":true,"error_code":"address_not_verified","address":"XXX"}</code></td>
  </tr>
</table>

## 不動産共通ID参照API

<table>
  <tr>
    <th>ステータス</th>
    <th>説明</th>
    <th>メッセージ</th>
  </tr>
  <tr>
    <td>404</td>
    <td>Not Found</td>
    <td><code>{"error":true,"error_description":"not_found"}</code></td>
  </tr>
</table>
