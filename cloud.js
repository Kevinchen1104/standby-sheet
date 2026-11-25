import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, InferenceSource } from 'firebase/ai';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { promptFor } from './notes.js';

let cloud;
export async function sortReviewed(lines, config, siteKey) {
  if (!cloud) {
    const app=initializeApp(config);
    initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(siteKey),isTokenAutoRefreshEnabled:false});
    cloud=getGenerativeModel(getAI(app,{backend:new GoogleAIBackend()}),{
      mode:InferenceMode.ONLY_IN_CLOUD,
      inCloudParams:{model:'gemini-3.5-flash-lite',generationConfig:{temperature:0,responseMimeType:'application/json'}}
    });
  }
  const {response}=await cloud.generateContent(promptFor(lines));
  if (response.inferenceSource !== InferenceSource.IN_CLOUD) throw new Error('The SDK could not verify the cloud inference source.');
  return response.text();
}
