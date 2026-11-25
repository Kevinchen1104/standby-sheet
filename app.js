import {example, sourceLines, cloudDraft, bindRows, unresolvedCloudDraft, mergeReviewedRows, isPrivate} from './notes.js';
import {sortReviewed} from './cloud.js';
import setup from './runtime-config.js';

const el=id=>document.getElementById(id);
const frame=el('local-worker'), notes=el('notes'), state=el('status');
let sheet=[], working=false, localReady=false, requestID=0, localTask, reviewingUnresolved=false;
function connection(){ el('network').textContent=navigator.onLine?'Online':'Offline'; }
connection();
window.addEventListener('online',connection);
window.addEventListener('offline',connection);
function setStatus(text){state.textContent=text;}
function controls(){
  el('device').disabled=working || !localReady;
  for(const id of ['review','example','unresolved']) el(id).disabled=working;
  notes.readOnly=working;
  el('print').disabled=!sheet.length || working;
}
function showSheet(rows,label) {
  sheet=rows;
  const list=el('rows');list.replaceChildren();
  for (const row of rows) {
    const li=document.createElement('li'), meta=document.createElement('div'), key=document.createElement('b'),
      dept=document.createElement('small'), body=document.createElement('div'), source=document.createElement('button');
    meta.className='meta';key.textContent=row.label;dept.textContent=row.department;meta.append(key,dept);
    body.className='cue-body';body.textContent=row.body;
    source.className='evidence-link';source.textContent='L'+row.n;source.setAttribute('aria-label','Read source line '+row.n);
    source.onclick=()=>{
      el('evidence-title').textContent='Source line '+row.n;el('evidence-text').textContent=row.text;
      const shared=el('evidence-shared');
      shared.hidden=row.sharedText===undefined;
      shared.textContent=shared.hidden?'':'Sent to Google for classification: '+row.sharedText;
      el('evidence-context').textContent=!shared.hidden
        ? (row.route==='cloud'?'Original booth note. Google supplied the department.':'Original booth note. Google returned no department.'):
        row.route==='cloud'?'This is the reviewed text that was sent to Google.':
        row.route==='device'?'Classified on this device. The text comes from the booth notes.':'Verbatim from the example notes.';
      el('evidence').showModal();
    };
    li.append(meta,body,source);list.append(li);
  }
  const available=unresolvedCloudDraft(rows).length;
  el('unresolved').hidden=available===0;
  el('unresolved').textContent=available===1?'Review 1 unresolved cue for cloud':`Review ${available} unresolved cues for cloud`;
  el('provenance').textContent=label;controls();
}
function loadExample() {
  notes.value=example;
  const rows=bindRows('{"rows":[{"n":1,"department":"Lighting"},{"n":2,"department":"Audio"},{"n":3,"department":"Props"}]}',sourceLines(example));
  showSheet(rows,'Prewritten example sheet');setStatus('Ready. Choose where to process your notes.');
}
el('example').onclick=loadExample;
notes.addEventListener('input',()=>{showSheet([],'Notes changed, ready to process');setStatus('Draft only.');});
el('print').onclick=()=>window.print();
function finish(){working=false;controls();}
function fail(error){setStatus(error.message||String(error));finish();}
window.addEventListener('message',e=>{
  if(e.origin!==location.origin || e.source!==frame.contentWindow) return;
  const {id,type,data}=e.data||{};
  if(type==='ready'){localReady=true;controls();return;}
  if(!localTask || id!==localTask.id) return;
  if(type==='progress'){setStatus('Preparing the on-device model ('+data+'%)');return;}
  if(type!=='result' && type!=='error')return;
  const task=localTask;localTask=null;clearTimeout(task.timer);
  if(type==='error'){fail(new Error(data));return;}
  try{showSheet(bindRows(data,task.lines,'device'),'Verified on device (Firebase AI Logic)');setStatus('Local processing complete. Your notes stayed on this device.');}
  catch(error){fail(error);}
  finish();
});
el('device').onclick=()=>{
  try{
    const lines=sourceLines(notes.value);
    working=true;controls();setStatus('Preparing Chrome’s on-device model…');
    const id=++requestID;
    localTask={id,lines,timer:setTimeout(()=>{localTask=null;fail(new Error('The on-device request timed out. You can retry.'));frame.src='./local-frame.html';},10*60*1000)};
    frame.contentWindow.postMessage({type:'sort-local',id,lines,config:setup.firebase},location.origin);
  }catch(error){fail(error);}
};
frame.src='./local-frame.html';
function openReview(onlyUnresolved){
  try{
    const draft=onlyUnresolved?unresolvedCloudDraft(sheet):cloudDraft(notes.value);
    reviewingUnresolved=onlyUnresolved;
    const area=el('review-lines');area.replaceChildren();
    for(const row of draft){
      const label=document.createElement('label'), marker=document.createElement('span'), field=document.createElement('textarea');
      label.className='review-row';marker.textContent='L'+row.n;field.dataset.n=row.n;field.value=row.text;field.maxLength=4400;
      field.setAttribute('aria-label','Reviewed source line '+row.n);label.append(marker,field);area.append(label);
    }
    el('removed').textContent=onlyUnresolved?'Blank a line to keep its device result. Other cues, including private ones, stay on your local and printed sheet.':
      (sourceLines(notes.value).length-draft.length)+' private line(s) removed. Blank a line to omit it.';
    el('send').disabled=!draft.length;el('cloud-review').showModal();
  }catch(error){fail(error);}
}
el('review').onclick=()=>openReview(false);
el('unresolved').onclick=()=>openReview(true);
el('cancel').onclick=()=>el('cloud-review').close();
el('send').onclick=async()=>{
  if(working)return;
  const approved=[...el('review-lines').querySelectorAll('textarea')].map(t=>({n:Number(t.dataset.n),text:t.value.trim()})).filter(l=>l.text && !isPrivate(l.text));
  if(!approved.length || approved.reduce((n,l)=>n+l.text.length,0)>4400){el('removed').textContent='Keep 1–24 lines and at most 4,400 characters.';return;}
  if(!navigator.onLine){el('removed').textContent='Cloud processing needs a connection. You can keep your notes local.';return;}
  el('cloud-review').close();working=true;controls();setStatus('Processing only the reviewed copy in Google’s cloud…');
  try{
    const response=await sortReviewed(approved,setup.firebase,setup.siteKey);
    const cloudRows=bindRows(response,approved,'cloud');
    if(reviewingUnresolved){
      const merged=mergeReviewedRows(sheet,cloudRows);
      const deviceCount=merged.filter(row=>row.route==='device').length;
      const cloudCount=merged.length-deviceCount;
      showSheet(merged,`Device results: ${deviceCount}, cloud results: ${cloudCount} (Firebase AI Logic)`);
      setStatus('Cloud review complete. Source links show where each cue was processed.');
    }else{
      showSheet(cloudRows,'Verified in cloud (Firebase AI Logic)');
      setStatus('Cloud processing complete. Source links show the reviewed copy.');
    }
  }catch{
    setStatus('Cloud processing did not complete.');
    el('removed').textContent='Cloud processing did not complete. Your edits are here. Retry or keep local.';
    el('cloud-review').showModal();
  }finally{finish();}
};
loadExample();
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
