#  不動産オープン ID API

## カスタムクオータ

api-key のテーブルに `quota_<quota-type>` としてリクエスト回数の上限を追加する。

ID リクエストに対して 100,000のリクエスト制限を設ける場合:

```json
{
 "apiKey": "01234567890abcdef",
 "GSI1PK": "auth0|01234567890abcdef",
 "quota_id-req": 100000,
 "plan": "free",
 "GSI1SK": "2022-04-01T12:00:00.000Z",
 "description": "デフォルトAPIキー",
 "lastRequestAt": 1111111111111,
 "hashedToken": "**********"
}
```

## 開発＆リリースフロー

* `develop` ブランチからフィーチャブランチを切ってください
* `develop` にマージされると、 `dev` 環境にデプロイされます。
* 本番にリリースするときは、 `develop` ブランチから `main` ブランチへのプルリクエストを作ります。
  * `main` にマージされると `v1` 環境にデプロイされます。

## development

```shell
$ git clone git@github.com:geolonia/prop-id-api.git
$ cd prop-id-api
$ cp .envrc.sample .envrc
$ vim .envrc # fill the values
$ yarn
```

テストに DynamoDB Local を使用します。起動するために、

```
yarn start-local-dynamodb
```

を実行してください。

### start localserver

```shell
$ yarn start
```

### update Snapshot tests

```shell
$ yarn test -- -u
```

## deploy

### Deploy CDN

```shell
$ yarn deploy:cdn:dev
```

### Deploy API

```shell
$ yarn deploy:dev
```

## Utilities

```shell
# Put an API key with a randomized access token.
$ node ./bin/put-api-key.mjs <description>
# List all API Keys.
$ node ./bin/list-api-keys.mjs
```

## ログフォーマット

```javascript
{
  SK: ULID,
  PK: `LOG#${ログ識別子}#yyyy-mm-dd`,
  userId?: string,
  apiKey?: string,
  createAt: string,
  ...metadata,
}
```

```javascript
{
  SK: string,
  PK: `AddrDB#${住所}`,
  ...metadata,
}
```


### ログ識別子

- `normLogsNJA` - NJA 正規化試行のログ
- `normFailNoTown` - NJA 失敗時のログ
- `normFailNoIPCGeom` - IPC リクエストに失敗した場合
- `normLogsIPCFail` -  IPC リクエストに成功したが、番地・号の情報が得られなかった場合
- `idIssSts` - ID の発行に成功した
- `feedbackRequest` - フィードバック受付
- `feedbackRequestReview` - フィードバックに対するレビュー

### DB の回帰テストを実行

package.json で指定している @geolonia/normalize-japanese-addresses (NJA) を利用して、正規化ログを使った NJA アップデートに対する回帰テストを実行します。正規化結果が変わった場合は `nja@x.y.z` というカラムに新しい正規化結果が出力されます。

```shell
$ STAGE=dev npx ts-node bin/nja.test.ts > out.csv
# または特定のバージョン以降と比較
$ STAGE=dev PREV_NJA_VERSION=1.2.3 npx ts-node bin/nja.test.ts > out.csv
```

```csv
"input","create_at","nja@1.2.3","nja@x.y.z"
"東京都江戸川区西小松川1-2-3","2022-01-28T12:34:41.920Z","東京都江戸川区西小松川1-2-3","東京都江戸川区西小松川町1-2-3"
"東京都江戸川区西小松川1-2-3","2022-01-28T04:34:48.823Z","東京都江戸川区西小松川1-2-3","東京都江戸川区西小松川町1-2-3"
```
