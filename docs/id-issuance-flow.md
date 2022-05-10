# ID 発行の処理の詳細

```mermaid
graph TD

input(住所入力) --> NJA_norm[NJA正規化]

NJA_norm -- NJA正規化レベル3 --> IPC_norm[IPC正規化]
NJA_norm -- NJA正規化レベル2 --> NJA_error_2(400レスポンス<br>normalization_failed<br>prefecture_not_recognized)
NJA_norm -- NJA正規化レベル1 --> NJA_error_1(400レスポンス<br>normalization_failed<br>city_not_recognized)
NJA_norm -- NJA正規化レベル0 --> NJA_error_0(400レスポンス<br>normalization_failed<br>neiborhood_not_recognized)

IPC_norm -- ジオコーディングレベルが6以上 --> norm_finalize[最終正規化レベル決定] %% ああ
IPC_norm -- ジオコーディングレベルが3-5 --> query_internal_banchigo[内部番地号DB問い合わせ]
IPC_norm -- エラー --> IPC_error_500(500レスポンス)
IPC_norm -- レスポンスがnull --> IPC_error_null(404レスポンス<br>address_not_verified)

query_internal_banchigo -- 番地号のデータが存在しない --> norm_finalize
query_internal_banchigo -- 番地号のデータが存在する --> 正規化結果を補完 --> norm_finalize

norm_finalize -- ジオコーディングレベルが6以上 --> ビル名抽出 --> issue_prop_id[不動産共通ID発行]
norm_finalize -- ジオコーディングレベルが5 --> issue_prop_id
norm_finalize -- ジオコーディングレベルが4 --> id_issue_error_4(400レスポンス<br>geo_koaza)
norm_finalize -- ジオコーディングレベルが3 --> id_issue_error_3(400レスポンス<br>geo_okaza)

issue_prop_id -- 最終正規化レベル6以下 --> addressPendingステータスを発行 --> id_issue_ok(200レスポンス)
issue_prop_id --> id_issue_ok
```
