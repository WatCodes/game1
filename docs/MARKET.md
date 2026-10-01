# The Market

The Market replaced **the Works** (Feeder Balance, a Futoshiki puzzle board) on the
right rail in 1.0.3. It is the old **Arbitrage Desk**, moved out of the bottom of the
Agora and grown into a feature that earns its own slot.

Code: `src/engine/arbitrage.ts` (trading, orders, surge, upgrades),
`src/engine/market.ts` (price and demand index), and
`src/ui/components/MarketPanel.tsx`. The demand index and why the Market is not
gambling are covered in `GAME_DESIGN.md` §3.18.

## Why the Works went

Playtesters asked for the Works to be "more useful". It was optional, separate from
the economy, and once ~6 Auto-Solvers kept the Grid Surge lit it played itself. The
Market already sat on the economy's most interesting signal, the moving price. It
only lacked room on screen and a way to play it without staring at the chart.

## What the player does

| Control | What it does |
|---|---|
| **Store / Release** with 25% · 50% · ALL | Buy Watts into the battery at the live price, or sell them back. Partial releases keep the weighted cost basis. |
| **Standing orders** | "Store at or below X" and "release at or above Y". Each fires once as the price enters its zone, then re-arms only after the price leaves it. |
| **Battery Cells** (8 levels) | +50% capacity each: 90 s of generation → 450 s. |
| **Better Chemistry** (5 levels) | +1 point of round-trip efficiency each: 92% → 97%. Never 100%, so an instant flip always loses. |
| **Ledger** | The last 8 trades, wins/trades, net profit (losses included) and best trade. |

## Grid Surge is earned by profit

The Works' best hook was the Grid Surge (×1.5 power). It stays, but it is now lit by
**closing a trade at a profit**:

    surge seconds = SURGE_PROFIT_SECONDS × (watts / capacity) × (profit / cost basis)

capped at `SURGE_CAP_SECONDS`. Selling a full battery at +50% lights the full 300 s.

- **Profit, not price.** A surge for merely selling at a high price could be farmed by
  storing and releasing in the same instant: eat the round-trip loss and collect the
  surge. Profit only exists if the price really moved between the store and the
  release.
- **Share of capacity.** Ten small trades are worth exactly one big one, so splitting
  a trade earns nothing extra. A test checks this.

## Standing orders are online only

`tickOrders` runs in `loop.ts` and **not** in `creditOffline`. While you're away the
demand index settles to its mean instead of random-walking (§3.18), so an order that
"filled overnight" would be fiction. The panel says so ("WHILE YOU PLAY"). A test
checks that an away window never fills an order.

The **once per dip** rule matters. Without it, a buy order would fire every tick of a
dip and sweep every Credit the Sell rail earned into the battery. The two orders also
**cannot cross** (buy ≥ sell): `setOrder` refuses it, the steppers stop short, and
`hydrateDesk` drops the buy side of a crossed pair in a save. A crossed pair would
store and release at the same price, losing the round trip on every fill.

## It is still not gambling

Every property from §3.18 holds, and the age-rating answer (**Simulated Gambling →
None**) does not change:

- **No stake at risk.** You hold Watts. Orders spend only what fits in the battery.
- **No clock, no forced settlement.** With no orders set, ticking never touches the
  battery (tested). An order is the player's own rule, set and cleared at will.
  The engine never opens or closes a position on its own initiative.
- **No random payout.** Outcomes follow from when you act, or from your order prices.

If an order ever expires on a timer, or the engine ever trades without a player-set
rule, revisit `docs/APP_STORE.md` before shipping.

## Unlock

The Market opens with the Dispatch Board (`UNLOCK_BOARD_POWER`, 1 kW·s lifetime),
which is when the demand index starts moving. The desk used to wait until 25 kW·s.
Before the unlock, the rail button opens a progress card instead of hiding. The Works
used to fill that slot from minute one, and an empty slot would look broken.

## Live players (save v10)

- **Auto-Solvers are refunded** in full: every unit at the price it sold for
  (`legacySolverRefund`). This follows the same principle as v9, which refunded open
  futures stakes: nobody loses Credits when a feature is cut.
- The board, `solvers`, `solverProgress` and `stats.puzzlesSolved` are dropped by the
  migration.
- **The three Works records keep their ids** (`switchyard-cadet`,
  `master-electrician`, `self-playing`) and are redefined as trading records: Floor
  Trader (10 profitable trades), Market Maker (100), and Self-Playing (25 orders
  filled). Saves store earned ids, and each record is worth +1% output. New ids would
  have quietly removed that bonus from everyone who earned the old ones.
- `desk` is optional in `SaveData`. `hydrateDesk` defaults and clamps every field.

## Tuning knobs (`content/config.ts`)

`SURGE_PROFIT_SECONDS`, `SURGE_CAP_SECONDS`, `DESK_CELL_*`, `DESK_CHEM_*`,
`DESK_LOG_SIZE`, plus the existing `RESERVE_CAPACITY_SECONDS`, `RESERVE_EFFICIENCY`
and `INDEX_*`. `LEGACY_SOLVER_*` exists only for the refund. Don't reuse it.
