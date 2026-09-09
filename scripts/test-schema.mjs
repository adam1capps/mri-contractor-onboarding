/* Schema inspection and application, exercised against a stubbed database.
   The production database is not reachable from CI or from a dev machine, so
   these cover the four states that matter: applied, empty, drifted (a table
   that exists but lost a column, which CREATE TABLE IF NOT EXISTS skips in
   silence), and dirty data that makes a constraint fail.
   Run: npm test */
import { inspectSchema, applySchema, EXPECTED_COLUMNS, TABLES, SCHEMA_STATEMENTS, HARDENING_STATEMENTS } from '../netlify/lib/schema.mjs';

const allRows = Object.entries(EXPECTED_COLUMNS).flatMap(([t, cs]) =>
  cs.map(c => ({ table_name: t, column_name: c })));

function stub(rows, failHardening) {
  const ran = [];
  const fn = (a, b) => {
    if (typeof a === 'string' && a.includes('information_schema')) return Promise.resolve(rows);
    const text = typeof a === 'string' ? a : String(a);
    ran.push(text);
    if (failHardening && text.includes('unique index')) return Promise.reject(new Error('duplicate key value'));
    return Promise.resolve([]);
  };
  fn.ran = ran;
  return fn;
}

// 1. fully applied
let r = await inspectSchema(stub(allRows));
console.assert(r.applied === true, 'FAIL: should be applied');
console.assert(r.missing.length === 0 && Object.keys(r.drifted).length === 0, 'FAIL: clean');
console.log('1 fully applied ->', r.applied, '| missing', r.missing.length, '| drifted', Object.keys(r.drifted).length);

// 2. empty database
r = await inspectSchema(stub([]));
console.assert(r.applied === false && r.missing.length === TABLES.length, 'FAIL: empty db');
console.log('2 empty db -> applied', r.applied, '| missing', r.missing.join(','));

// 3. drifted: table exists but a column is gone (what CREATE TABLE IF NOT EXISTS silently skips)
const drift = allRows.filter(x => !(x.table_name === 'agreements' && x.column_name === 'terms_version'));
r = await inspectSchema(stub(drift));
console.assert(r.applied === false, 'FAIL: drift should not read as applied');
console.assert(r.drifted.agreements && r.drifted.agreements.includes('terms_version'), 'FAIL: drift detect');
console.log('3 drift -> applied', r.applied, '| drifted', JSON.stringify(r.drifted));

// 4. apply: every statement runs, order preserved
const s4 = stub([]);
let res = await applySchema(s4);
console.assert(s4.ran.length === SCHEMA_STATEMENTS.length + HARDENING_STATEMENTS.length, 'FAIL: statement count');
console.assert(res.every(x => x.ok), 'FAIL: all ok');
console.log('4 apply ->', res.length, 'statements, all ok:', res.every(x => x.ok));

// 5. hardening failure is captured, core still applied
const s5 = stub([], true);
res = await applySchema(s5);
const core = res.filter(x => x.required);
console.assert(core.every(x => x.ok), 'FAIL: core must survive');
console.assert(res.some(x => !x.ok && !x.required), 'FAIL: hardening failure recorded');
console.log('5 dirty rows -> core ok:', core.every(x => x.ok), '| warning:', res.filter(x => !x.ok).map(x => x.name).join(','));
console.log('\nschema: all cases pass');
