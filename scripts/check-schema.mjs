/* Guards the one thing the drift check cannot catch itself: EXPECTED_COLUMNS
   drifting from the DDL. If they disagree, the admin panel either reports a
   healthy database as broken forever, or misses a genuinely missing column.
   Run: npm run schema:check */
import { SCHEMA_STATEMENTS, EXPECTED_COLUMNS, TABLES } from '../netlify/lib/schema.mjs';

let failures = 0;
const fail = m => { console.error('FAIL: ' + m); failures++; };

for (const table of TABLES) {
  const stmt = SCHEMA_STATEMENTS.find(s => s.name === table);
  if (!stmt) { fail(`no CREATE TABLE statement for ${table}`); continue; }

  const body = stmt.sql.slice(stmt.sql.indexOf('(') + 1, stmt.sql.lastIndexOf(')'));
  const declared = body
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('--'))
    .map(l => l.split(/\s+/)[0])
    .filter(c => !['primary', 'foreign', 'unique', 'check', 'constraint'].includes(c.toLowerCase()));

  const expected = EXPECTED_COLUMNS[table] || [];
  const missing = expected.filter(c => !declared.includes(c));
  const extra = declared.filter(c => !expected.includes(c));
  if (missing.length) fail(`${table}: EXPECTED_COLUMNS lists columns the DDL never creates: ${missing.join(', ')}`);
  if (extra.length) fail(`${table}: DDL creates columns EXPECTED_COLUMNS omits: ${extra.join(', ')}`);
  if (!missing.length && !extra.length) console.log(`ok  ${table} (${declared.length} columns)`);
}

if (failures) process.exit(1);
console.log('\nschema module is self-consistent');
