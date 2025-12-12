# quickshot

ローカルだけで動く、シンプルなAPIコール＆テスト用ツールです。ブラウザで `public/index.html` を開くだけで利用できます。

## 機能概要
- メソッド/URL/ヘッダー/ボディ(JSON & YAML) を直感的に編集
- YAML → JSON 変換、JSONの自動整形
- 入力内容の自動一時保存、書き出し/読み込み
- レスポンスの整形表示、エラー詳細の展開、結果のコピー/保存
- モックCRM(API・ドキュメント・認証付き)を Docker でワンコマンド起動
- モックCRMに対するスモークテストスクリプトを同梱

## 使い方
1. `public/index.html` をブラウザで開く。
2. メソッド・URL・ヘッダーを入力して「送信する」。
3. YAMLからJSONへ変換したい場合は「YAML → JSON 変換」タブで入力し、「YAMLをJSONに変換」を押下。
4. 入力内容は自動で一時保存されるので、ブラウザを閉じても復元できます。必要に応じて「入力内容を書き出し」「書き出しファイルを読み込む」でファイル保存/復元が可能です。
5. レスポンスは整形表示され、ヘッダー・エラー詳細は `details` で展開できます。「結果を書き出す」「コピー」で共有できます。

## モックCRMの起動
Docker が利用できる環境で次のコマンドを実行すると、認証付きAPIとドキュメントページが立ち上がります。

```bash
docker compose up --build mock-crm
```

- URL: `http://localhost:4000`
- ログイン: `POST /auth/login` に `{ "email": "admin@example.com", "password": "secret" }`
- 取得した `token` を `Authorization: Bearer mock-crm-token` として利用
- ドキュメント: `http://localhost:4000/docs`
- サンプルデータ: `mock-crm/data/seed.json`

## スモークテスト
モックCRMが起動している状態で実行します。

```bash
node tests/mockApiSmoke.js
```

成功すると、トークン・顧客件数・作成した顧客ID・ヘルスチェック結果が表示されます。

## フロントエンド構成
- `public/index.html` : UIと説明
- `public/styles.css` : シンプルな白/濃グレー基調のスタイル
- `public/app.js` : フォーム制御、YAML→JSON変換、fetch送信、保存/読み込み

## モックCRM構成
- `mock-crm/server.js` : ネイティブ`http`のみで動作するシンプルAPIサーバー (認証・サンプルデータ・CORS対応)
- `mock-crm/data/seed.json` : 初期データ
- `mock-crm/docs.html` : シンプルなドキュメントページ
- `mock-crm/openapi.yaml` : 参照用OpenAPIドキュメント
- `docker-compose.yml` : ワンコマンド起動用

ネットワークに接続できない環境でも、ブラウザとDockerさえあれば完結します。
