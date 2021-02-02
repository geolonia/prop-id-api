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
