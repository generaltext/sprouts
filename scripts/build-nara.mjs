#!/usr/bin/env node
// Convert a Nara Baby CSV export into a dev-only seed JSON for the Sprouts gt app.
// Node ESM, built-ins only. Run from the app dir: node scripts/build-nara.mjs [csvPath]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, '..');
const META_CSV =
  '/Users/travis/Dropbox/Workspace/proj_saltbark/proj_generalText/proj_gt-meta/planning/apps/sprouts/export_narababy_arthur_20260713.csv';

const CSV_PATH = process.argv[2] ? resolve(process.argv[2]) : META_CSV;
const OUT_PATH = resolve(APP_DIR, 'src/data/seed.dev.json');

const CHILD_ID = 'chi_ARTHUR';
const CHILD_NAME = 'Arthur';
const CHILD_COLOR = '#3f9d52';

// --- unit conversion (canonical: ml, grams, cm, seconds) ---
const FLOZ_ML = 29.5735;
const LB_G = 453.592;
const IN_CM = 2.54;
const r1 = (n) => Math.round(n * 10) / 10; // one decimal

function toMl(value, unit) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  const u = String(unit || '').toUpperCase();
  if (u === 'FLOZ') return r1(n * FLOZ_ML);
  return r1(n); // ML or blank -> assume ml
}
function toGrams(value, unit) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  const u = String(unit || '').toUpperCase();
  if (u === 'LB' || u === '') return Math.round(n * LB_G); // blank -> assume LB
  return Math.round(n); // grams
}
function toCm(value, unit) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  const u = String(unit || '').toUpperCase();
  if (u === 'IN') return r1(n * IN_CM);
  return r1(n); // CM or blank -> assume cm
}
function num(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// --- robust CSV parser: handles quoted fields with commas, newlines, and "" escapes ---
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  // strip BOM
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // flush final field/row if any content
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// --- ISO time helpers ---
function isoFromEpoch(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
function isoFromLocalString(s) {
  if (!s) return undefined;
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
function addSecondsIso(iso, seconds) {
  if (!iso || !Number.isFinite(seconds)) return undefined;
  return new Date(new Date(iso).getTime() + seconds * 1000).toISOString();
}

// --- read + parse ---
const raw = readFileSync(CSV_PATH, 'utf8');
const rows = parseCsv(raw);
if (rows.length === 0) throw new Error('empty CSV');
const header = rows[0];
const col = {};
header.forEach((name, idx) => {
  col[name] = idx;
});
const need = ['Type', 'Start Date/time', 'Start Date/time (Epoch)', 'Created By Caregiver'];
for (const name of need) {
  if (!(name in col)) throw new Error(`missing expected column: ${name}`);
}
const get = (rec, name) => {
  const idx = col[name];
  if (idx == null) return '';
  const v = rec[idx];
  return v == null ? '' : v.trim();
};

const skipped = [];
const children = [];
const logEvents = [];
let profileBirthDate = null;
let profileSex = 'u';
let earliestDate = null; // 'YYYY-MM-DD'
let runningIndex = 0;

function actorFrom(rec) {
  const name = get(rec, 'Created By Caregiver');
  if (!name) return null;
  return { id: 'seed_' + name.toLowerCase(), name };
}

for (let ri = 1; ri < rows.length; ri++) {
  const rec = rows[ri];
  const type = get(rec, 'Type');

  // Profile: capture birthDate/sex, then skip
  if (type === 'Profile') {
    const bd = get(rec, '[Profile] Birth Date');
    if (bd) profileBirthDate = bd.slice(0, 10);
    const sex = get(rec, '[Profile] Sex').toUpperCase();
    if (sex === 'MALE') profileSex = 'm';
    else if (sex === 'FEMALE') profileSex = 'f';
    else profileSex = 'u';
    continue;
  }

  // Skip empty/garbage rows (malformed / short / unknown type)
  const KNOWN = new Set([
    'Sleep',
    'Bottle Feed',
    'Pump',
    'Diaper',
    'Breastfeed',
    'Routine',
    'Growth',
    'Vaccine',
  ]);
  if (!KNOWN.has(type)) {
    // only note it if it looks like it had content (avoid empty trailing rows)
    const nonEmpty = rec.some((v) => v && v.trim() !== '');
    if (nonEmpty) skipped.push({ row: ri, type: type || '(empty)', preview: rec.slice(0, 3).join('|') });
    continue;
  }

  // Determine timestamp
  const epoch = get(rec, 'Start Date/time (Epoch)');
  let ts = isoFromEpoch(epoch);
  if (!ts) ts = isoFromLocalString(get(rec, 'Start Date/time'));
  if (!ts) {
    skipped.push({ row: ri, type, preview: 'no valid start time' });
    continue;
  }

  // Track earliest date for birthDate fallback
  const dateOnly = ts.slice(0, 10);
  if (!earliestDate || dateOnly < earliestDate) earliestDate = dateOnly;

  // id / subject key
  const activityKey = get(rec, '_activityKey');
  const key = activityKey || `idx${runningIndex++}`;
  const id = 'evt_' + key;
  const subject = 'ent_' + key;

  const data = { start: ts };

  if (type === 'Sleep') {
    data.kind = 'sleep';
    let end = isoFromEpoch(get(rec, '[Sleep] End Date/time (Epoch)'));
    if (!end) {
      const dur = num(get(rec, '[Sleep] Duration (Seconds)'));
      if (dur != null) end = addSecondsIso(ts, dur);
    }
    if (end) data.end = end;
  } else if (type === 'Bottle Feed') {
    data.kind = 'feed.bottle';
    const volDirect = toMl(get(rec, '[Bottle Feed] Volume'), get(rec, '[Bottle Feed] Volume Unit'));
    const bmVol = toMl(
      get(rec, '[Bottle Feed] Breast Milk Volume'),
      get(rec, '[Bottle Feed] Breast Milk Volume Unit'),
    );
    const fVol = toMl(
      get(rec, '[Bottle Feed] Formula Volume'),
      get(rec, '[Bottle Feed] Formula Volume Unit'),
    );
    let volumeMl;
    if (volDirect != null) volumeMl = volDirect;
    else if (bmVol != null || fVol != null) volumeMl = r1((bmVol || 0) + (fVol || 0));
    if (volumeMl != null) data.volumeMl = volumeMl;

    const bfType = get(rec, '[Bottle Feed] Type');
    let contents;
    if (bfType === 'Breast Milk') contents = 'breastmilk';
    else if (bfType === 'Formula') contents = 'formula';
    else if (bfType === 'Breast Milk Formula') contents = 'mixed';
    else {
      const hasBm = bmVol != null;
      const hasF = fVol != null;
      if (hasBm && hasF) contents = 'mixed';
      else if (hasF && !hasBm) contents = 'formula';
      else contents = 'breastmilk';
    }
    data.contents = contents;
  } else if (type === 'Pump') {
    data.kind = 'feed.pump';
    let end = isoFromEpoch(get(rec, '[Pump] End Date/time (Epoch)'));
    if (!end) {
      const dur = num(get(rec, '[Pump] Duration (Seconds)'));
      if (dur != null) end = addSecondsIso(ts, dur);
    }
    if (end) data.end = end;
    const leftMl = toMl(get(rec, '[Pump] Left Volume'), get(rec, '[Pump] Left Volume Unit'));
    const rightMl = toMl(get(rec, '[Pump] Right Volume'), get(rec, '[Pump] Right Volume Unit'));
    if (leftMl != null) data.leftMl = leftMl;
    if (rightMl != null) data.rightMl = rightMl;
  } else if (type === 'Diaper') {
    data.kind = 'diaper';
    const dType = get(rec, '[Diaper] Type');
    data.wet = /wet/i.test(dType);
    data.dirty = /dirty/i.test(dType);
    const color = get(rec, '[Diaper] Dirty Color');
    if (color) data.stoolColor = color.toLowerCase();
    if (get(rec, '[Diaper] Detail') === 'Blowout') data.blowout = true;
  } else if (type === 'Breastfeed') {
    data.kind = 'feed.breast';
    const leftSec = num(get(rec, '[Breastfeed] Left Duration (Seconds)'));
    const rightSec = num(get(rec, '[Breastfeed] Right Duration (Seconds)'));
    if (leftSec != null) data.leftSec = leftSec;
    if (rightSec != null) data.rightSec = rightSec;
    const endSide = get(rec, '[Breastfeed] End Side').toUpperCase();
    if (endSide === 'LEFT') data.lastSide = 'left';
    else if (endSide === 'RIGHT') data.lastSide = 'right';
    if (leftSec != null || rightSec != null) {
      const total = (leftSec || 0) + (rightSec || 0);
      const end = addSecondsIso(ts, total);
      if (end) data.end = end;
    }
  } else if (type === 'Routine') {
    data.kind = 'tummy';
    const label = get(rec, '[Routine] Routine');
    if (label) data.label = label;
  } else if (type === 'Growth') {
    data.kind = 'growth';
    const weightG = toGrams(get(rec, '[Growth] Weight'), get(rec, '[Growth] Weight Unit'));
    const heightCm = toCm(get(rec, '[Growth] Height'), get(rec, '[Growth] Height Unit'));
    const headCm = toCm(get(rec, '[Growth] Head Size'), get(rec, '[Growth] Head Size Unit'));
    if (weightG != null) data.weightG = weightG;
    if (heightCm != null) data.heightCm = heightCm;
    if (headCm != null) data.headCm = headCm;
  } else if (type === 'Vaccine') {
    data.kind = 'medicine';
    const med = get(rec, '[Vaccine] Vaccine');
    if (med) data.medName = med;
  }

  const note = get(rec, 'Note');
  if (note) data.note = note;

  logEvents.push({
    id,
    ts,
    actor: actorFrom(rec),
    type: 'entry.log',
    subject,
    data,
  });
}

// birthDate: prefer profile, else earliest activity date
const birthDate = profileBirthDate || earliestDate;

children.push({
  id: 'evt_child_create',
  ts: birthDate ? new Date(birthDate + 'T00:00:00Z').toISOString() : new Date().toISOString(),
  actor: null,
  type: 'child.create',
  subject: CHILD_ID,
  data: {
    name: CHILD_NAME,
    birthDate,
    sex: profileSex,
    color: CHILD_COLOR,
  },
});

const seed = {
  children,
  logs: {
    [CHILD_ID]: logEvents,
  },
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(seed, null, 2) + '\n', 'utf8');

// --- verification / report ---
const byKind = {};
for (const e of logEvents) {
  const k = e.data && e.data.kind ? e.data.kind : '(none)';
  byKind[k] = (byKind[k] || 0) + 1;
}

console.log('Wrote:', OUT_PATH);
console.log('children:', children.length);
console.log('entries:', logEvents.length);
console.log('birthDate:', birthDate, ' sex:', profileSex);
console.log('per-kind counts:');
for (const k of Object.keys(byKind).sort()) console.log('  ' + k + ': ' + byKind[k]);

console.log('\nfirst 5 ts values:');
for (const e of logEvents.slice(0, 5)) console.log('  ' + e.ts);

console.log('\nsample event per kind:');
const seen = new Set();
for (const e of logEvents) {
  const k = e.data.kind;
  if (seen.has(k)) continue;
  seen.add(k);
  console.log('--- ' + k + ' ---');
  console.log(JSON.stringify(e, null, 2));
}

if (skipped.length) {
  console.log('\nskipped rows (' + skipped.length + '):');
  for (const s of skipped) console.log('  row ' + s.row + ' [' + s.type + '] ' + s.preview);
} else {
  console.log('\nskipped rows: none');
}
