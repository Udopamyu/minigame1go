# 3チームの最小開発環境

共通ルールはルートの `AGENTS.md`。各AIセッションに共通ルールと
`teams/coordinator.md`、`teams/game.md`、`teams/video.md` の担当文書を渡す。
この構成は役割を分けたAIセッションとファイルによる受け渡しで動作する。
常駐AIサービスや外部APIは導入していない。

```text
統括AI: specs/<ID>.md に企画・合格基準
   ↓
ゲーム制作AI: games/<ID>/index.html + README + test-results.json
   ↓ テスト成功・ソースSHA256一致の場合だけ
動画制作AI: videos/<ID>/gameplay.mp4 + 台本 + 投稿草案 + 記録
   ↓
統括AI: runs/<ID>/latest.json に成果物の存在・SHA256・公開状態
   ↓
人間: 内容確認 → 公開URL確認 → Xに手動投稿
```

## 初回起動

必要環境: Python 3.10以上、Chromium、FFmpeg/ffprobe。

```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m playwright install --with-deps chromium
python scripts/pipeline.py --game tap-spark
```

システムChromiumがある場合はPlaywrightのブラウザ追加インストールは不要。
`CHROMIUM_EXECUTABLE=/usr/bin/chromium` で指定できる。FFmpegは別途システムに
インストールする。Ubuntu例: `sudo apt-get install ffmpeg chromium`。
ブラウザとローカルHTTPサーバーがソケットを使うため、実行環境のローカル通信許可が必要。
録画は実時間で約16秒、全体は通常30〜60秒。外部ゲーム素材・APIキーは不要。

ゲームを手動で試す場合:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

ブラウザで `http://127.0.0.1:8000/games/tap-spark/` を開く。
これはローカル確認URLであり、公開済みURLではない。

## 合否と再実行

- 統括スクリプトは開始時に前回の承認JSONを無効化する。
- ゲームで開始・得点・移動・キーボード・12秒終了・終了後加点停止・再挑戦・レスポンシブを確認する。
- ゲームテストが失敗した場合、動画工程は実行せず非ゼロ終了する。
- 動画側でも合格状態とソースSHA256を確認し、別バージョンのゲームは録画しない。
- 録画後にMP4と記録を検証し、統括が全成果物のSHA256を保存する。
- `passed_local` はローカル工程の合格。公開済み・人間確認済みという意味ではない。
- 失敗時は `runs/<ID>/latest.json` の `error` と工程別JSONを参照する。

動画フレームの一時保存は `.capture/` 内で行い、Gitには含めない。
動画は最小サンプルの成果物として保存する。作品が増えたら大容量動画は別の保管先を検討する。

## GitHubでの再確認

`.github/workflows/smoke.yml` はPR・push・手動実行で同じ統合検証を行い、
MP4とJSONをActionsの成果物として保存する。公開・デプロイ・X投稿は行わない。
Actionsの合否は実行結果を確認して判断する。ローカル実行だけでCI合格とは扱わない。

## 次作品

まず統括AIが新しい仕様を作る。現在の自動検証CLIは `tap-spark` 専用。
新IDのゲーム・DOM契約・検証・録画手順を追加し、対応IDを増やしてから運用する。
チーム間で同じファイルを同時編集せず、担当範囲を守る。
