
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
   <td><h4>Name</h4>


   </td>
   <td>
<h4>Type</h4>


   </td>
   <td>
<h4>In</h4>


   </td>
   <td>
<h4>Description</h4>


   </td>
  </tr>
  <tr>
   <td>
<h4>api-key</h4>


   </td>
   <td>
<h4>string</h4>


   </td>
   <td>
<h4>query</h4>


   </td>
   <td>
<h4>API キー</h4>


   </td>
  </tr>
  <tr>
   <td>
<h4>x-access-token</h4>


   </td>
   <td>
<h4>string</h4>


   </td>
   <td>
<h4>header</h4>


   </td>
   <td>
<h4>アクセストークン</h4>


   </td>
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
[GET] /?api-key={api-key}&q={address}&building={building}
```

<table>
  <tr>
   <td>
Name
   </td>
   <td>Type
   </td>
   <td>In
   </td>
   <td>Description
   </td>
  </tr>
  <tr>
   <td>address
   </td>
   <td>string
   </td>
   <td>query
   </td>
   <td>物件の住所
   </td>
  </tr>
  <tr>
   <td>building
   </td>
   <td>string
   </td>
   <td>query
   </td>
   <td>（任意）建物の名称
   </td>
  </tr>
</table>



### レスポンス


#### 無料プラン


```
[
  {
    "ID": "xxxx-xxxx-xxxx-xxxx"
  }
]
```



#### 有料プラン


```
[
  {
    "ID": "xxxx-xxxx-xxxx-xxxx",
    "address": {
      "ja": {
        "prefecture": "東京都",
        "city": "千代田区",
        "address1": "永田町１丁目",
        "address2": "7-1",
        "other": "xxx ビル"
      }
    },
    "location": {
      "geocoding_level": 1-9,
      "lat": "緯度",
      "lng": "経度"
    }
  }
]
```

## 不動産共通ID逆引きAPI

不動産共通IDから物件情報を取得することができます。有料プランでのご提供です。


```
[GET] https://api.propid.jp/v1/{id}?api-key={api-key}&lang={language}
```



#### パラメータ


<table>
  <tr>
   <td>Name
   </td>
   <td>Type
   </td>
   <td>In
   </td>
   <td>Description
   </td>
  </tr>
  <tr>
   <td> id
   </td>
   <td>string
   </td>
   <td>path
   </td>
   <td>不動産共通ID
   </td>
  </tr>
  <tr>
   <td>language
   </td>
   <td>string
   </td>
   <td>query
   </td>
   <td>言語コード
   </td>
  </tr>
</table>



#### レスポンス


```
[
  {
    "ID": "xxxx-xxxx-xxxx-xxxx",
    "address": {
      "ja": {
        "prefecture": "東京都",
        "city": "千代田区",
        "address1": "永田町１丁目",
        "address2": "7-1"
      }
    },
    "location": {
      "geocoding_level": 1-9,
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