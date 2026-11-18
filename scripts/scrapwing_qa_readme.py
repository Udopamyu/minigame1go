#!/usr/bin/env python3
"""Write games/scrapwing/qa/README.md from the latest qa/results.json (run after verify_scrapwing.py)."""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
QA = ROOT / "games" / "scrapwing" / "qa"

SHOTS = [
    ("00_title.jpg", "公開版のタイトル画面（MINIGAME 1GO／SCRAPWING）"),
    ("01_fight_start.jpg", "戦闘開始。自機は画面下、敵とレティクルは中央"),
    ("10_cover_blocked.jpg", "敵が建物の陰：照準は灰色の斜線、敵マーカーは点線と◇。自機の背後の建物は半透明"),
    ("11_locked.jpg", "ロック中（オレンジの回転照準）で自動射撃"),
    ("20〜27_field_*.jpg", "8フィールド（荒野・砂原・雪山・山岳・市街地・川・スタジアム・夜間）"),
    ("30_weapons_sheet.jpg", "7武器の弾（パルス／散弾／レール／ミサイル／ニードル／バースト／スラグ）"),
    ("31_spread_dice_five.jpg", "スプレッド砲：サイコロの5の配置で飛ぶ5発"),
    ("40_finisher_win_sheet.jpg／44_finisher_lose_sheet.jpg", "約2秒の3D分解（勝利は白、敗北は暗転）"),
    ("41_loot.jpg／42_route_map.jpg／43_run_ended.jpg", "戦利品、ルート、ラン終了（既存の進行画面）"),
    ("45_menu_controls_help.jpg", "☰メニュー内の操作説明（開いている間は戦闘が止まる）"),
    ("50_boss_beam_telegraph.jpg", "ボスのビーム予告"),
    ("60_mobile_portrait.jpg／61_mobile_landscape.jpg", "スマホ縦・横の操作配置"),
    ("70_no_webgl_fallback_2d.jpg", "WebGL2が無い環境では2D戦闘で代替"),
]

LIMITS = [
    "実機（スマホ・GPU搭載PC）での試遊とFPS。指定の描画倍率1.5・自動解像度OFFは、この環境（ソフトウェア描画）では重い。公開版には調整パネルがないため、実機で重い場合は初期値の見直し（本人判断）が必要。",
    "10マス＋ボス＋エンドレスの通しプレイと難易度。自機の移動が1.5倍になったが、敵の速さ・命中・ダメージは2D版の数値のまま。",
    "2D版のステージギミック（電撃床・凍結・修理・回転刃）は3D戦闘では使っていない。",
    "レールランサーが遮蔽物を貫通するのは2D版の「壁を貫く」を引き継いだ例外ルール（本人確認待ち）。",
    "公開URL（GitHub Pages）での動作は未確認（未公開）。",
]


def main():
    r = json.loads((QA / "results.json").read_text(encoding="utf-8"))
    checks, ok = r["checks"], sum(c["ok"] for c in r["checks"])
    out = [f"# SCRAPWING v{r['version']}（公開ビルド）— 検証結果", "",
           f"`python scripts/verify_scrapwing.py` の出力（[results.json](results.json)）を要約したもの。**{ok}/{len(checks)} 項目合格**（所要 {r['seconds']} 秒）。"
           " 静的な公開前チェックは [release-preflight.json](release-preflight.json)（`python scripts/scrapwing_release_preflight.py`）。", "",
           "- 対象：公開用の `index.html`（調整パネルなし）。開発用の調整版（`--dev`）は生成できることだけを確認。",
           "- 環境：Headless Chrome＋SwiftShader（ソフトウェアのWebGL2）。PC 1280×720、スマホは390×844と844×390のタッチエミュレーション。",
           "- 時間は `__b3QA.step()` で1/60秒ずつ進めて判定しているため、テスト機のFPSに左右されない。`__b3QA` は自動テスト中（navigator.webdriver）だけ存在する。",
           "- これは**機能テスト**。実機スマホ・実GPUでの操作感とFPS、人が遊んだときの面白さ・難易度は**未確認**。", "",
           "## 項目", "", "| 結果 | ID | 内容 |", "| --- | --- | --- |"]
    out += [f"| {'✅' if c['ok'] else '❌'} | `{c['id']}` | {c['title']} |" for c in checks]
    ai = r.get("ai_fields") or {}
    if ai:
        out += ["", "## 敵AI（8フィールド × 20秒、自機は左右に動くだけで敵を追わない）", "",
                "距離は水平距離（p10／中央値／p90）。「張り付き」は距離180未満の割合、「静止」は0.5秒で10未満しか動かなかった割合。自機の移動速度は指定パラメータ（1.5倍）。", "",
                "| フィールド | 役割 | 距離 | 張り付き | 両機が画面内 | 横移動/0.5秒 | 静止 | 障害物数 |", "| --- | --- | --- | --- | --- | --- | --- | --- |"]
        for k, a in ai.items():
            d = a["dist_p10_p50_p90"]
            out.append(f"| {k} | {a['role']} | {d[0]}／{d[1]}／{d[2]} | {a['hug_lt180']:.0%} | {a['both_on_screen']:.0%} | {a['lateral_per_0.5s']} | {a['still_ratio']:.0%} | {a['obstacles']} |")
    out += ["", "## スクリーンショット（[screenshots/](screenshots/)）", "", "| ファイル | 内容 |", "| --- | --- |"]
    out += [f"| `{f}` | {t} |" for f, t in SHOTS]
    out += ["", "## 既知の制限・未確認", ""] + [f"- {x}" for x in LIMITS]
    (QA / "README.md").write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"wrote qa/README.md ({ok}/{len(checks)})")


if __name__ == "__main__":
    main()
