# PATROL × ROBO SALVAGE（3Dホバー戦闘）— 公開準備／判定記録

**候補版：v0.6.1 公開ビルド** ／ **PR：[#21](https://github.com/Udopamyu/minigame1go/pull/21)（draft、base: main）** ／ **公開状態：未公開**

2026-11-19の本人指示「調整ボタンを消して公開準備に移ろう」で作成。技術的な準備と「公開してよい」の判断を分ける。**本人の明示的な承認前に `main` へのマージ、GitHub Pages公開、X投稿をしない。** Xへの完全自動投稿はしない。

## リリース方式

- 無料・広告なし。単体HTML `games/patrol-robo-salvage/index.html` をGitHub Pagesで配信する。JavaScript/CSSは埋め込み済みで、外部CDN・画像サーバー・分析・アカウント連携なし（[静的チェック](../games/patrol-robo-salvage/qa/release-preflight.json)）。
- 予定URL：`https://udopamyu.github.io/minigame1go/games/patrol-robo-salvage/` — **未確認**。マージ後に実際に開いてから確定とする。
- 2D版（`games/robo-salvage/`）は変更しない。同じドメインで配信するため、永続進行のセーブ `roboSalvageMetaV1` は2D版と共有される（3D側で保存しても2D専用のリコシェット解放・初期武器設定は消さない。機能QA合格、実URLでは未確認）。
- 調整パネルは公開版にない。開発用の調整版は `python scripts/build_patrol_salvage.py --dev` で `dist/` に生成し、公開・コミットしない。
- PR #21 には引き継ぎ用のコミット（仕様書・参照HTML）も含まれる。マージすると Pages で `games/patrol-robo-salvage/reference/` の参照HTML（別プロジェクトの PATROL_Robo_Salvage v1.1、飛行調整ラボ、PATROL原型、v0.5原本）と `src/`・`qa/` もURLで開ける状態になる（リポジトリ自体は公開済みなので中身はすでに見える）。

## 公開ゲート

| 項目 | 状態 | 内容 |
| --- | --- | --- |
| 編集元と配布HTMLの一致・JS構文 | 合格 | `build_patrol_salvage.py --check`、`patrol_release_preflight.py`（13/13） |
| 公開版に調整UIがない | 合格 | ⚙・パネルなし、Tキー無効、保存済みの調整値を読まない、タブ名・タイトル・共有用説明文（`no_tuning_ui`・`public_title`） |
| ブラウザ機能QA（ソフトウェアWebGL2） | 合格 45/45 | [qa/README.md](../games/patrol-robo-salvage/qa/README.md)：操作・カメラ・ロック／射撃・遮蔽・敵AI 8フィールド・7武器・撃破演出・ボス・スマホ縦横・WebGL非対応時の2D |
| 通常入力での実プレイ（動画撮影の1戦） | 実施・勝利 | 新規セーブ・初期武器（パルス）・ルート画面のクリックで最初の戦闘（荒野）へ。キーボード入力のみ、HP等の変更なし。6.1秒で撃破、被弾はHP250中約8（[recording.json](../videos/patrol-robo-salvage/recording.json)）。1戦だけなので難易度の根拠にはしない |
| CI（GitHub Actions） | 追加済み・結果待ち | `.github/workflows/patrol-robo-salvage.yml`。最新コミットで成功を確認してからマージ |
| **人間による試遊・難易度評価** | **未完了** | 最初の数戦の強さ、ボス到達・撃破、操作の気持ちよさ、カメラ酔い |
| スマホ実機（縦・横） | 未確認 | スティックとボタンの重なり、誤タップ、発熱、描画倍率1.5の重さ |
| PC実機（実GPU） | 未確認 | 実GPUのfps（テスト環境はソフトウェア描画で約5fpsのため参考にならない）、マウス視点、音量 |
| 描画の重さへの逃げ道 | 要判断 | 指定値の描画倍率1.5・自動解像度OFFで固定。公開版には調整パネルがないため、実機で重ければ初期値（自動解像度ONなど）の変更を本人が判断する |
| レールランサーが遮蔽物を貫通する仕様 | 仮決定・本人確認待ち | 2D版の「壁を貫く」を継承。地形では止まる |
| ルート・戦利品・ショップ画面の文字量 | 要判断 | 2D版の進行画面をそのまま使用（戦闘画面は文字なし）。公開前に減らすかは本人判断 |
| 参照HTMLの置き場所 | 要判断 | 上記のとおりPagesで開ける。公開前に `games/` の外へ移すか、このままにするか |
| 紹介動画・X投稿草案 | 作成済み・視聴確認待ち | [videos/patrol-robo-salvage/](../videos/patrol-robo-salvage/)：縦1080×1920・約10.9秒・無音（MP4はGit管理外、`record_patrol_salvage.py`で再生成）。URLは公開確認後に記入 |
| 公開URLの実アクセス確認 | 未実施 | マージ後、PC・スマホで開いて起動・戦闘・保存を確認 |
| **最終的な公開承認** | **未取得** | 本人の確認後にのみマージ・公開 |

## 公開オペレーション（承認後）

1. PR #21 の最新コミットで Actions（PATROL x Robo Salvage QA）が成功していることを確認する。
2. 人間の試遊結果・重大な不具合がないこと・上の「要判断」2項目の決定を記録する。
3. 承認を得たら PR #21 を Ready for review にして `main` へマージする（マージ前の `main` のSHAを控える）。
4. Pages の反映を待ち、**公開URLを実際に開いて** PC・スマホで、起動→格納庫→ルート→戦闘→撃破演出→戦利品→ブラウザ再読み込み後の進行保持、2D版のセーブが壊れていないことを確認する。
5. 確認できたURLを README・投稿草案に記入し、[投稿履歴](post-history.md)に記録する。
6. 動画を視聴確認し、X投稿は本人が手動で行う（リンクはリプライ欄に置く運用。必ず伸びるという保証はない）。
7. 不具合が出たら別ブランチで修正し、検証→人間の確認→マージの順を守る。緊急時はマージコミットを revert する。

## 紹介文（草案）

**短い紹介**：低空をホバーで飛ぶロボで戦い、倒した敵のパーツを奪って組み替える無料ブラウザゲーム。7種の武器、8つのフィールド、分岐ルートとボス戦。

**公開URL：未確定。**

動画： [`videos/patrol-robo-salvage/script.md`](../videos/patrol-robo-salvage/script.md) ／ X草案： [`videos/patrol-robo-salvage/post-draft.md`](../videos/patrol-robo-salvage/post-draft.md)
