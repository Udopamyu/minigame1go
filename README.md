# ミニゲーム1GO

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
