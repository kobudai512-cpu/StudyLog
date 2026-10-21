# 実行・検証結果

検証日：2026-10-22（Asia/Tokyo）。Windows、Node.js 24.19.0、pnpm 11.25.0、インストール済みGoogle Chromeを使用。

|項目|結果|
|---|---|
|依存関係導入|`pnpm install --frozen-lockfile` 成功|
|型チェック|`pnpm typecheck` 成功|
|lint|`pnpm lint` 成功、エラー・警告なし|
|集計・Notion・認証・キャッシュの単体テスト|`pnpm test`：4ファイル、49件成功|
|本番ビルド|`pnpm build` 成功。Notionの個人データを静的生成せず、動的ルートとして出力|
|本番起動|`pnpm start` のstandaloneサーバーを127.0.0.1:3000で起動し検証|
|ブラウザ|`PLAYWRIGHT_CHANNEL=chrome pnpm test:browser`：4件成功|
|PC/スマホ|1440×1000、390×844。スクリーンショットを目視確認。横はみ出しなし|
|操作|期間・教科フィルター、任意期間の入力検証、更新、未記録、同期エラー、不正データ警告をデモで確認|
|未認証API|本番サーバーのGET/POST `/api/study`とも401。データなし|
|Notionコネクター|指定入口からStudy Logのデータソース・プロパティ・分単位を確認。SQL集計で記録0件|
|実行中アプリからのNotion直接接続|未確認。NOTION_TOKENが未設定|
|Google OAuthログイン|未確認。本人のOAuth資格情報・許可メールが未設定|
|実データの照合|未実施。Study Logに記録がなく、実トークンも未設定|
|Dockerイメージ起動|未実施。この環境にDockerコマンドなし。Dockerfileとcompose設定を作成済み|
|ホストへのデプロイ|未実施。既存Sitesは0件、GitHubは空リポジトリ。互換性のある配置先の選択が必要|

ブラウザの初回テストでNext.js自身のroute-announcerとアプリのalertが同時に選択されるテスト用セレクターの曖昧さを修正し、全件を再実行しました。最終ビルドではファイルトレースの警告も解消し、秘密設定・キャッシュのビルド同梱を除外しています。

## 本人の残操作

1. Notionの読み取り専用インテグレーションをStudy Logだけへ接続し、トークンをローカル`.env.local`またはホストの秘密設定へ保存する。
2. Google OAuthウェブクライアントを用意し、callback URIと本人のテストユーザーを設定する。クライアント情報、NEXTAUTH_SECRET、NEXTAUTH_URL、ALLOWED_EMAILSを秘密設定に入力する。
3. 永続ボリューム対応のNode.js/Docker配置先を選ぶ。非公開の検証経路とCACHE_DIRを設定する。READMEの起動手順で配置できる。
4. 設定後にGoogleでログインし、実同期・更新・Notionの合計値との照合を行う。現時点ではStudy Logが空なので未記録表示が期待値。

トークンやシークレットをチャットに送る必要はありません。

## 接続設定後の確認とデプロイ作業

- ローカルの環境変数7項目の設定を、値を出力せずに確認済み。
- アプリと同じNotion取得処理で直接接続成功。実スキーマ一致、0件・不正0件・合計0分を確認し、同期キャッシュを保存。
- Google認証プロバイダーのAPIが200、ログインボタンを表示。実際の本人によるGoogle OAuth往復は未確認。
- Railwayアカウントへの接続成功。ただし2026-10-22のプロジェクト作成要求は`Deploys have been paused temporarily`で拒否。再取得したプロジェクト一覧も0件で、リソース作成・デプロイは未成立。
- [Railway公式ステータス](https://status.railway.com/)にAPI障害・ビルド停止を確認（参照時の最新告知は2026-10-21 13:40 UTC）。有料プランの有効化は行っていない。
- 再開用の`railway.toml`、非機密のヘルスチェック、ボリューム所有権設定後に権限を落とすコンテナー起動処理を追加。Docker起動確認をGitHub Actionsにも追加。

残作業はRailway復旧後のプロジェクト/サービス/ボリューム作成、本番の秘密変数設定、HTTPSドメイン発行、GoogleコールバックURL登録と本人ログイン確認。
