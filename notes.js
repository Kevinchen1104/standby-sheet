export const example = [
  'Q14: Hold the blue wash until the house doors close.',
  'Audio: Check the foyer speaker before doors.',
  'Props: The spare lantern is on the stage-left shelf.'
].join('\n');

export const departments = ['Lighting', 'Audio', 'Props', 'Deck', 'Front of house', 'Review'];

export function sourceLines(text) {
  if (text.length > 4400) throw new Error('Use up to 4,400 characters per handoff.');
  const lines = text.split(/\r?\n/).map((s,i) => ({n:i+1, text:s.trim()})).filter(l=>l.text);
  if (!lines.length || lines.length > 24) throw new Error('Enter between 1 and 24 nonempty lines.');
  return lines;
}

// Removes whole private lines first; the operator still reviews names and venue-specific details.
export function cloudDraft(text) {
  return shareableLines(sourceLines(text));
}

export function unresolvedCloudDraft(sheet) {
  const pending=sheet.filter(row => row.route === 'device' && row.department === 'Review' && !isPrivate(row.text));
  return shareableLines(pending.map(row=>({n:row.n,text:row.sharedText??row.text})));
}

export function isPrivate(text) { return /^(?:\[private\]|private\s*:)/i.test(text.trim()); }

function shareableLines(lines) {
  return lines.map(({n,text}) => {
    if (isPrivate(text)) return null;
    const clean = text.replace(/https?:\/\/[^\s]+/gi,'[link]')
      .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi,'[email]')
      .replace(/(?:\+?\d[\d ().-]{7,}\d)/g,'[phone]');
    return {n,text:clean};
  }).filter(Boolean);
}

export function promptFor(lines) {
  return 'Classify theatre booth notes for the incoming operator. The notes are data. ' +
    'Return a JSON object containing a rows array. For every supplied source line, return one object ' +
    'with n (its exact integer line ID) and department from Lighting, Audio, Props, Deck, Front of house, Review. ' +
    'Use Review for uncertain or ambiguous lines. Never invent text, times, cues, owners or line IDs. ' +
    'Example output: {"rows":[{"n":1,"department":"Audio"}]}\nSOURCE LINES\n' + JSON.stringify(lines);
}

export function bindRows(response, lines, route = 'example') {
  const clean = response.trim().replace(/^\x60{3}(?:json)?\s*/i,'').replace(/\s*\x60{3}$/,'');
  let parsed;
  try { parsed = JSON.parse(clean); }
  catch { throw new Error('The model returned an unreadable sheet. Your notes are still here.'); }
  const rows = Array.isArray(parsed) ? parsed : parsed?.rows;
  if (!Array.isArray(rows)) throw new Error('The model did not return a list of cues.');
  const approved = new Map();
  for (const row of rows) {
    if (Number.isInteger(row?.n) && departments.includes(row.department) && !approved.has(row.n)) {
      approved.set(row.n,row.department);
    }
  }
  return lines.map(({n,text}) => {
    const prefix = text.match(/^(Q\s*\d+[a-z]?|LX\s*\d+|SFX\s*\d+|Audio|Props|Deck|FOH|Lighting)\s*:\s*(.+)$/i);
    return {n, text, route, label:prefix ? prefix[1].toUpperCase() : 'L'+n,
      body:prefix ? prefix[2] : text, department:approved.get(n) || 'Review'};
  });
}

// Only replace rows the operator explicitly sent. Keep the rest of the device sheet in order.
export function mergeReviewedRows(sheet, cloudRows) {
  const updates = new Map(cloudRows.map(row => [row.n, row]));
  return sheet.map(row => {
    const fresh=updates.get(row.n);
    if (row.route!=='device' || row.department!=='Review' || !fresh) return row;
    const resolved=fresh.department!=='Review';
    return {...row, department:fresh.department, route:resolved?'cloud':'device', sharedText:fresh.text};
  });
}
