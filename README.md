#  不動産 ID API

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

### access the test tool locally

```
$ yarn start
$ npx http-server -c-1 -p 8080 docs
$ open http://127.0.0.1:8080/debug?url=http://127.0.0.1:3000/dev/demo
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
