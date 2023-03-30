#  不動産オープン ID API

### ローカル開発環境のセットアップ

```shell
$ git clone git@github.com:geolonia/prop-id-api.git
$ cd prop-id-api
$ cp .envrc.sample .envrc
$ vim .envrc # fill the values
$ yarn
```

## テスト実行

テストには Docker が必要です。

```shell
# テスト実行
$ yarn test
```

## リリースフロー

* `develop` ブランチからフィーチャブランチを切ってください
* `develop` にマージされると、 `dev` 環境にデプロイされます。
* 本番にリリースするときは、 `develop` ブランチから `main` ブランチへのプルリクエストを作ります。
  * `main` にマージされると `v1` 環境にデプロイされます。

### CDN デプロイ

```shell
$ yarn deploy:cdn:dev
```

### API デプロイ

```shell
$ yarn deploy:dev
```

## カスタムクオータの設定

ユーザーにカスタムの API リクエストクオータを設定するには、api-key のテーブルの当該ユーザーのドキュメントに `quota_<quota-type>` プロパティとして数値を設定します

ID リクエストに対して 100,000のリクエスト制限を設ける場合:

```json
{
 "apiKey": "01234567890abcdef",
 "GSI1PK": "auth0|01234567890abcdef",
 "quota_id-req": 100000,
 "plan": "free",
 "GSI1SK": "2022-04-01T12:00:00.000Z",
 "description": "デフォルト API キー",
 "lastRequestAt": 1111111111111,
 "hashedToken": "**********"
}
```

## ログ

不動産オープン ID はさまざまなログを取得します。フォーマットやログの種類は以下の通りです。

### フォーマット

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

- `InsUsr` - prop-id-user-provisioning で発行。ユーザー作成時のログ
- `normLogsNJA` - NJA 正規化試行のログ
- `normFailNoTown` - NJA 失敗時のログ
- `normFailNoIPCGeom` - IPC リクエストに失敗した場合
- `normLogsIPCFail` -  IPC リクエストに成功したが、番地・号の情報が得られなかった場合
- `idIssSts` - ID の発行に成功した
- `feedbackRequest` - フィードバック受付
- `feedbackRequestReview` - フィードバックに対するレビュー
