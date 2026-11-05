# MiniGame1GO: 4体の独立AIエージェント

これは役割を記したファイルだけではなく、OpenAI Agents SDK の `Agent` を**毎回実際に実行する**実装です。
各部門は独立したGitHub Actions workflowとPythonプロセスを持ち、それぞれ別のモデル呼び出しと担当権限を使用します。

## 4部門の実態

| AI | 起動するGitHub Actions | 専用メモリ兼メッセージボード | 実行する仕事 |
| --- | --- | --- | --- |
| 統括 | `agent-manager.yml` | [#4](https://github.com/Udopamyu/minigame1go/issues/4) | 他AIの報告を読み、仕事の優先順位を決める |
| ゲーム制作 | `agent-game.yml` | [#5](https://github.com/Udopamyu/minigame1go/issues/5) | ゲームのコードを調査・最大2箇所の改善、構文確認、レビュー用PR提出を試みる |
| ゲーム評価 | `agent-evaluation.yml` | [#6](https://github.com/Udopamyu/minigame1go/issues/6) | Playwright実ブラウザテストと独立した品質評価 |
| 動画制作 | `agent-video.yml` | [#7](https://github.com/Udopamyu/minigame1go/issues/7) | 評価通過した実プレイを録画・15秒MP4生成、演出と投稿草案を評価 |

AI同士はGitHub Issuesを**永続メッセージボード**として読み書きします。毎回の実行には直近の他部門ログを入力し、長期間のやりとりを参照できるようにしています。
エージェントは実際のモデルAPIを呼びます。`scripts/agents/autonomous.py` が唯一の実行プログラムですが、4つの**独立した実行プロセス**が各ロールを起動します。
自動生成したゲームや動画のX自動投稿とPR自動マージは禁止です。

## 起動条件

1. PR #2 をレビューし、テストと手動確認が済んだら `main` にマージする。スケジュール起動はdefault branch上のworkflowだけが対象です。
2. [OpenAI API の設定画面](https://platform.openai.com/api-keys) で専用APIキーを発行する。ChatGPT Plusの契約はAPI利用料を含みません。
3. [GitHub ActionsのSecrets](https://github.com/Udopamyu/minigame1go/settings/secrets/actions) で名前 `OPENAI_API_KEY` を登録する。**キーは会話やIssueに貼らない**。
4. OpenAI APIの課金上限・利用量アラートを低めに設定する。
5. [Actions](https://github.com/Udopamyu/minigame1go/actions) から `MiniGame1GO - Producer AI` を選び、`Run workflow` で初回起動する。実際にIssue #4へAIのレポートが書かれたことを確認する。
6. 他3部門も手動起動して、それぞれ専用Issueへレポートが残ることを確認する。

## 定期実行（日本時間）

火曜・金曜：
- 19:07 統括
- 19:17 ゲーム制作
- 19:31 ゲーム評価
- 19:45 動画制作

GitHub Actionsは**24時間走り続ける常駐サーバーではありません**。決まった時刻と手動起動時に個別エージェントが起動します。4体のログはGitHub Issuesに残り、個別ワーカーの入れ替え後も引き継がれます。

真の24時間常駐プロセスを希望する場合は、常時稼働ホスト上で本リポジトリの各エージェントを別プロセスとして動かす必要があります（追加費用や運用が必要）。
現段階でそのホストはプロビジョニングしていません。

## コストと安全

- 各エージェントの1回の思考は**最大5ターン**。モデルはゲーム制作 `gpt-6.1-terra`、その他 `gpt-6-luna` をデフォルトにする。GitHub Workflowの環境変数 `AI_MODEL` で変えられる。
- APIの実請求額はトークン使用量次第。GitHub ActionsやAPIは無料無制限ではない。
- 各エージェントは専用Issueに報告。ゲームAIの変更はPR経由でレビューを要し、公開ブランチを直接変更しない。
- 評価AIの24/24のような機械的な合格は**全10面クリア確認や面白さの保証ではない**。
- ゲームは無料、広告なし。X投稿は人間が行う。
- `OPENAI_API_KEY` がなければエージェントは**起動しない**。APIモデルを呼ばずに単なるスクリプトを動かした状態を「AIが動いた」と報告しない。

## トラブルシュート

- `OPENAI_API_KEY ... missing`: GitHubのSecretが未登録。
- `403 Resource not accessible`: Actionsの「Workflow permissions」を確認。コードPR自動作成にはActionsによるPR作成を許可する設定が必要な場合がある。許可できない場合でも評価ログはIssueとArtifactに残る。
- `model_not_found`: 契約で使えるモデル名を確認してworkflowの `AI_MODEL` を変更する。
- CI/録画失敗: ActionsのArtifactおよびtest-results.jsonを確認。実動画を作成できなかった場合は成功としない。
