# Winkle Study

NotionのStudy Logを読み取り、学習時間・教科の内訳・週の推移を振り返る個人用ダッシュボード。本人専用の記録作成に対応します。既存記録の更新・削除、AI API、集計用DBはありません。

## 日々の使い方

- **閲覧専用リンク**：ログイン後の「共有」からリンクを作成し、友達・家族へ渡せます。初期はオフ。リンクを知っている人はログインなしで学習時間・教科別の内訳・カレンダー・週目標と達成率を閲覧できます。勉強内容・単元・メモ・NotionのページIDやURL・時刻はサーバーで除外し、日別・教科別の合計だけを渡します。「作り直す」で以前のリンクを無効化、「共有を停止」で閲覧を停止。リンクは転送先でも使えるため、見せたい相手にだけ渡してください。共有ページは1分ごとと再表示時に取得し直し、Notionの通常5分キャッシュを利用します。共有停止後も、相手が既に見た内容を取り消すことはできません。
- **共有のデモ**：`/demo` の「共有を試す」、または `/demo/share` で架空データを使った共有画面を確認できます。実データの共有は有効になりません。
- **ファビコン**：淡い緑と光のモチーフ。SVG・16/32/48pxのICO・180pxのホーム画面用アイコンを用意しています。

共有設定は学習データの7日キャッシュと分けて永続保存します。Vercelでは既存Redis、ローカルでは既存の`CACHE_DIR`を利用し、追加サービスや新しいAPIキーは不要です。リンクの照合にはSHA-256ハッシュを使い、再表示用トークンは`NEXTAUTH_SECRET`から導出した鍵でAES-256-GCM暗号化して保存します。共有設定APIは本人ログインとOrigin検証で保護。閲覧用トークンは記録・目標・共有設定の変更権限になりません。共有ページはnoindex・no-store・no-referrerを指定します。

- **週の目標**：サイトの「目標を設定／目標を変更」から時間＋分で入力し、Notionへ保存します。表示中の週の月曜日をキーに、新規作成または既存の目標時間だけを更新。メモ・目標名は維持します。保存後は画面に即反映。Notionで直接変更した場合は「更新」または5分ごとの自動取得で反映します。未設定の週への自動引き継ぎはありません。同週の重複は警告し、保存を止めます。/demo は架空データ専用でNotionと接続せず、変更は再読み込みで戻ります。
- **記録する**：ポップアップで勉強内容・教科・終了日時・実績時間（時間＋分）を入力し、推定時間帯を確認してNotionに新規保存します。デモでは架空データに追加するだけです。本番は挿入権限と`NOTION_WRITE_ENABLED=true`が必要。通信結果が不明なときは再送せず、Notionで確認してください。[入力・安全策の設計](docs/recording-design.md)も参照。
- **前週・翌週**：今週は月曜から今日まで、過去週は月曜から日曜までを表示。比較対象も同じ日数です。「今週へ戻る」で復帰できます。
- **月間カレンダー**：月を移動でき、日付を選ぶと1日表示へ切り替わります。教科フィルターも反映し、0分の有効記録と未記録を区別します。
- **時間帯別グラフ（推定）**：Notionの「日付」で「時刻を含む」を有効にし、**学習の終了時刻**を入力します。終了時刻から「学習時間（分）」を差し引き、連続して勉強したと仮定した時間帯を推定。例：2:31・31分 → 2:00〜2:31。1時間の境目や午前0時で分割するため、日別/週別/カレンダー/1日表示の合計が一致します。日付のみは時間帯不明としてその日に集計。休憩は推定できません。日付範囲を入力した旧記録は、同日範囲なら終了側の時刻を使用し、複数日範囲は曖昧さを避けて除外します。1日表示で一部分だけ含む記録は、一覧に期間内の分数と元の実績を併記します。


