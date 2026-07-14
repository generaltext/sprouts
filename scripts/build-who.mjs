#!/usr/bin/env node
// Build compact WHO Child Growth Standards LMS tables for the Sprouts app.
//
// Produces src/data/who.json with, per measure (weight / length / head) and
// per sex (m / f), one LMS row per whole month of age 0..60:
//   { age, l, m, s }
// where any percentile / z-score follows the WHO LMS model:
//   value(z) = M * (1 + L*S*z)^(1/L)   (L != 0)
//   value(z) = M * exp(S*z)            (L == 0)
//
// Source: WHO Child Growth Standards (2006), z-score expanded tables, as
// mirrored in JSON by the pygrowup project. Each row carries the official
// L (Box-Cox power), M (median), S (coefficient of variation) columns.
//   https://github.com/ewheeler/pygrowup  (pygrowup/tables/*.json)
//
// Units: weight M in kg, length/height & head circumference M in cm.
// The length-for-age file (lhfa) already stitches recumbent length (0-24 mo)
// with standing height (24-60 mo), matching the WHO length/height-for-age
// standard.
//
// Run from the app dir:  node scripts/build-who.mjs   (or: pnpm who)

import { writeFile, mkdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(__dirname, '..');
const OUT_PATH = join(APP_DIR, 'src', 'data', 'who.json');

const RAW_BASE =
  'https://raw.githubusercontent.com/ewheeler/pygrowup/master/pygrowup/tables/';

// measure -> sex -> source filename (all cover ages 0..60 months = 0-5 years)
const SOURCES = {
  weight: { m: 'wfa_boys_0_5_zscores.json', f: 'wfa_girls_0_5_zscores.json' },
  length: { m: 'lhfa_boys_0_5_zscores.json', f: 'lhfa_girls_0_5_zscores.json' },
  head: { m: 'hcfa_boys_0_5_zscores.json', f: 'hcfa_girls_0_5_zscores.json' },
};

const MAX_MONTH = 60;

// Round to a fixed number of significant figures, keeping numbers compact.
function sig(x, n) {
  if (x === 0) return 0;
  const d = Math.ceil(Math.log10(Math.abs(x)));
  const power = n - d;
  const factor = Math.pow(10, power);
  return Math.round(x * factor) / factor;
}

async function fetchTable(filename) {
  const url = RAW_BASE + filename;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> HTTP ${res.status}`);
  return res.json();
}

// Extract { age, l, m, s } rows for months 0..60 from a pygrowup table.
function extractLms(rows) {
  const byMonth = new Map();
  for (const r of rows) {
    const age = Number(r.Month);
    if (!Number.isInteger(age) || age < 0 || age > MAX_MONTH) continue;
    if (byMonth.has(age)) continue;
    const l = Number(r.L);
    const m = Number(r.M);
    const s = Number(r.S);
    if (![l, m, s].every(Number.isFinite)) {
      throw new Error(`non-numeric LMS at month ${age}: ${JSON.stringify(r)}`);
    }
    byMonth.set(age, {
      age,
      l: sig(l, 4),
      m: sig(m, 5),
      s: sig(s, 5),
    });
  }
  const out = [];
  for (let age = 0; age <= MAX_MONTH; age++) {
    if (!byMonth.has(age)) throw new Error(`missing month ${age}`);
    out.push(byMonth.get(age));
  }
  return out;
}

// ---- LMS math (used only for verification) ----
function valueAtZ(l, m, s, z) {
  if (Math.abs(l) < 1e-9) return m * Math.exp(s * z);
  return m * Math.pow(1 + l * s * z, 1 / l);
}
// z-scores for a few reference percentiles (standard normal quantiles)
const Z = { p3: -1.88079, p50: 0, p97: 1.88079 };

async function build() {
  const source = 'fetch';
  const data = { ageUnit: 'months' };
  let totalRows = 0;

  for (const [measure, sexes] of Object.entries(SOURCES)) {
    data[measure] = {};
    for (const [sex, file] of Object.entries(sexes)) {
      const rows = await fetchTable(file);
      const lms = extractLms(rows);
      data[measure][sex] = lms;
      totalRows += lms.length;
    }
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(data) + '\n');

  return { source, totalRows };
}

// ---- Verification against known WHO anchors ----
async function verify() {
  const json = JSON.parse(await readFile(OUT_PATH, 'utf8'));

  const rowAt = (measure, sex, age) =>
    json[measure][sex].find((r) => r.age === age);
  const medianAt = (measure, sex, age) => rowAt(measure, sex, age).m;

  const checks = [];
  const approx = (label, actual, expected, tol) =>
    checks.push({
      label,
      actual: Number(actual.toFixed(3)),
      expected,
      pass: Math.abs(actual - expected) <= tol,
    });

  approx('boys weight P50 @0mo (kg)', medianAt('weight', 'm', 0), 3.3, 0.1);
  approx('boys weight P50 @12mo (kg)', medianAt('weight', 'm', 12), 9.6, 0.15);
  approx('boys weight P50 @24mo (kg)', medianAt('weight', 'm', 24), 12.2, 0.15);
  approx('girls weight P50 @0mo (kg)', medianAt('weight', 'f', 0), 3.2, 0.1);
  approx('girls weight P50 @12mo (kg)', medianAt('weight', 'f', 12), 8.9, 0.15);
  approx('boys length P50 @0mo (cm)', medianAt('length', 'm', 0), 49.9, 0.2);
  approx('boys length P50 @12mo (cm)', medianAt('length', 'm', 12), 75.7, 0.3);
  approx('boys head P50 @0mo (cm)', medianAt('head', 'm', 0), 34.5, 0.2);
  approx('boys head P50 @12mo (cm)', medianAt('head', 'm', 12), 46.1, 0.3);

  // Boys weight @12mo: P3 / P50 / P97 via the LMS formula.
  const bw12 = rowAt('weight', 'm', 12);
  const p3 = valueAtZ(bw12.l, bw12.m, bw12.s, Z.p3);
  const p50 = valueAtZ(bw12.l, bw12.m, bw12.s, Z.p50);
  const p97 = valueAtZ(bw12.l, bw12.m, bw12.s, Z.p97);
  checks.push({
    label: 'boys weight @12mo ordering P3<P50<P97',
    actual: `${p3.toFixed(2)} < ${p50.toFixed(2)} < ${p97.toFixed(2)}`,
    expected: 'strictly increasing',
    pass: p3 < p50 && p50 < p97,
  });
  approx('boys weight P3 @12mo (kg)', p3, 7.7, 0.2);
  approx('boys weight P97 @12mo (kg)', p97, 12.0, 0.3);

  return checks;
}

function printChecks(checks) {
  const w = Math.max(...checks.map((c) => c.label.length));
  console.log('\nVerification against WHO anchors:');
  console.log('-'.repeat(w + 40));
  for (const c of checks) {
    console.log(
      `${c.pass ? 'PASS' : 'FAIL'}  ${c.label.padEnd(w)}  got ${String(
        c.actual
      ).padEnd(24)} exp ${c.expected}`
    );
  }
  console.log('-'.repeat(w + 40));
}

const { source, totalRows } = await build();
console.log(`Wrote ${OUT_PATH}`);
console.log(`Source: ${source} (${RAW_BASE})`);
console.log(
  `Rows: ${totalRows} total = 3 measures x 2 sexes x 61 months (0..${MAX_MONTH})`
);

const checks = await verify();
printChecks(checks);

const failed = checks.filter((c) => !c.pass);
if (failed.length) {
  console.error(`\n${failed.length} check(s) FAILED.`);
  process.exit(1);
}
console.log('\nAll checks passed.');
