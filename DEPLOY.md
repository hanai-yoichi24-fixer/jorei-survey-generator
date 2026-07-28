# デプロイと更新のルール

## 正本とホスティング
- **正本は GitHub リモート。** ローカルは作業コピー（壊れても再clone で復旧）。
- **Vercel プロジェクトは 1 リポにつき 1 つ。create は一度きり。**
- 本番URLは production alias（`<project>-<team>.vercel.app`）を正本とする。per-deploy 固定URLは正本にしない。

## 更新のしかた（再create 禁止）
1. このリポを clone / pull する。
2. `index.html` を編集する（規制値は `KB` オブジェクト、看板プリセットは `PRESET`）。
3. `git push`（main）する → Vercel が自動で再デプロイ。
4. Cowork からは「条例調査表ジェネレーターを更新して」で `update-deploy` 経由の再デプロイが可能。

⚠️ **`deploy-app` をこの案件で再実行しない**（Vercel プロジェクトが重複作成される事故防止）。

## 構成
- 静的サイト（index.html のみ）。環境変数・バックエンド・DB なし。
- ビルド不要。Vercel は root の index.html をそのまま配信。
