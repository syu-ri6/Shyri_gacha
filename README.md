# SHURI GACHA / Phase 1 🐰🎰

新規Next.jsサイトのPhase 1ソースコード。**まだ公開されていません。**

## 含まれる機能
- Google OAuth ログイン（設定後）
- REALITY表示名の登録・変更と変更履歴（管理者向けDB）
- 一時コードによるREALITY本人確認申請
- 管理者による申請一覧・承認・却下・チケット配布
- チケット残高、ホーム、待機画面、プロフィール、スマホ用ナビ

ガチャ抽選、SPショップ、コレクションの本機能はPhase 2以降。

## セットアップ
1. Node.js 20+ を準備して `npm install`。
2. Supabaseプロジェクトを作り、SQL Editorで `supabase/schema.sql` を実行。
3. Supabase AuthenticationでGoogleプロバイダーを有効化。Google Cloud側でOAuth同意画面とクライアントID/シークレットを設定し、Supabaseが案内するコールバックURLを登録。
4. Supabase AuthのSite URLとRedirect URLsに開発用 `http://localhost:3000`、公開後のサイトURLを設定。
5. `.env.example` を `.env.local` にコピーして値を設定。`ADMIN_EMAIL` は管理者本人のGoogleメールアドレスにする。
6. `npm run dev` を実行し `http://localhost:3000` を開く。
7. 管理者アカウントでGoogleログイン後 `/admin` から申請を確認。

## セキュリティ・運用
- `SUPABASE_SERVICE_ROLE_KEY` は絶対にブラウザ・GitHub・公開リポジトリへ置かない。
- 管理者操作はサーバーでGoogleアカウントの認証情報と `ADMIN_EMAIL` を検証。
- 本人確認は管理者がREALITY配信コメントと照合してから承認。コードを知っているだけでは自動承認しない。
- SQLのRLSでプロフィール・チケットの他人への参照を禁止。
- 現段階の管理APIは基本機能のみ。正式公開前に監査ログ、レート制限、本人確認コードの期限・再発行制限、チケット配布の重複防止、管理者権限管理を強化すること。
- 無料チケット配布と景品の扱いはREALITY規約・関連法令の確認後に運用開始すること。

## 未実装
イベント、抽選、天井、SP、音声、称号、アーカイブ、画像共有、通知など。画面の「COMING SOON」は意図したプレースホルダー。
