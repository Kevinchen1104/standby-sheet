import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, InferenceSource } from 'firebase/ai';
import { promptFor } from './notes.js';

const target = window.location.origin;
function announce(id, type, data) { parent.postMessage({id,type,data},target); }
let busy = false;
window.addEventListener('message', async e => {
  if (e.origin !== target || e.source !== parent || e.data?.type !== 'sort-local' || busy) return;
  const {id,lines,config} = e.data;
  busy = true;
  try {
    if (!globalThis.LanguageModel?.availability) throw new Error('This browser has no on-device Prompt API. Use desktop Chrome, or review a copy for cloud.');
    const app = initializeApp(config);
    const ai = getAI(app, {backend:new GoogleAIBackend()});
    const model = getGenerativeModel(ai,{mode:InferenceMode.ONLY_ON_DEVICE});
    await model.initializeDeviceModel(r=>announce(id,'progress',Math.round(r*100)));
    const {response} = await model.generateContent(promptFor(lines));
    if (response.inferenceSource !== InferenceSource.ON_DEVICE) throw new Error('The device could not verify the inference source.');
    announce(id,'result',response.text());
  } catch (err) {
    announce(id,'error',String(err.message || err).slice(0,260));
  } finally { busy=false; }
});
announce(0,'ready',null);
