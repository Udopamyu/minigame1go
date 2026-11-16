# ミニゲーム1GO

## 開発指示の引き継ぎ

次の開発は [AGENTS.md](AGENTS.md) と [共通開発方針](docs/game-development-guide.md) から開始してください。過去の本人指示を統合し、同じ条件を再説明しなくてよいように整理しています。

- 作品仕様：[二重振り子ブランコ靴飛ばし](specs/swing-shoe.md)／[投石機研究所](specs/catapult.md)／[ロボサルベージ](specs/robo-salvage.md)
- [決定・置換履歴](docs/game-decisions.md)／[新作企画テンプレート](specs/new-game-template.md)
- 投石機は公開済み・開発終了。継続開発の主軸はロボ2D、3D TPSは別路線。

以下の初期セットアップ・公開準備の記述には過去時点の状態が含まれます。現在の開発方針は上の指示書、公開状況は最新の実行記録を参照してください。

無料・広告なしのブラウザゲームを、統括AI・ゲーム制作AI・動画制作AIが連携して制作する最小環境。
共通ルールは [AGENTS.md](AGENTS.md)、役割と起動手順は [開発手順](docs/team-workflow.md)。

```sh
python -m pip install -r requirements-dev.txt
# ChromiumとFFmpeg/ffprobeが必要。詳しくは開発手順を参照。
python scripts/pipeline.py --game tap-spark
```

最初の作品は [TAP SPARK](games/tap-spark/index.html)。12秒で光をタップするゲーム。
検証は「ゲームの実ブラウザテスト → 実プレイ録画 → 統括確認」の順に実行する。

- [企画・合格基準](specs/tap-spark.md)
- [ゲーム操作](games/tap-spark/README.md)
- [ゲームテスト結果](games/tap-spark/test-results.json)
- [実プレイ動画](videos/tap-spark/gameplay.mp4)
- [台本](videos/tap-spark/script.md) / [X投稿草案](videos/tap-spark/post-draft.md)
- [統合実行結果](runs/tap-spark/latest.json)

公開URLは未設定。ローカル合格後も、動画の人間確認・ゲーム公開・X投稿は別工程として記録する。

## 公開準備中の作品

- [#003 ロボ・サルベージ（公開候補）](games/robo-salvage/index.html) — ロボットの装備を奪って戦うローグライト。現時点では開発ブランチのため未公開。
- [公開チェックリスト](docs/robo-salvage-release-checklist.md) ／ [試遊と操作説明](games/robo-salvage/README.md)
