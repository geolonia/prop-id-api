#  不動産共通 ID API

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
