import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindRows,cloudDraft,promptFor,sourceLines,unresolvedCloudDraft,mergeReviewedRows} from './notes.js';
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

test('partial cloud review includes only shareable unresolved device cues',()=>{
  const notes='Q2: Fade the wash.\n\nPrivate: do not share the green room code\nAudio: Contact stage@example.org.\nStand by until the bell.';
  const device=bindRows('{"rows":[{"n":1,"department":"Lighting"}]}',sourceLines(notes),'device');
  const draft=unresolvedCloudDraft(device);
  assert.deepEqual(draft,[{n:4,text:'Audio: Contact [email].'},{n:5,text:'Stand by until the bell.'}]);
  const edited=[{n:4,text:'Audio: Confirm with the operator.'}];
  const cloud=bindRows('{"rows":[{"n":4,"department":"Audio"},{"n":1,"department":"Deck"},{"n":99,"department":"Props"}]}',edited,'cloud');
  const mixed=mergeReviewedRows(device,cloud);
  assert.deepEqual(mixed.map(r=>r.n),[1,3,4,5]);
  for(const i of [0,1,3]) assert.strictEqual(mixed[i],device[i]);
  assert.deepEqual([mixed[2].text,mixed[2].body,mixed[2].sharedText,mixed[2].department,mixed[2].route],
    [device[2].text,device[2].body,edited[0].text,'Audio','cloud']);
  assert.deepEqual(unresolvedCloudDraft(mixed),[draft[1]]);
  assert.deepEqual(unresolvedCloudDraft(bindRows('[]',sourceLines(notes))),[]);
  const unclassified=mergeReviewedRows(device,bindRows('[]',edited,'cloud'));
  assert.deepEqual(unresolvedCloudDraft(unclassified),[edited[0],draft[1]]);
  assert.equal(unclassified[2].route,'device');
  assert.equal(unclassified[2].text,device[2].text);
});