Study Logのプロパティ型の変更は不要です。「単元」はプロパティ自体がなくても動作します。時刻の読み取りはオフセット付きISO日時と、`time_zone=Asia/Tokyo`のローカル日時に対応します。[Notion公式の日付仕様](https://developers.notion.com/reference/page-property-values#date)を参照。

## Notionの週目標との接続

作成済みデータソースIDは `0b01476e-9a67-4dfc-9f42-0928d2cab422`。項目は「目標名」title、「週の開始日」date、「目標時間（分）」number、「メモ」（現在の接続では「テキスト」）rich_text。目標時間は1〜10080分の整数、未入力は未設定です。月曜日を1週のキーとして過去週も取得し、同週の別ページを勝手に合算しません。

読み取りだけの運用ではRead contentのみ。サイトから新規作成する場合はInsert contentも必要です。週目標の変更にはUpdate contentも必要です。アクセス先はStudy Logと週の目標に限定します。初回は名前と型を検証してプロパティIDをキャッシュに保存し、表示名変更に耐えます。別環境では `NOTION_GOALS_DATA_SOURCE_ID` と、必要に応じて `NOTION_GOALS_PROPERTY_IDS`（week/target/memo）を指定してください。目標だけの取得失敗は明示し、Study Logの表示を継続します。認証・5分キャッシュ・7日保持は実績と共通です。

## 起動

Node.js 24、pnpm 11.25.0を使用します。Next.js 16.4.2 / React 19 / TypeScript / Tailwind CSS 4 / Recharts 3 / Notion公式SDK 5.27.1 / NextAuth 4.24.15。依存関係は`pnpm-lock.yaml`に固定しています。

```sh
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

- http://localhost:3000/ : 許可リストで保護された本番用入口。認証未設定時は設定待ち画面。
- http://localhost:3000/demo : 認証不要の架空データ。実接続失敗時にここへ自動切り替えしません。
- `pnpm build && pnpm start` : 本番モード。ビルド時の秘密情報は不要です。

`npm`がないCodexのWindows環境では、同梱の`C:/Users/kobud/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm.cmd`を`pnpm`の代わりに使えます。

## 環境変数

`.env.example`を`.env.local`へコピーし、ローカルエディターまたはホスティングのSecrets設定で入力します。トークンを会話・Git・NEXT_PUBLIC変数に貼らないでください。環境変数の変更後はアプリを再起動します。

|変数|内容|
|---|---|
|`NOTION_TOKEN`|必要なStudy Logのみを共有した、読み取り専用インテグレーションのトークン|
|`NOTION_DATA_SOURCE_ID`|省略時は確認済みのStudy Log。データベースIDとは別|
|`NOTION_PROPERTY_IDS`|任意。プロパティIDを固定するJSON。下記参照|
|`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`|Google OAuthウェブアプリの認証情報|
|`NEXTAUTH_SECRET`|32バイト以上のランダムな秘密値。`node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`等で生成し、秘密設定へ保存|
|`NEXTAUTH_URL`|開発時`http://localhost:3000`、本番時は自分のHTTPSオリジン|
|`ALLOWED_EMAILS`|本人のGoogleメール。カンマ区切り。空リストは全員拒否|
|`CACHE_DIR`|Node/Docker配置時の永続ストレージの絶対パス。開発時は`.cache/notion`。VercelではRedisを使用|
|`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`|Vercel用共有キャッシュのHTTPS REST URLと書込トークン。Marketplaceが設定する`KV_REST_API_URL` / `KV_REST_API_TOKEN`も使用可能|
|`PLAYWRIGHT_CHANNEL`|ローカルのインストール済みChromeを使うなら`chrome`。CIは未設定でChromiumを使用|

## Notion接続

2026-10-22に、指定された入口ページ配下の**Study Log**をコネクターで読み取り確認しました。Tasksではありません。現在の記録は0件で、実記録による合計照合は未実施です。コネクターの認証はこのアプリへ引き継がれません。

- Study Logデータベース: `3fda1dd3-1af8-8004-bae2-ede705a4b58f`
- Study Logデータソース: `3fda1dd3-1af8-805d-a7f0-000b32970193`
- 明示したNotion APIバージョン: **2026-03-11**

Notionで内部インテグレーションを作成し、読み取りだけの運用では**Read contentのみ**を有効化します。サイトから記録する場合は**Insert content**も有効にし、`NOTION_WRITE_ENABLED=true`を設定します。Update contentは不要です。保存用接続を分離する場合は`NOTION_WRITE_TOKEN`へ設定します。Study Logデータベースの「接続を追加」で、そのインテグレーションに必要なデータソースだけのアクセスを付与します。親ページ全体を共有してTasksなどへ権限を広げる必要はありません。トークンを`NOTION_TOKEN`へ保存します。既存の学習記録や構造は変更せず、週目標のみサイトから更新できます。

|アプリ項目|確認した表示名|REST APIの型|扱い|
|---|---|---|---|
|title|学習内容|title|空なら「無題の記録」|
|date|日付|date|作成日ではなく学習日。日付のみは移動しない|
|subject|科目|select|空なら「未分類」|
|duration|学習時間（分）|number|実績の分。計画時間は取得しない|
|unit|単元|rich_text|任意の内容。プロパティの存在・型は検証|

初回の直接API接続で実スキーマを取得し、表示名と型を検証してプロパティIDに解決します。以後は永続キャッシュのID対応を優先するため、表示名の変更に耐えます。Notionコネクターはすべての生プロパティIDを公開しないため、現時点で未取得のIDを捏造していません。

対応を変更する場合は、`NOTION_PROPERTY_IDS`に実際のIDを設定します。例（下記は書式で、実在IDではありません）：

```json
{"title":"title-id","date":"date-id","subject":"subject-id","duration":"minutes-id","unit":"unit-id"}
```

IDはNotion公式のRetrieve a data sourceレスポンスで確認できます。未指定時の初回表示名・型は`src/lib/notion-schema.ts`の`FIELDS`で変更します。単位を変える場合は、まず原本の単位を確認して明示的に変換コードとテストを修正してください。型の不一致は接続エラーになり、勝手な推定をしません。

100件ずつcursorをたどり、`request_status.type=incomplete`または10,000件上限を検出すると作成時刻の半開区間で再帰分割します。作成時刻は取得の分割にのみ使用し、集計には使いません。分割不能・cursor異常時は取得全体を失敗にし、不完全な合計を保存しません。必要な5プロパティだけを`filter_properties`で要求します。429/529と読み取りの一時5xxは最大3回再試行し、Retry-Afterを尊重します。60秒を超える待機が必要なら早期再試行せず失敗表示にします。

## Googleログイン

Google Cloud ConsoleでOAuth同意画面と**ウェブアプリケーション**のOAuthクライアントを用意し、本人をテストユーザーに追加します。リダイレクトURI：

```text
http://localhost:3000/api/auth/callback/google
https://YOUR_HOST/api/auth/callback/google
```

Googleの検証済みメールを確認し、ログイン時と全データAPIの両方で`ALLOWED_EMAILS`を完全一致で検証します。JWTセッションは12時間。公開ページやビルド成果物へNotionの記録を埋め込みません。`GET /api/study`と`POST /api/study`は未認証で401。POSTは正規Origin必須、cross-site拒否、30秒に1回まで。NextAuthの認証ルートはライブラリのCSRF処理を使います。

## 集計・画面

- Asia/Tokyo、月曜始まり。週比較は月曜〜今日と前週の同じ曜日まで。前週0分では増加率なし。
- 期間（今日・今週・今月・最大366日の任意期間）と教科でフィルター。上段カードは常に**今週**、下段の日別と教科は選択期間、週別推移は**直近8週間**。各カード・グラフに対象を明記。
- 同じNotionページIDは最新編集の1件だけ採用。未入力/不正/負数の実績時間、不正/空白の日付、複数日へまたがり配分できない日付範囲は除外して件数表示。明示的な0分は有効。問題件数は全取得期間を対象とする。
- 記録がない日は「未記録」。日別の表で確認可能。平均は記録日あたり。終了時刻がある記録だけ時間帯を推定し、日付のみの記録から時間帯を捏造しない。
- 教科の色は固定。追加の教科は名前のハッシュで安定した色にする。グラフの数値は表・合計・割合でも確認可能。
- デモには通常・未記録・同期エラー・不正データ警告の表示切り替えがあります。

## 永続キャッシュとデプロイ

**Node.js + 永続ローカルボリューム**と、**Vercel + Redis共有キャッシュ**に対応します。Notionが原本で、集計用DBは追加しません。Redisは再取得を抑えるための7日保持のキャッシュと、同時取得・更新頻度の制御、7日間の記録送信履歴に使います。

### Vercelへの配置

GitHubの`kobudai512-cpu/StudyLog`をVercelへインポートします。フレームワークはNext.js、Node.jsは24、設定は`vercel.json`を使用します。

1. Storage/MarketplaceでUpstash互換のRedisをプロジェクトへ接続。無料プラン等の条件を本人が確認し、有料プランは自動で有効化しません。
2. サーバー側環境変数へ、Notion・Googleの資格情報と許可メール、本番用NEXTAUTH_SECRETを登録。RedisのREST URLと書込トークンも上表の名前で設定します。これらにNEXT_PUBLICプレフィックスを付けません。
3. 本番ドメインのHTTPSオリジンを`NEXTAUTH_URL`へ設定し、Google OAuthクライアントに`https://本番ドメイン/api/auth/callback/google`を追加。
4. 環境変数を保存した後、再デプロイ。未認証のデータAPIが401となり、本人のログイン後に同期できることを確認します。

Vercel上でRedisが未設定なら実データの取得をエラーにし、ファイルやメモリーへ黙って切り替えません。Redis接続障害時も明確に失敗を表示します。キャッシュキーはデータソース/認証設定/production・preview環境ごとに分離します。60秒の所有権付きリースを15秒ごとに延長し、書き込みと所有権検証をLuaで原子的に実行します。期限切れのワーカーが新しい結果を上書きしたり、新しいロックを消したりしない設計です。

以下の永続ファイル方式はローカル/Node/Docker用です。

キャッシュは5分有効。プロセス間の同時取得はファイルロックで抑止します。ロックは10秒ごとにheartbeat、90秒途絶えたロックだけを回復します。原子的なファイル置換で、レコード・最終成功時刻・プロパティID対応・更新試行時刻を保存します。更新失敗時は前回成功データと時刻を表示し、初回取得失敗時は明確にエラー。秘密値はファイルに保存しません。キャッシュには個人の記録が入るので、アクセスをアプリ実行ユーザーに制限し、Gitや公開ディレクトリへ置かないでください。同時実行は同じローカルボリュームを共有する単一ホスト内に対応します。別ホストやNFS分散運用は対象外です。

Dockerが利用できるホストで：

```sh
# .env.localをホスト側で設定済みにする
docker compose up -d --build
# 停止
docker compose down
```

`compose.yaml`はloopbackの3000番だけにbindします。まずSSHトンネル等の非公開経路で確認し、本番は信頼するHTTPSリバースプロキシから接続します。`NEXTAUTH_URL`にHTTPSオリジンを設定し、Googleのcallback URIも一致させてください。TLSとホスティングの契約・課金は別途必要です。`study-cache`ボリュームを保持し、更新時に`docker compose down -v`を実行しないでください。イメージには`.env*`やローカルキャッシュを含めません。認証設定が欠けている状態は実データを提供しません。

Dockerなしでも`pnpm build`後、`CACHE_DIR`に実行ユーザー専用の永続ディレクトリを指定して`pnpm start`で実行できます。ポートはファイアウォールやプロキシで限定してください。

### Railwayへの配置

`railway.toml`でDockerビルドと`/api/health`の起動確認を指定しています。サービスは1台で動かし、永続ボリュームを`/data/notion`にマウントします。追加の集計DBは不要です。

1. Railwayの非公開プロジェクトを作成し、GitHubの`kobudai512-cpu/StudyLog`、`main`をソースに指定。
2. サービスへ永続ボリュームを1つ追加し、マウント先を`/data/notion`に設定。
3. 実行時変数へ`NOTION_TOKEN`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`ALLOWED_EMAILS`と本番用の`NEXTAUTH_SECRET`を設定。`CACHE_DIR=/data/notion`、`HOSTNAME=0.0.0.0`、`PORT=3000`を指定。必要なら`NOTION_DATA_SOURCE_ID`も設定。
4. RailwayのHTTPSドメインを発行し、そのオリジンを`NEXTAUTH_URL`へ設定。
5. Google OAuthクライアントの承認済みリダイレクトURIへ`https://発行されたドメイン/api/auth/callback/google`を追加。ローカル用URIは残せます。
6. デプロイ後に`/api/health`が200、未認証の`/api/study`が401になることを確認し、本人がGoogleログインして同期を確認。

新規ボリュームのマウント時はイメージ内の所有権が隠れるため、コンテナーの起動処理がキャッシュディレクトリの所有者を設定し、**UID/GID 1000へ権限を落としてから**サーバーを開始します。ホストで実行ユーザーを上書きする場合は、この初期設定を実行できることを確認してください。秘密設定とキャッシュをイメージへコピーしません。

アカウントの無料枠・クレジット・継続費用はRailway側で確認します。有料プランへの変更はこのリポジトリの設定では行いません。ドメイン自体は外部から到達できますが、個人の学習データはGoogleログインとメール許可リストで保護します。ヘルスチェックは稼働状態だけを返し、Notion・Googleの設定値や学習記録を返しません。

## 検証

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
# 本番サーバーを別ターミナルで起動してから
pnpm start
# 別ターミナル。初回のみChromiumを導入
pnpm exec playwright install chromium
pnpm test:browser
# インストール済みChromeを使う場合：PLAYWRIGHT_CHANNEL=chrome
```

ユニットテストは日付境界・月曜/年越し/閏日・期間・分/小数/欠損/重複・正規化・スキーマ変更・全ページ取得・上限分割・Retry-After・認証/Origin・永続キャッシュ/失敗時保持/頻度制限を検証します。PlaywrightはPC/スマホのデモ操作、横はみ出し、未認証GET/POST拒否を確認します。CIでも型・lint・ユニットテスト・本番ビルド・ブラウザテストを実行します。実トークン/Google資格情報を使うE2Eは別途本人の設定後に実行します。

現地での実行結果と残作業は`VERIFICATION.md`を参照してください。復習リスト・Tasks・カレンダー・睡眠・スマホ連携は未対応です。

## 参照した公式仕様

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Notion Query a data source](https://developers.notion.com/reference/query-a-data-source)
- [Notion API versioning](https://developers.notion.com/reference/versioning)
- [Notion request limits](https://developers.notion.com/reference/request-limits)
- [Google provider / verified email](https://next-auth.js.org/providers/google)

## 構成

`src/lib/study.ts`（集計）→`notion-schema.ts`（対応・正規化）→`notion.ts`（読取）→`store.ts`/`sync.ts`（永続化・同期）→`app/api/study`（認可）→`components/dashboard.tsx`（表示）。追加のデータ連携は独立したproviderとして追加できます。
