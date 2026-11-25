# Standby Sheet

An English handoff desk for adult theatre crews. Paste booth notes, classify each line by department, and open its source before printing. The sentence on the cue sheet comes from the operator’s text. Models supply department tags. Missing tags appear as “Review.”

## Try the desk

[Open Standby Sheet](https://kevinchen1104.github.io/standby-sheet/). The three prewritten example rows are labeled. Change a note to clear them, then choose a processing route. The footer reports the result and the line links open the exact input.

* **Process on device** uses Firebase AI Logic in an isolated frame. Desktop Chrome needs model support and an initial download. The frame disallows outbound network connections. Reopen the cached app offline after the first visit and model download.
* **Review for cloud** creates a separate editable copy. Lines prefixed with “Private:” or “[private]” are excluded, and common email addresses, phone numbers and links are masked. Check names, locations and other identifying details yourself. Only **Send reviewed lines** submits the copy to Google. Free-tier requests may be used to improve Google services. Please use fictional notes when testing the public demo.
* Click a line number to inspect its source. **Print** prepares a handoff without the editor. Working notes are held in memory for the tab. Refreshing clears them.

## Implementation

The Firebase JavaScript SDK runs in the browser. In device.js, getGenerativeModel uses ONLY_ON_DEVICE, followed by initializeDeviceModel and generateContent. In cloud.js, ONLY_IN_CLOUD uses the Gemini Developer API, with Firebase App Check verifying the demo domain. Both routes check inferenceSource, bind the response to real source lines, and omit model-generated prose. Cloud fallback gives the operator a chance to remove private details. A service worker caches the application shell, font and processor. Prompts, results and cloud traffic are excluded from caching.

## Build

Use Node 22 or newer. Run npm ci, npm test, then npm run build. Serve dist/ over HTTPS or localhost. To reproduce the integration with your own project, set FIREBASE_WEB_CONFIG to the JSON Firebase web registration and RECAPTCHA_SITE_ID to the public App Check site identifier for your domain. Enable the Gemini Developer API in Firebase AI Logic and register your domain with App Check. The demo uses the Spark free tier. The Pages workflow injects the demo’s public client registration during its build. Keep any private service credentials outside the client.

## Credits

Created for Google’s 2026 BuildHybridAI competition with Codex assistance. The interface, synthetic booth notes, source binding and tests were made for this project. Barlow Condensed uses the SIL Open Font License, included in the built site. Firebase and esbuild retain their respective licenses.
