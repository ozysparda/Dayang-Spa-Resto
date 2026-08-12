import { db } from './src/db/index.js';
async function main() {
  const cols = await db.execute(`SELECT column_name FROM information_schema.columns WHERE table_name='treatment_transactions' ORDER BY ordinal_position`);
  console.log('treatment_transactions columns:', JSON.stringify(cols.rows));
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
