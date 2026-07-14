# Sprouts

A calm, private baby log. Feeds, sleep, diapers, growth, milestones, logged in a
tap from either parent's phone, merging into one shared timeline. It starts as a
high-frequency newborn tracker and matures into a keepsake: the file *is* the baby
book, and it's yours forever.

- **Everything in a tap.** Bottle, breast, pump, sleep, diaper, tummy time,
  medicine, a milestone, a note. Live timers for feeds and naps (with a gentle
  "still going?" nudge if you doze off), and breastfeeding remembers the last side.
- **One log, two parents.** Everyone who opens the workspace logs to the same
  timeline in their own color, on their own phone, online or off. It syncs and
  merges cleanly, so there's no more "did you write down the 3am feed?"
- **The day at a glance.** Total sleep, feeds and volume, diaper counts, the
  longest stretch. A week view surfaces the rhythm as it settles in. Growth charts
  with WHO percentile bands for context. No predictions, no schedules to fail
  against, just the record.
- **More than one child.** Track siblings side by side; switch between them; each
  keeps their own log and their own poster.
- **A poster of the whole thing.** Turn months or years of logs into a print-ready
  image: a stacked day-by-day sleep chart, or a radial spiral of the first years.
  Beautiful enough to blow up and hang on the wall.
- **Yours forever, no account.** Everything is plain JSON-lines in your own
  workspace. It works offline, syncs across your devices, and under the app sandbox
  literally cannot phone home. Hand the file to your AI and ask "how did his sleep
  change after we moved him to his own room?" without this app in the loop.

## What it writes

- `v0/children.jsonl`: your children's profiles (name, birth date, sex).
- `v0/logs/<childId>.jsonl`: one append-only activity log per child. Nothing is
  ever rewritten in place, so it merges cleanly across every device that logs to
  it. Who logged each entry is recorded on the entry itself, so caregivers need no
  setup: opening the workspace and logging is all it takes.

## On predictions

Sprouts deliberately doesn't predict when your baby "should" sleep or eat. That
kind of prescriptive schedule is a well-known source of parental anxiety when real
life diverges from it. Sprouts shows you what actually happened, clearly, and lets
you draw your own conclusions.
