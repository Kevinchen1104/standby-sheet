import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindRows,cloudDraft,promptFor,sourceLines} from './notes.js';
test('removes private lines and masks contact details before review',()=>{
  const lines=cloudDraft('Private: booth code 4221\n\nAudio: Email desk@example.com or call +1 (212) 555-0198.\nDeck: use https://example.com/plan\n[PRIVATE] list');
  assert.deepEqual(lines,[{n:3,text:'Audio: Email [email] or call [phone].'},{n:4,text:'Deck: use [link]'}]);
  assert.doesNotMatch(promptFor(lines),/4221|555|example\.com/);
});
test('preserves source text, negation, and unclassified lines',()=>{
  const lines=sourceLines('Q12: Do not open the curtain until the bell.\n\nProps: Do we have a spare?');
  const rows=bindRows('{"rows":[{"n":1,"department":"Deck","body":"Open now!"},{"n":17,"department":"Audio"}]}',lines);
  assert.equal(rows.length,2);assert.equal(rows[0].body,'Do not open the curtain until the bell.');
  assert.equal(rows[1].n,3);assert.equal(rows[1].department,'Review');
});
test('handles duplicate, unknown or malformed model output',()=>{
  const lines=sourceLines('Stand by.');
  const model={rows:[{n:1,department:'Undefined'},{n:1,department:'Audio'},{n:1,department:'Props'}]};
  assert.equal(bindRows(JSON.stringify(model),lines)[0].department,'Audio');
  for(const bad of ['{}','<script>','null'])assert.throws(()=>bindRows(bad,lines));
});
test('enforces input limits and omits all-private drafts',()=>{
  assert.throws(()=>sourceLines('   '));assert.throws(()=>sourceLines('a'.repeat(4401)));
  assert.throws(()=>sourceLines(Array(25).fill('x').join('\n')));assert.deepEqual(cloudDraft('PRIVATE: all private'),[]);
});
test('isolated device document forbids network connections',()=>{
  const frame=readFileSync(new URL('local-frame.html',import.meta.url),'utf8');
  assert.match(frame,/connect-src 'none'/);assert.match(frame,/script-src 'self'/);
});
