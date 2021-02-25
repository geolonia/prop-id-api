#  不動産 ID API

## development

```shell
$ git clone git@github.com:geolonia/estate-id-api.git
$ cd estate-id-api
$ cp .envrc.sample .envrc
$ vim .envrc # fill the values
$ yarn # or `npm install`
$ npm test
```

### start localserver

```shell
$ npm start
```

### access the test tool locally

```
$ npm start
$ npx http-server -o -c-1 -p 8080 docs
$ open http://127.0.0.1:8080/debug?url=http://127.0.0.1:3000/dev/demo
```

### update Snapshot tests

```shell
$ npm test -- -u
```

## deploy

### Deploy CDN

```shell
$ npm run deploy:cdn:dev
```

### Deploy API

```shell
$ npm run deploy:dev
```

## Utilities

```shell
# Put an API key with a randomized access token.
$ node ./src/bin/put-api-key.mjs <description>
# List all API Keys.
$ node ./src/bin/list-api-keys.mjs
```
