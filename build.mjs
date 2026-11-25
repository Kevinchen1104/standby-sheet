import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
const paths=['index.html','local-frame.html','style.css'];
const dest='dist/';
await mkdir(dest,{recursive:true});
const firebase=JSON.parse(process.env.FIREBASE_WEB_CONFIG || await readFile('../private/firebase-web.json','utf8'));
const siteKey=(process.env.RECAPTCHA_SITE_ID || await readFile('../private/site-id.txt','utf8')).trim();
if(!firebase.apiKey || !firebase.projectId || !firebase.appId || !siteKey) throw new Error('Missing demo web registration.');
await build({entryPoints:['app.js','device.js'],outdir:dest,bundle:true,minify:true,legalComments:'eof',platform:'browser',format:'esm',
  plugins:[{name:'public-web-registration',setup(builder){
    builder.onResolve({filter:/^\.\/runtime-config\.js$/},()=>({path:'web',namespace:'registration'}));
    builder.onLoad({filter:/.*/,namespace:'registration'},()=>({contents:'export default '+JSON.stringify({firebase,siteKey}),loader:'js'}));
  }}]});
for(const file of paths)await copyFile(file,dest+file);
await copyFile('node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2',dest+'heading.woff2');
await copyFile('node_modules/@fontsource/barlow-condensed/LICENSE',dest+'FONT-LICENSE.txt');
const files=[...paths,'app.js','device.js','heading.woff2'];
const hash=createHash('sha256');for(const file of files)hash.update(await readFile(dest+file));
const prefix='standby-sheet-v',cache=prefix+hash.digest('hex').slice(0,14);
await writeFile(dest+'sw.js',
  'const CACHE='+JSON.stringify(cache)+',FILES='+JSON.stringify(files.map(x=>'./'+x))+';\n'+
  "self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));\n"+
  "self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('standby-sheet-v')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));\n"+
  "self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const url=new URL(e.request.url),base=self.registration.scope;if(url.origin!==self.location.origin||!e.request.url.startsWith(base))return;const file=e.request.url===base||url.pathname===new URL(base).pathname?'./index.html':'./'+url.pathname.slice(new URL(base).pathname.length);if(!FILES.includes(file))return;e.respondWith(caches.open(CACHE).then(async c=>(await c.match(file))||fetch(e.request)));});\n");
console.log('Built the offline shell and isolated device processor.');
