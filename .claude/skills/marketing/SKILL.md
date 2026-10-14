---
name: marketing
description: Draft Electric Cats marketing posts (TikTok/Reels/Shorts scripts, Reddit posts, captions) into the Content Desk for Wyatt to review. Use for "draft this week's posts", "write a TikTok about X", the Monday marketing run, or anything about promoting the game.
---

# Electric Cats marketing

You draft. Wyatt approves and posts. **Never post, publish or send anything to a
social platform yourself**, and never mark a draft approved or posted. Those are
his calls.

## The Content Desk

Drafts live in the Content Desk artifact's database:
`https://claude.ai/artifact/RjcCfTRHKjcLpWbt9em1zT` (use the `ArtifactData` tool).

**`drafts/<id>`**: one post. Id format: `w<YYYY-MM-DD of the Monday>-<slug>`.

| field | meaning |
|---|---|
| `status` | `review` (new from you), `approved`, `posted`, `revise` (sent back with notes), `rejected` |
| `platform` | `tiktok` (one video for TikTok/Reels/Shorts), `reddit`, `instagram`, `x`, `discord` |
| `pillar` | `Walter`, `Satisfying`, `Dev log` or `Update` |
| `week` | e.g. `Oct 19` |
| `createdAt` | ISO timestamp |
| `title` | short internal name |
| `hook` | the first 2 seconds: the on-screen text or line |
| `script` | numbered shot list with timings and on-screen text |
| `caption`, `hashtags` | for video posts |
| `postTitle`, `body` | for Reddit and other text posts |
| `why` | one sentence on why this post, this week |
| `feedback` | Wyatt's notes when he sends one back (read-only for you) |
| `metrics` | `{views, likes, comments, installs}`, which Wyatt logs |

**`ideas/<id>`**: `{text, pillar, source: "claude"|"you", used}`. Wyatt's ideas
(`source: "you"`) go first.

## The weekly run (Mondays)

1. **Read** every draft and idea.
2. **Rewrite** each `revise` draft using its `feedback`, then set it back to
   `status: "review"`. Keep the feedback field so he can see what changed. Leave
   `rejected` drafts alone.
3. **Learn from results.** Compare `metrics` on posted drafts by pillar and
   platform. Do more of what got views and installs, and say so in `why`.
4. **Check what's new in the game:** `git log --since="8 days ago" --oneline` in
   `~/game1`, plus `docs/APP_STORE.md` and the live App Store page. Only promote
   features that are **live on the App Store**, not just merged.
5. **Draft 3 posts** with `status: "review"`, rotating pillars. At most one
   Reddit post a month, and only for real updates. Mark the ideas you used as
   `used: true`. Add 3 or more fresh ideas whenever fewer than 8 unused remain.
6. Write everything in **one batch**, pinning `if_version` on existing documents.
7. Tell Wyatt in two lines: what's new to review, and anything you learned from
   the numbers.

## Voice

- Plain, warm, a little dry. A student solo dev who loves his cat, never a brand.
- **Lead with Walter**, Wyatt's real tuxedo cat and the reason the game exists.
  He's in the game as a pokeable tuxedo cat. That story is the hook.
- Short sentences. Captions under 150 characters. Hooks under 8 words.
- No hype words (insane, addictive, game-changing). No fake urgency. No
  engagement bait ("comment if…" asking for something unrelated).
- Hashtags: 4–6, mixing broad (#indiegame #gamedev) and niche (#idlegame
  #incremental #catsoftiktok).

## Facts you may state (verify anything else in the repo first)

- **Electric Cats: Idle Tycoon**, free on iPhone only:
  https://apps.apple.com/us/app/electric-cats-idle-tycoon/id6795242247
- An idle game about cats who steal Zeus's lightning and climb the Kardashev
  scale. The ages run Athens → Colonies → Dominion → Ascent → Helios → Erebus →
  Constellations → Aether.
- **No in-app purchases.** The only ads are optional rewarded videos, and if
  one won't load you get the bonus anyway. No account, no data collection.
- Features: the Dispatch Board (sell, build or power the grid), the Market
  (store power cheap and sell it high, standing orders, profit lights the ×1.5
  Grid Surge), Wonders, ascension and Kardashev Points, research, offline
  progress, and Game Center leaderboards (Kardashev Points, Ascension Level).

**Never claim:** "no ads", "no forced ads" (that promise was removed in 1.0.1),
Android, Mac or web availability, player counts, ratings or rankings you haven't
read live today, or features that aren't on the App Store yet.

**The Market is not gambling.** Never describe it as betting, wagering or
gambling. Apple rejected 1.0 over a gambling declaration (see
`docs/APP_STORE.md`). It's storing power and choosing when to sell.

## Platform notes

- **TikTok / Reels / Shorts:** one vertical video, 10–20 s, posted to all three.
  Real phone screen recordings beat edited trailers. Text on screen, because
  most people watch muted. The first frame has to make sense on its own.
- **Reddit (r/incremental_games):** dev-honest, specific about mechanics, asks
  for feedback, discloses solo dev and monetization. Remind Wyatt to check the
  subreddit's self-promotion rules that day and to reply to comments for the
  first few hours.
- **Instagram feed and X:** reuse the video. Rewrite the caption for the
  platform rather than copying the TikTok one.
