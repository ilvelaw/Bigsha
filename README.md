# Biqsha

Biqsha is a dig game. Pick a site, then find pieces in the sand before the sun sets. Scan marks what is buried, the trowel moves sand quickly, and the brush extracts a piece without cracking it. Finds are kept in the museum.

Three ways to play:

- **Play alone.** One trench, one player.
- **Pass the device.** Two names, one screen, taking turns.
- **1v1.** Two devices. One person creates a room. The other joins with the 4-letter code. Each digs their own trench. The higher score wins. A failed dig scores 0. The winner is named when both trenches close.

Open the game from the server address below. Opening `index.html` as a file skips the server, so 1v1, ranks, and the usability log do not work.

## Run

Node.js is required.

```bash
npm install
npm start
```

The server listens on port 8787 and prints:

- This PC: `http://localhost:8787`
- Same Wi-Fi: `http://<this-computer-ip>:8787` for a phone, a tablet, or a second laptop

Set `PORT` if 8787 is already in use.

## What is in this repo

| Path | What it is |
| --- | --- |
| `index.html` | The game. |
| `server.js` | Pages, sounds, piece images, 1v1 rooms, ranks, and the usability log. |
| `study.js` | Records taps, task time, and the errors the game already counts. |
| `gear.png` | Settings icon. |
| `items/` | Piece images. |
| `sounds/` | Dig, brush, and find sounds. |
| `logs/usability.jsonl` | Play log from the usability test. One JSON object per line. |
| `logs/ranks.json` | Leaderboard saved by the server. Optional. It contains player names. |
| `logs/jsonl-to-sql.js` | Builds `User_data.db` from `logs/usability.jsonl`. That database is generated and is not part of the repo. |
| `logs/jsontocsv.py` | Writes a CSV from the same log. |
| `usability-testing/` | Tester sheet, study outline, session notes, and before/after screenshots. |

`node_modules/` is installed by `npm install` and is not part of the repo.

## Usability test

Testers open the server address, set a test id in Settings (P1, P3, P5, P6), then follow `usability-testing/TESTER-SHEET.md`. The server appends each event to `logs/usability.jsonl`. Settings can also download the log stored on that device.

`usability-testing/Group-2-Usability-Testing.md` is the checked test report. The tables were counted from `logs/usability.jsonl`. `usability-testing/feedback-fixes.md` maps the written comments to the changes in the game.
