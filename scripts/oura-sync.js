#!/usr/bin/env node
// Pulls Oura Ring data and writes it to oura-data.json + oura-data.js
// Usage: node scripts/oura-sync.js [days]
// Default: 90 days

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) throw new Error('.env not found');
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const { OURA_TOKEN } = loadEnv();
if (!OURA_TOKEN) throw new Error('OURA_TOKEN missing in .env');

const days = parseInt(process.argv[2] || '90', 10);
const end = new Date();
const start = new Date();
start.setDate(end.getDate() - days);
const fmt = (d) => d.toISOString().slice(0, 10);
const startStr = fmt(start);
const endStr = fmt(end);

const BASE = 'https://api.ouraring.com/v2/usercollection';
const headers = { Authorization: `Bearer ${OURA_TOKEN}` };

async function fetchAll(endpoint, params = {}) {
  const out = [];
  let next = null;
  do {
    const url = new URL(`${BASE}/${endpoint}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (next) url.searchParams.set('next_token', next);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${await res.text()}`);
    const json = await res.json();
    out.push(...(json.data || []));
    next = json.next_token || null;
  } while (next);
  return out;
}

console.log(`Syncing Oura data from ${startStr} to ${endStr}...`);

const dateParams = { start_date: startStr, end_date: endStr };
const datetimeParams = {
  start_datetime: `${startStr}T00:00:00-00:00`,
  end_datetime: `${endStr}T23:59:59-00:00`,
};

const [personal, sleep, dailySleep, readiness, activity, hr, spo2, stress] = await Promise.all([
  fetch(`${BASE}/personal_info`, { headers }).then((r) => r.json()),
  fetchAll('sleep', dateParams),
  fetchAll('daily_sleep', dateParams),
  fetchAll('daily_readiness', dateParams),
  fetchAll('daily_activity', dateParams),
  fetchAll('heartrate', datetimeParams).catch((e) => { console.warn('heartrate skipped:', e.message); return []; }),
  fetchAll('daily_spo2', dateParams).catch((e) => { console.warn('spo2 skipped:', e.message); return []; }),
  fetchAll('daily_stress', dateParams).catch((e) => { console.warn('stress skipped:', e.message); return []; }),
]);

const byDay = {};
const ensure = (day) => (byDay[day] ||= { date: day });

for (const r of dailySleep) {
  const d = ensure(r.day);
  d.sleepScore = r.score;
  d.sleepContributors = r.contributors;
}
for (const r of sleep) {
  if (r.type !== 'long_sleep') continue;
  const d = ensure(r.day);
  d.totalSleepSeconds = r.total_sleep_duration;
  d.timeInBedSeconds = r.time_in_bed;
  d.deepSleepSeconds = r.deep_sleep_duration;
  d.remSleepSeconds = r.rem_sleep_duration;
  d.lightSleepSeconds = r.light_sleep_duration;
  d.efficiency = r.efficiency;
  d.averageHRV = r.average_hrv;
  d.lowestHR = r.lowest_heart_rate;
  d.averageHR = r.average_heart_rate;
  d.averageBreath = r.average_breath;
  d.bedtimeStart = r.bedtime_start;
  d.bedtimeEnd = r.bedtime_end;
  d.latency = r.latency;
  d.restlessPeriods = r.restless_periods;
}
for (const r of readiness) {
  const d = ensure(r.day);
  d.readinessScore = r.score;
  d.temperatureDeviation = r.temperature_deviation;
  d.temperatureTrendDeviation = r.temperature_trend_deviation;
  d.readinessContributors = r.contributors;
}
for (const r of activity) {
  const d = ensure(r.day);
  d.activityScore = r.score;
  d.steps = r.steps;
  d.activeCalories = r.active_calories;
  d.totalCalories = r.total_calories;
  d.equivalentWalkingDistance = r.equivalent_walking_distance;
  d.highActivityMinutes = r.high_activity_time ? Math.round(r.high_activity_time / 60) : null;
  d.mediumActivityMinutes = r.medium_activity_time ? Math.round(r.medium_activity_time / 60) : null;
  d.lowActivityMinutes = r.low_activity_time ? Math.round(r.low_activity_time / 60) : null;
  d.sedentaryMinutes = r.sedentary_time ? Math.round(r.sedentary_time / 60) : null;
  d.activityContributors = r.contributors;
}
for (const r of spo2) {
  const d = ensure(r.day);
  d.spo2Average = r.spo2_percentage?.average ?? null;
}
for (const r of stress) {
  const d = ensure(r.day);
  d.stressHigh = r.stress_high;
  d.recoveryHigh = r.recovery_high;
  d.daySummary = r.day_summary;
}

const sorted = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));

const payload = {
  syncedAt: new Date().toISOString(),
  rangeStart: startStr,
  rangeEnd: endStr,
  daysCount: sorted.length,
  profile: {
    age: personal.age,
    biologicalSex: personal.biological_sex,
    heightMeters: personal.height,
    weightKg: personal.weight,
    email: personal.email,
  },
  days: sorted,
};

fs.writeFileSync(path.join(ROOT, 'oura-data.json'), JSON.stringify(payload, null, 2));
fs.writeFileSync(
  path.join(ROOT, 'oura-data.js'),
  `window.OURA_DATA = ${JSON.stringify(payload)};\n`
);

console.log(`Wrote ${sorted.length} days to oura-data.json and oura-data.js`);
const last = sorted[sorted.length - 1];
if (last) {
  console.log(`Latest day (${last.date}): sleep=${last.sleepScore} readiness=${last.readinessScore} activity=${last.activityScore} steps=${last.steps}`);
}
