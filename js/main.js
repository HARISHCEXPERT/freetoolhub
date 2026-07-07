/* ================================================================
   Toolbox — all logic. Pure front-end, no dependencies.
   ================================================================ */
'use strict';

/* ---------- tiny utils ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const clamp = (n,a,b) => Math.max(a, Math.min(b, n));
const fmt = (n, d = 2) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const money = (n, sym = '₹') => sym + ' ' + fmt(Math.round(n));

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1600);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); }
  catch { toast('Copy failed'); }
}
function download(text, name, type = 'text/plain') {
  const blob = text instanceof Blob ? text : new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- result html helpers ---------- */
const stat = (v, k, accent) => `<div class="stat"><div class="v ${accent ? 'accent' : ''}">${v}</div><div class="k">${k}</div></div>`;
const bigResult = (...stats) => `<div class="result big">${stats.join('')}</div>`;
const kv = rows => `<div class="result"><table class="kvtable"><tbody>${rows.map(([k, v]) => `<tr><td>${k}</td><td><b>${v}</b></td></tr>`).join('')}</tbody></table></div>`;
const errBox = m => `<div class="status err" style="margin-top:14px">⚠ ${esc(m)}</div>`;

/* ================================================================
   Shared tool scaffolds
   ================================================================ */

/* Input → transform → Output, with one or more action buttons */
function ioTool(root, cfg) {
  const acts = cfg.actions || [];
  root.innerHTML = `
    <div class="tool-body">
      ${acts.length ? `<div class="row" style="margin-bottom:14px">
        ${acts.map((a, i) => `<button class="btn ${a.primary ? 'primary' : ''}" data-i="${i}">${esc(a.name)}</button>`).join('')}
      </div>` : ''}
      <div class="io-grid">
        <div class="io-col">
          <div class="row" style="justify-content:space-between">
            <span class="io-label">${cfg.inLabel || 'Input'}</span>
            <div class="row">
              ${cfg.sample != null ? `<button class="btn sm ghost" id="io-sample">Sample</button>` : ''}
              <button class="btn sm ghost" id="io-clear">Clear</button>
            </div>
          </div>
          <textarea class="ta ${cfg.wrapIn ? 'wrap' : ''}" id="io-in" placeholder="${esc(cfg.placeholder || 'Paste here…')}" spellcheck="false"></textarea>
        </div>
        <div class="io-col">
          <div class="row" style="justify-content:space-between">
            <span class="io-label">${cfg.outLabel || 'Output'}</span>
            <div class="row">
              <button class="btn sm ghost" id="io-copy">Copy</button>
              <button class="btn sm ghost" id="io-dl">Download</button>
            </div>
          </div>
          <textarea class="ta out ${cfg.wrapOut ? 'wrap' : ''}" id="io-out" readonly spellcheck="false"></textarea>
          <div class="status muted" id="io-st"></div>
        </div>
      </div>
      ${cfg.note ? `<div class="note-box">${cfg.note}</div>` : ''}
    </div>`;

  const $in = $('#io-in', root), $out = $('#io-out', root), $st = $('#io-st', root);
  const run = a => {
    try {
      const r = a.run($in.value);
      $out.value = r == null ? '' : r;
      $st.className = 'status ok';
      $st.textContent = a.ok || '✓ Done';
    } catch (e) {
      $out.value = '';
      $st.className = 'status err';
      $st.textContent = '✕ ' + e.message;
    }
  };
  acts.forEach((a, i) => $(`[data-i="${i}"]`, root).onclick = () => run(a));
  if (cfg.auto && acts[0]) { const f = () => run(acts[0]); $in.addEventListener('input', f); }
  $('#io-clear', root).onclick = () => { $in.value = ''; $out.value = ''; $st.textContent = ''; $in.focus(); };
  $('#io-copy', root).onclick = () => $out.value ? copy($out.value) : toast('Nothing to copy');
  $('#io-dl', root).onclick = () => $out.value ? download($out.value, (cfg.dlName || 'output.txt')) : toast('Nothing to download');
  if (cfg.sample != null) $('#io-sample', root).onclick = () => { $in.value = cfg.sample; if (cfg.auto && acts[0]) run(acts[0]); };
}

/* Field-based calculator / generator */
function calcTool(root, cfg) {
  const fieldHtml = f => {
    const id = 'f-' + f.id;
    if (f.type === 'select')
      return `<div class="field"><label>${f.label}${f.hint ? ` <span class="hint">${f.hint}</span>` : ''}</label>
        <select class="fld" id="${id}">${f.options.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${f.value == v ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></div>`;
    if (f.type === 'textarea')
      return `<div class="field" style="grid-column:1/-1"><label>${f.label}${f.hint ? ` <span class="hint">${f.hint}</span>` : ''}</label>
        <textarea class="ta wrap" id="${id}" style="min-height:140px" placeholder="${esc(f.placeholder || '')}" spellcheck="false">${esc(f.value || '')}</textarea></div>`;
    if (f.type === 'checkbox')
      return `<div class="field"><label style="display:flex;gap:9px;align-items:center;cursor:pointer">
        <input type="checkbox" id="${id}" ${f.value ? 'checked' : ''} style="width:17px;height:17px;accent-color:var(--accent)"> ${f.label}</label></div>`;
    const t = f.type || 'number';
    return `<div class="field"><label>${f.label}${f.hint ? ` <span class="hint">${f.hint}</span>` : ''}</label>
      <input class="fld" type="${t}" id="${id}" ${f.step ? `step="${f.step}"` : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''}
        value="${f.value != null ? esc(f.value) : ''}" placeholder="${esc(f.placeholder || '')}"></div>`;
  };

  root.innerHTML = `
    <div class="tool-body">
      <div class="field-row">${cfg.fields.map(fieldHtml).join('')}</div>
      <div class="row" style="margin-top:6px">
        <button class="btn primary" id="calc-go">${cfg.button || 'Calculate'}</button>
        ${cfg.button2 ? `<button class="btn" id="calc-go2">${cfg.button2}</button>` : ''}
      </div>
      <div id="calc-out"></div>
      ${cfg.note ? `<div class="note-box">${cfg.note}</div>` : ''}
    </div>`;

  const read = () => {
    const v = {};
    cfg.fields.forEach(f => {
      const el = $('#f-' + f.id, root);
      v[f.id] = f.type === 'checkbox' ? el.checked : el.value;
    });
    return v;
  };
  const go = (fn) => {
    try { $('#calc-out', root).innerHTML = fn(read()) || ''; }
    catch (e) { $('#calc-out', root).innerHTML = errBox(e.message); }
  };
  $('#calc-go', root).onclick = () => go(cfg.compute);
  if (cfg.button2) $('#calc-go2', root).onclick = () => go(cfg.compute2);
  if (cfg.auto) { root.addEventListener('input', () => go(cfg.compute)); go(cfg.compute); }
}

/* Generator output block (text result + copy/download) */
const outBlock = (text, id = 'gx', name = 'output.txt', mono = true) =>
  `<div class="result"><div class="row" style="justify-content:flex-end;margin-bottom:8px">
      <button class="btn sm js-copy" data-target="${id}">Copy</button>
      <button class="btn sm js-dl" data-target="${id}" data-name="${name}">Download</button>
    </div>
    <textarea class="ta ${mono ? '' : 'wrap'} out" id="${id}" readonly style="min-height:${mono ? 200 : 140}px">${esc(text)}</textarea></div>`;

/* ---------- delegated copy / download from result blocks ---------- */
document.addEventListener('click', e => {
  const c = e.target.closest('.js-copy');
  if (c) { const t = document.getElementById(c.dataset.target); if (t) copy(t.value != null ? t.value : t.textContent); }
  const d = e.target.closest('.js-dl');
  if (d) { const t = document.getElementById(d.dataset.target); if (t) download(t.value != null ? t.value : t.textContent, d.dataset.name || 'output.txt'); }
});

/* ================================================================
   conversion / parsing helpers
   ================================================================ */
function jsonToCsv(arr) {
  if (!Array.isArray(arr)) { if (arr && typeof arr === 'object') arr = [arr]; else throw new Error('Expected a JSON array of objects'); }
  const keys = [...arr.reduce((s, o) => { Object.keys(o || {}).forEach(k => s.add(k)); return s; }, new Set())];
  const cell = v => { v = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return [keys.join(','), ...arr.map(o => keys.map(k => cell(o ? o[k] : '')).join(','))].join('\n');
}
function csvToRows(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c === '\r') { /* skip */ }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.length && !(r.length === 1 && r[0] === ''));
}
function csvToJson(text) {
  const rows = csvToRows(text);
  if (!rows.length) return [];
  const head = rows[0];
  return rows.slice(1).map(r => { const o = {}; head.forEach((h, i) => { let v = r[i] ?? ''; if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v); o[h] = v; }); return o; });
}
function escXml(s) { return String(s).replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c])); }
function jsonToXml(obj) {
  const conv = (o, name) => {
    if (Array.isArray(o)) return o.map(v => conv(v, name)).join('');
    if (o && typeof o === 'object') return `<${name}>${Object.entries(o).map(([k, v]) => conv(v, k.replace(/[^\w.\-]/g, '_') || 'item')).join('')}</${name}>`;
    return `<${name}>${escXml(o == null ? '' : o)}</${name}>`;
  };
  return formatXml('<?xml version="1.0" encoding="UTF-8"?>' + conv(obj, 'root'));
}
function formatXml(xml) {
  let out = '', indent = '';
  xml = xml.replace(/>\s*</g, '><').trim();
  xml.split(/(?=<)/).forEach(node => {
    if (/^<\/\w/.test(node)) indent = indent.slice(2);
    out += indent + node + '\n';
    if (/^<\?/.test(node)) return;
    if (/^<[^!?][^>]*[^\/]>$/.test(node) && !/<\/.+>$/.test(node)) indent += '  ';
  });
  return out.trim();
}
function formatSql(sql) {
  const kw = ['SELECT','FROM','WHERE','AND','OR','INNER JOIN','LEFT JOIN','RIGHT JOIN','OUTER JOIN','JOIN','ON','GROUP BY','ORDER BY','HAVING','LIMIT','OFFSET','INSERT INTO','VALUES','UPDATE','SET','DELETE FROM','CREATE TABLE','UNION ALL','UNION'];
  let s = sql.replace(/\s+/g, ' ').trim();
  kw.forEach(k => { s = s.replace(new RegExp('\\s*\\b' + k.replace(/ /g, '\\s+') + '\\b', 'gi'), '\n' + k); });
  s = s.replace(/,\s*/g, ',\n  ').replace(/\n(AND|OR|ON)\b/gi, '\n  $1');
  return s.replace(/^\n/, '').replace(/\n{2,}/g, '\n').trim();
}
/* small but full MD5 */
function md5(str) {
  function toBytes(s){ s=unescape(encodeURIComponent(s)); const b=[]; for(let i=0;i<s.length;i++)b.push(s.charCodeAt(i)); return b; }
  function add(a,b){const l=(a&0xffff)+(b&0xffff);return(((a>>16)+(b>>16)+(l>>16))<<16)|(l&0xffff);}
  const rol=(n,c)=>(n<<c)|(n>>>(32-c));
  function cmn(q,a,b,x,s,t){return add(rol(add(add(a,q),add(x,t)),s),b);}
  const ff=(a,b,c,d,x,s,t)=>cmn((b&c)|(~b&d),a,b,x,s,t);
  const gg=(a,b,c,d,x,s,t)=>cmn((b&d)|(c&~d),a,b,x,s,t);
  const hh=(a,b,c,d,x,s,t)=>cmn(b^c^d,a,b,x,s,t);
  const ii=(a,b,c,d,x,s,t)=>cmn(c^(b|~d),a,b,x,s,t);
  const bytes=toBytes(str), n=bytes.length, words=[];
  for(let i=0;i<n;i++)words[i>>2]=(words[i>>2]||0)|(bytes[i]<<((i%4)*8));
  words[n>>2]=(words[n>>2]||0)|(0x80<<((n%4)*8));
  const len=((n+8)>>6)+1, msg=new Array(len*16).fill(0);
  for(let i=0;i<words.length;i++)msg[i]=words[i];
  msg[len*16-2]=n*8;
  let a=1732584193,b=-271733879,c=-1732584194,d=271733878;
  for(let i=0;i<msg.length;i+=16){
    const oa=a,ob=b,oc=c,od=d,x=msg.slice(i,i+16);
    a=ff(a,b,c,d,x[0],7,-680876936);d=ff(d,a,b,c,x[1],12,-389564586);c=ff(c,d,a,b,x[2],17,606105819);b=ff(b,c,d,a,x[3],22,-1044525330);
    a=ff(a,b,c,d,x[4],7,-176418897);d=ff(d,a,b,c,x[5],12,1200080426);c=ff(c,d,a,b,x[6],17,-1473231341);b=ff(b,c,d,a,x[7],22,-45705983);
    a=ff(a,b,c,d,x[8],7,1770035416);d=ff(d,a,b,c,x[9],12,-1958414417);c=ff(c,d,a,b,x[10],17,-42063);b=ff(b,c,d,a,x[11],22,-1990404162);
    a=ff(a,b,c,d,x[12],7,1804603682);d=ff(d,a,b,c,x[13],12,-40341101);c=ff(c,d,a,b,x[14],17,-1502002290);b=ff(b,c,d,a,x[15],22,1236535329);
    a=gg(a,b,c,d,x[1],5,-165796510);d=gg(d,a,b,c,x[6],9,-1069501632);c=gg(c,d,a,b,x[11],14,643717713);b=gg(b,c,d,a,x[0],20,-373897302);
    a=gg(a,b,c,d,x[5],5,-701558691);d=gg(d,a,b,c,x[10],9,38016083);c=gg(c,d,a,b,x[15],14,-660478335);b=gg(b,c,d,a,x[4],20,-405537848);
    a=gg(a,b,c,d,x[9],5,568446438);d=gg(d,a,b,c,x[14],9,-1019803690);c=gg(c,d,a,b,x[3],14,-187363961);b=gg(b,c,d,a,x[8],20,1163531501);
    a=gg(a,b,c,d,x[13],5,-1444681467);d=gg(d,a,b,c,x[2],9,-51403784);c=gg(c,d,a,b,x[7],14,1735328473);b=gg(b,c,d,a,x[12],20,-1926607734);
    a=hh(a,b,c,d,x[5],4,-378558);d=hh(d,a,b,c,x[8],11,-2022574463);c=hh(c,d,a,b,x[11],16,1839030562);b=hh(b,c,d,a,x[14],23,-35309556);
    a=hh(a,b,c,d,x[1],4,-1530992060);d=hh(d,a,b,c,x[4],11,1272893353);c=hh(c,d,a,b,x[7],16,-155497632);b=hh(b,c,d,a,x[10],23,-1094730640);
    a=hh(a,b,c,d,x[13],4,681279174);d=hh(d,a,b,c,x[0],11,-358537222);c=hh(c,d,a,b,x[3],16,-722521979);b=hh(b,c,d,a,x[6],23,76029189);
    a=hh(a,b,c,d,x[9],4,-640364487);d=hh(d,a,b,c,x[12],11,-421815835);c=hh(c,d,a,b,x[15],16,530742520);b=hh(b,c,d,a,x[2],23,-995338651);
    a=ii(a,b,c,d,x[0],6,-198630844);d=ii(d,a,b,c,x[7],10,1126891415);c=ii(c,d,a,b,x[14],15,-1416354905);b=ii(b,c,d,a,x[5],21,-57434055);
    a=ii(a,b,c,d,x[12],6,1700485571);d=ii(d,a,b,c,x[3],10,-1894986606);c=ii(c,d,a,b,x[10],15,-1051523);b=ii(b,c,d,a,x[1],21,-2054922799);
    a=ii(a,b,c,d,x[8],6,1873313359);d=ii(d,a,b,c,x[15],10,-30611744);c=ii(c,d,a,b,x[6],15,-1560198380);b=ii(b,c,d,a,x[13],21,1309151649);
    a=ii(a,b,c,d,x[4],6,-145523070);d=ii(d,a,b,c,x[11],10,-1120210379);c=ii(c,d,a,b,x[2],15,718787259);b=ii(b,c,d,a,x[9],21,-343485551);
    a=add(a,oa);b=add(b,ob);c=add(c,oc);d=add(d,od);
  }
  const hex=n=>{let s='';for(let i=0;i<4;i++)s+=('0'+((n>>(i*8))&0xff).toString(16)).slice(-2);return s;};
  return hex(a)+hex(b)+hex(c)+hex(d);
}
async function sha(algo, str) {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
/* minimal-ish YAML → object (common cases) */
function parseYaml(text) {
  const lines = text.replace(/\t/g, '  ').split('\n').filter(l => l.trim() && !/^\s*#/.test(l));
  let i = 0;
  const val = s => {
    s = s.trim();
    if (s === '' ) return null;
    if (/^".*"$/.test(s) || /^'.*'$/.test(s)) return s.slice(1, -1);
    if (s === 'true') return true; if (s === 'false') return false;
    if (s === 'null' || s === '~') return null;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if (/^\[.*\]$/.test(s) || /^\{.*\}$/.test(s)) { try { return JSON.parse(s.replace(/'/g, '"')); } catch { return s; } }
    return s;
  };
  const indentOf = l => l.match(/^ */)[0].length;
  function parse(min) {
    const isSeq = lines[i] && lines[i].trim().startsWith('- ') || (lines[i] && lines[i].trim() === '-');
    let result = isSeq ? [] : {};
    while (i < lines.length) {
      const line = lines[i], ind = indentOf(line), t = line.trim();
      if (ind < min) break;
      if (ind > min) throw new Error('Unexpected indentation');
      if (t.startsWith('- ')) {
        const rest = t.slice(2);
        i++;
        if (rest.includes(':') && !/^["'].*["']$/.test(rest)) {
          // inline map item — re-parse from this content
          const obj = {}; const [k, ...r] = rest.split(':'); obj[k.trim()] = val(r.join(':'));
          if (i < lines.length && indentOf(lines[i]) > min) Object.assign(obj, parse(indentOf(lines[i])));
          result.push(obj);
        } else result.push(val(rest));
      } else if (t === '-') { i++; result.push(parse(ind + 2)); }
      else {
        const ci = t.indexOf(':'); if (ci < 0) throw new Error('Invalid line: ' + t);
        const k = t.slice(0, ci).trim(), rv = t.slice(ci + 1).trim();
        i++;
        if (rv === '') result[k] = (i < lines.length && indentOf(lines[i]) > ind) ? parse(indentOf(lines[i])) : null;
        else result[k] = val(rv);
      }
    }
    return result;
  }
  return parse(0);
}
/* minimal markdown */
function mdToHtml(md) {
  const blocks = [];
  md = md.replace(/```([\s\S]*?)```/g, (_, c) => { blocks.push('<pre><code>' + esc(c.replace(/^\n/, '')) + '</code></pre>'); return '\u0000' + (blocks.length - 1) + '\u0000'; });
  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" style="max-width:100%">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\W)\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  const lines = md.split('\n'); let html = '', list = null;
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  for (let raw of lines) {
    const l = raw.replace(/\u0000(\d+)\u0000/, (_, n) => blocks[n]);
    if (/\u0000\d+\u0000/.test(raw) === false && raw.includes('\u0000')) { /* noop */ }
    if (raw.match(/^\u0000\d+\u0000$/)) { closeList(); html += blocks[raw.replace(/\u0000/g, '')]; continue; }
    if (/^#{1,6} /.test(l)) { closeList(); const lv = l.match(/^#+/)[0].length; html += `<h${lv}>${inline(l.replace(/^#+ /, ''))}</h${lv}>`; }
    else if (/^>\s?/.test(l)) { closeList(); html += `<blockquote>${inline(l.replace(/^>\s?/, ''))}</blockquote>`; }
    else if (/^(-{3,}|\*{3,})$/.test(l.trim())) { closeList(); html += '<hr>'; }
    else if (/^\s*[-*+] /.test(l)) { if (list !== 'ul') { closeList(); list = 'ul'; html += '<ul>'; } html += `<li>${inline(l.replace(/^\s*[-*+] /, ''))}</li>`; }
    else if (/^\s*\d+\. /.test(l)) { if (list !== 'ol') { closeList(); list = 'ol'; html += '<ol>'; } html += `<li>${inline(l.replace(/^\s*\d+\. /, ''))}</li>`; }
    else if (l.trim() === '') closeList();
    else { closeList(); html += `<p>${inline(l)}</p>`; }
  }
  closeList();
  return html;
}

/* ================================================================
   TOOL REGISTRY
   ================================================================ */
const CATS = [
  { id: 'dev',      name: 'Developer',  ic: '{}' },
  { id: 'text',     name: 'Text',       ic: '¶' },
  { id: 'everyday', name: 'Everyday',   ic: '◎' },
  { id: 'finance',  name: 'Finance',    ic: '₹' },
  { id: 'student',  name: 'Student',    ic: '✎' },
  { id: 'seo',      name: 'SEO & Web',  ic: '⌁' },
  { id: 'image',    name: 'Image',      ic: '▣' },
  { id: 'pdf',      name: 'PDF',        ic: '⎙' },
];

const TOOLS = [];
const T = (cat, id, name, desc, render) => TOOLS.push({ cat, id, name, desc, render });

/* ---------------- DEVELOPER ---------------- */
T('dev', 'json-formatter', 'JSON Formatter', 'Beautify, minify & sort JSON.', root => ioTool(root, {
  placeholder: '{"hello":"world"}', dlName: 'formatted.json', wrapOut: false, auto: true,
  sample: '{"name":"Ada","langs":["JS","Py"],"active":true,"meta":{"id":7,"score":9.5}}',
  actions: [
    { name: 'Beautify', primary: true, ok: '✓ Formatted', run: t => JSON.stringify(JSON.parse(t), null, 2) },
    { name: 'Beautify (4)', run: t => JSON.stringify(JSON.parse(t), null, 4) },
    { name: 'Minify', run: t => JSON.stringify(JSON.parse(t)) },
    { name: 'Sort keys', run: t => JSON.stringify(JSON.parse(t), (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort((a, b) => a[0].localeCompare(b[0]))) : v, 2) },
  ],
}));
T('dev', 'json-validator', 'JSON Validator', 'Check JSON validity with error location.', root => ioTool(root, {
  placeholder: '{"a":1,}', auto: true,
  actions: [{ name: 'Validate', primary: true, ok: '✓ Valid JSON', run: t => { const o = JSON.parse(t); const c = JSON.stringify(o).length; return JSON.stringify(o, null, 2); } }],
  note: 'Output shows the parsed & re-formatted JSON. Errors point to the offending position.',
}));
T('dev', 'json-minifier', 'JSON Minifier', 'Strip whitespace from JSON.', root => ioTool(root, {
  placeholder: '{ "a": 1 }', dlName: 'min.json', auto: true,
  actions: [{ name: 'Minify', primary: true, run: t => JSON.stringify(JSON.parse(t)) }],
}));
T('dev', 'json-to-csv', 'JSON → CSV', 'Convert a JSON array of objects to CSV.', root => ioTool(root, {
  placeholder: '[{"name":"A","age":30}]', dlName: 'data.csv', wrapOut: true,
  sample: '[{"name":"Ada","city":"NYC","age":30},{"name":"Linus","city":"Helsinki","age":54}]',
  actions: [{ name: 'Convert to CSV', primary: true, run: t => jsonToCsv(JSON.parse(t)) }],
}));
T('dev', 'json-to-xml', 'JSON → XML', 'Convert JSON to formatted XML.', root => ioTool(root, {
  placeholder: '{"user":{"id":1}}', dlName: 'data.xml',
  sample: '{"users":[{"id":1,"name":"Ada"},{"id":2,"name":"Linus"}]}',
  actions: [{ name: 'Convert to XML', primary: true, run: t => jsonToXml(JSON.parse(t)) }],
}));
T('dev', 'json-diff', 'JSON Diff', 'Compare two JSON values (line diff of formatted output).', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="io-grid">
      <div class="io-col"><span class="io-label">A</span><textarea class="ta" id="da" spellcheck="false">{"a":1,"b":2}</textarea></div>
      <div class="io-col"><span class="io-label">B</span><textarea class="ta" id="db" spellcheck="false">{"a":1,"b":3,"c":4}</textarea></div>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="dgo">Compare</button></div>
    <div id="dout"></div></div>`;
  $('#dgo', root).onclick = () => {
    try {
      const a = JSON.stringify(JSON.parse($('#da', root).value), null, 2).split('\n');
      const b = JSON.stringify(JSON.parse($('#db', root).value), null, 2).split('\n');
      const setB = new Set(b), setA = new Set(a);
      let out = '<div class="result" style="padding:10px">';
      const max = Math.max(a.length, b.length);
      const all = [...new Set([...a, ...b])];
      out += a.map(l => setB.has(l) ? `<div class="diff-line">  ${esc(l)}</div>` : `<div class="diff-line del">- ${esc(l)}</div>`).join('');
      out += b.filter(l => !setA.has(l)).map(l => `<div class="diff-line add">+ ${esc(l)}</div>`).join('');
      out += '</div>';
      $('#dout', root).innerHTML = out;
    } catch (e) { $('#dout', root).innerHTML = errBox(e.message); }
  };
});
T('dev', 'xml-formatter', 'XML Formatter', 'Pretty-print and indent XML.', root => ioTool(root, {
  placeholder: '<a><b>1</b></a>', dlName: 'formatted.xml', auto: true,
  sample: '<root><user id="1"><name>Ada</name></user></root>',
  actions: [{ name: 'Format', primary: true, run: t => formatXml(t) }, { name: 'Minify', run: t => t.replace(/>\s+</g, '><').trim() }],
}));
T('dev', 'yaml-to-json', 'YAML → JSON', 'Convert common YAML to JSON.', root => ioTool(root, {
  placeholder: 'name: Ada\nage: 30', dlName: 'data.json', auto: true,
  sample: 'name: Ada\nlangs:\n  - JS\n  - Python\nactive: true\nmeta:\n  id: 7\n  score: 9.5',
  actions: [{ name: 'To JSON', primary: true, run: t => JSON.stringify(parseYaml(t), null, 2) }],
  note: 'Handles common YAML (maps, lists, scalars). Very advanced YAML features are not supported.',
}));
T('dev', 'sql-formatter', 'SQL Formatter', 'Format SQL onto readable lines.', root => ioTool(root, {
  placeholder: 'select * from users where id=1', dlName: 'query.sql', wrapOut: true, auto: true,
  sample: 'select id, name, email from users u inner join orders o on o.uid=u.id where u.active=1 and o.total>100 order by o.total desc limit 10',
  actions: [{ name: 'Format', primary: true, run: t => formatSql(t) }, { name: 'Minify', run: t => t.replace(/\s+/g, ' ').trim() }],
}));
T('dev', 'base64', 'Base64 Encode / Decode', 'UTF-8 safe Base64.', root => ioTool(root, {
  placeholder: 'Hello, 世界', wrapIn: true, wrapOut: true,
  actions: [
    { name: 'Encode', primary: true, run: t => btoa(unescape(encodeURIComponent(t))) },
    { name: 'Decode', run: t => decodeURIComponent(escape(atob(t.trim()))) },
  ],
}));
T('dev', 'url-encode', 'URL Encode / Decode', 'Percent-encode text and URLs.', root => ioTool(root, {
  placeholder: 'hello world & friends', wrapIn: true, wrapOut: true,
  actions: [
    { name: 'Encode component', primary: true, run: t => encodeURIComponent(t) },
    { name: 'Encode URI', run: t => encodeURI(t) },
    { name: 'Decode', run: t => decodeURIComponent(t) },
  ],
}));
T('dev', 'uuid', 'UUID Generator', 'Generate v4 UUIDs.', root => calcTool(root, {
  button: 'Generate',
  fields: [{ id: 'n', label: 'How many', type: 'number', value: 5, min: 1, max: 1000 }, { id: 'up', label: 'Uppercase', type: 'checkbox' }],
  compute: v => { const n = clamp(parseInt(v.n) || 1, 1, 1000); let list = Array.from({ length: n }, () => crypto.randomUUID()); if (v.up) list = list.map(x => x.toUpperCase()); return outBlock(list.join('\n'), 'uuidout', 'uuids.txt'); },
}));
T('dev', 'regex-tester', 'Regex Tester', 'Test patterns live with match highlighting & groups.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="field-row">
      <div class="field" style="grid-column:1/-1"><label>Pattern</label>
        <div class="row" style="flex-wrap:nowrap"><span class="chip">/</span><input class="fld" id="rpat" placeholder="\\b\\w+@\\w+\\.\\w+\\b" spellcheck="false"><span class="chip">/</span><input class="fld" id="rflag" value="g" style="max-width:80px" placeholder="flags"></div></div>
    </div>
    <div class="field"><label>Test string</label><textarea class="ta wrap" id="rtext" style="min-height:160px" spellcheck="false">Reach us at ada@dev.io or linus@kernel.org.</textarea></div>
    <div id="rstat" class="status muted"></div>
    <div class="result" id="rhi" style="margin-top:12px"></div>
    <div id="rgrp"></div></div>`;
  const run = () => {
    const pat = $('#rpat', root).value, flags = $('#rflag', root).value, text = $('#rtext', root).value;
    const hi = $('#rhi', root), st = $('#rstat', root), grp = $('#rgrp', root);
    if (!pat) { hi.innerHTML = '<span class="subtle">Enter a pattern…</span>'; st.textContent = ''; grp.innerHTML = ''; return; }
    let re; try { re = new RegExp(pat, flags.includes('g') ? flags : flags + 'g'); } catch (e) { st.className = 'status err'; st.textContent = '✕ ' + e.message; return; }
    const matches = [...text.matchAll(re)];
    st.className = 'status ok'; st.textContent = `✓ ${matches.length} match${matches.length === 1 ? '' : 'es'}`;
    let last = 0, out = '';
    matches.forEach(m => { out += esc(text.slice(last, m.index)) + `<mark style="background:var(--accent-soft);color:var(--accent-ink);border-radius:3px;padding:0 2px">${esc(m[0])}</mark>`; last = m.index + m[0].length; });
    out += esc(text.slice(last));
    hi.innerHTML = `<div style="white-space:pre-wrap;font-family:var(--mono);font-size:13px">${out || '<span class="subtle">No text</span>'}</div>`;
    const withGroups = matches.filter(m => m.length > 1);
    grp.innerHTML = withGroups.length ? `<div class="result"><div class="io-label" style="margin-bottom:8px">Capture groups</div>${withGroups.slice(0, 20).map((m, i) => `<div class="chips" style="margin-bottom:6px"><span class="chip">#${i + 1}</span>${m.slice(1).map((g, j) => `<span class="chip">$${j + 1}: ${esc(g ?? '∅')}</span>`).join('')}</div>`).join('')}</div>` : '';
  };
  ['rpat', 'rflag', 'rtext'].forEach(id => $('#' + id, root).addEventListener('input', run));
  run();
});
T('dev', 'jwt-decoder', 'JWT Decoder', 'Decode a JWT header & payload (no verification).', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="field"><label>JWT token</label><textarea class="ta wrap" id="jin" style="min-height:120px" placeholder="eyJ..." spellcheck="false"></textarea></div>
    <div id="jout"></div></div>`;
  const dec = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); return decodeURIComponent(escape(atob(s + '==='.slice((s.length + 3) % 4)))); };
  const run = () => {
    const t = $('#jin', root).value.trim(); const o = $('#jout', root);
    if (!t) { o.innerHTML = ''; return; }
    const parts = t.split('.');
    if (parts.length < 2) { o.innerHTML = errBox('Not a valid JWT (need header.payload.signature)'); return; }
    try {
      const head = JSON.parse(dec(parts[0])), payload = JSON.parse(dec(parts[1]));
      let exp = '';
      if (payload.exp) { const d = new Date(payload.exp * 1000); exp = `<div class="note-box">exp: ${d.toLocaleString()} — ${d < new Date() ? '⚠ expired' : '✓ still valid'}</div>`; }
      o.innerHTML = `<div class="io-grid"><div class="io-col"><span class="io-label">Header</span><pre class="code">${esc(JSON.stringify(head, null, 2))}</pre></div>
        <div class="io-col"><span class="io-label">Payload</span><pre class="code">${esc(JSON.stringify(payload, null, 2))}</pre></div></div>${exp}`;
    } catch (e) { o.innerHTML = errBox('Could not decode: ' + e.message); }
  };
  $('#jin', root).addEventListener('input', run);
});
T('dev', 'hash-generator', 'Hash Generator', 'MD5, SHA-1, SHA-256, SHA-512 of text.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="field"><label>Text</label><textarea class="ta wrap" id="hin" style="min-height:120px" placeholder="Type to hash…" spellcheck="false"></textarea></div>
    <div id="hout"></div></div>`;
  const run = async () => {
    const t = $('#hin', root).value; const o = $('#hout', root);
    if (!t) { o.innerHTML = ''; return; }
    const [s1, s256, s384, s512] = await Promise.all([sha('SHA-1', t), sha('SHA-256', t), sha('SHA-384', t), sha('SHA-512', t)]);
    const row = (k, v) => `<tr><td>${k}</td><td style="font-family:var(--mono);font-size:12px;word-break:break-all">${v}</td></tr>`;
    o.innerHTML = `<div class="result"><table class="kvtable"><tbody>${row('MD5', md5(t))}${row('SHA-1', s1)}${row('SHA-256', s256)}${row('SHA-384', s384)}${row('SHA-512', s512)}</tbody></table></div>`;
  };
  $('#hin', root).addEventListener('input', run);
});
T('dev', 'unix-timestamp', 'Unix Timestamp Converter', 'Convert between Unix time and dates.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="field-row">
      <div class="field"><label>Unix timestamp <span class="hint">(s or ms)</span></label><input class="fld" id="ts" placeholder="1700000000"></div>
      <div class="field"><label>Date & time</label><input class="fld" type="datetime-local" id="dt"></div>
    </div>
    <div class="row"><button class="btn" id="tnow">Now</button></div>
    <div id="tout"></div></div>`;
  const show = d => {
    $('#tout', root).innerHTML = kv([
      ['Unix (seconds)', Math.floor(d.getTime() / 1000)],
      ['Unix (milliseconds)', d.getTime()],
      ['ISO 8601', d.toISOString()],
      ['Local', d.toLocaleString()],
      ['UTC', d.toUTCString()],
      ['Relative', relTime(d)],
    ]);
  };
  $('#ts', root).addEventListener('input', e => { let v = num(e.target.value); if (!v) return; if (String(Math.floor(v)).length <= 11) v *= 1000; show(new Date(v)); });
  $('#dt', root).addEventListener('input', e => { if (e.target.value) show(new Date(e.target.value)); });
  $('#tnow', root).onclick = () => { const d = new Date(); $('#ts', root).value = Math.floor(d.getTime() / 1000); show(d); };
});
function relTime(d) {
  const s = (d - new Date()) / 1000, abs = Math.abs(s), f = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const u = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  for (const [n, sec] of u) if (abs >= sec || n === 'second') return f.format(Math.round(s / sec), n);
}
T('dev', 'color-converter', 'Color Converter', 'HEX ⇄ RGB ⇄ HSL with live swatch.', root => {
  root.innerHTML = `<div class="tool-body"><div class="field-row">
    <div class="field"><label>Pick a color</label><input type="color" id="cpick" value="#ec5a13" style="width:100%;height:46px;border:1px solid var(--line);border-radius:10px;background:var(--panel);cursor:pointer"></div>
    <div class="field"><label>HEX</label><input class="fld" id="chex" value="#ec5a13"></div>
    </div><div id="cout"></div></div>`;
  const toHsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h, s, l = (mx + mn) / 2; if (mx === mn) h = s = 0; else { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]; };
  const render = hex => {
    if (!/^#?[0-9a-f]{6}$/i.test(hex)) { $('#cout', root).innerHTML = errBox('Enter a 6-digit hex like #ec5a13'); return; }
    hex = hex.replace('#', ''); const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    const [h, s, l] = toHsl(r, g, b);
    $('#cout', root).innerHTML = `<div class="swatch" style="background:#${hex};margin-bottom:14px"></div>` + kv([
      ['HEX', '#' + hex.toLowerCase()], ['RGB', `rgb(${r}, ${g}, ${b})`], ['HSL', `hsl(${h}, ${s}%, ${l}%)`],
      ['CSS rgb()', `rgb(${r} ${g} ${b})`],
    ]);
  };
  $('#cpick', root).addEventListener('input', e => { $('#chex', root).value = e.target.value; render(e.target.value); });
  $('#chex', root).addEventListener('input', e => { render(e.target.value); if (/^#?[0-9a-f]{6}$/i.test(e.target.value)) $('#cpick', root).value = '#' + e.target.value.replace('#', ''); });
  render('#ec5a13');
});
T('dev', 'html-escape', 'HTML Escape / Unescape', 'Encode & decode HTML entities.', root => ioTool(root, {
  placeholder: '<div class="x">Tom & Jerry</div>', wrapIn: true, wrapOut: true,
  actions: [
    { name: 'Escape', primary: true, run: t => esc(t) },
    { name: 'Unescape', run: t => { const d = document.createElement('textarea'); d.innerHTML = t; return d.value; } },
  ],
}));
T('dev', 'markdown-preview', 'Markdown Preview', 'Live Markdown → HTML preview.', root => {
  root.innerHTML = `<div class="tool-body"><div class="io-grid">
    <div class="io-col"><span class="io-label">Markdown</span><textarea class="ta wrap" id="min" style="min-height:360px" spellcheck="false"># Hello\n\nThis is **bold**, *italic*, and \`code\`.\n\n- one\n- two\n\n> A quote\n\n[link](https://example.com)</textarea></div>
    <div class="io-col"><span class="io-label">Preview</span><div class="md-preview" id="mout" style="min-height:360px"></div></div></div></div>`;
  const run = () => $('#mout', root).innerHTML = mdToHtml($('#min', root).value);
  $('#min', root).addEventListener('input', run); run();
});

/* ---------------- TEXT ---------------- */
function countStats(t) {
  const words = (t.match(/\S+/g) || []).length;
  const chars = t.length, noSpace = t.replace(/\s/g, '').length;
  const lines = t === '' ? 0 : t.split('\n').length;
  const sentences = (t.match(/[.!?]+(\s|$)/g) || []).length;
  const paras = (t.split(/\n\s*\n/).filter(p => p.trim()).length);
  return { words, chars, noSpace, lines, sentences, paras };
}
T('text', 'word-counter', 'Word Counter', 'Words, characters, sentences, reading time.', root => {
  root.innerHTML = `<div class="tool-body"><textarea class="ta wrap" id="win" style="min-height:200px" placeholder="Start typing or paste text…"></textarea><div id="wout" style="margin-top:16px"></div></div>`;
  const run = () => { const s = countStats($('#win', root).value); $('#wout', root).innerHTML = bigResult(stat(fmt(s.words, 0), 'Words', true), stat(fmt(s.chars, 0), 'Characters'), stat(fmt(s.noSpace, 0), 'No spaces'), stat(fmt(s.sentences, 0), 'Sentences'), stat(fmt(s.paras, 0), 'Paragraphs'), stat(Math.max(1, Math.ceil(s.words / 200)) + ' min', 'Read time')); };
  $('#win', root).addEventListener('input', run); run();
});
T('text', 'char-counter', 'Character Counter', 'Live character & limit checker.', root => {
  root.innerHTML = `<div class="tool-body"><textarea class="ta wrap" id="cin" style="min-height:200px" placeholder="Type here…"></textarea><div id="cco" style="margin-top:16px"></div></div>`;
  const run = () => { const t = $('#cin', root).value; const s = countStats(t); $('#cco', root).innerHTML = bigResult(stat(fmt(t.length, 0), 'Characters', true), stat(fmt(s.noSpace, 0), 'Without spaces'), stat(fmt(s.words, 0), 'Words'), stat(fmt(s.lines, 0), 'Lines')); };
  $('#cin', root).addEventListener('input', run); run();
});
T('text', 'case-converter', 'Case Converter', 'UPPER, lower, Title, camelCase, snake_case & more.', root => {
  const words = t => t.match(/[A-Za-z0-9]+/g) || [];
  ioTool(root, {
    placeholder: 'the quick brown Fox', wrapIn: true, wrapOut: true,
    actions: [
      { name: 'UPPER', primary: true, run: t => t.toUpperCase() },
      { name: 'lower', run: t => t.toLowerCase() },
      { name: 'Title Case', run: t => t.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) },
      { name: 'Sentence case', run: t => t.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, c => c.toUpperCase()) },
      { name: 'camelCase', run: t => words(t).map((w, i) => i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()).join('') },
      { name: 'snake_case', run: t => words(t).map(w => w.toLowerCase()).join('_') },
      { name: 'kebab-case', run: t => words(t).map(w => w.toLowerCase()).join('-') },
      { name: 'CONSTANT', run: t => words(t).map(w => w.toUpperCase()).join('_') },
    ],
  });
});
T('text', 'remove-duplicate-lines', 'Remove Duplicate Lines', 'Keep only unique lines.', root => ioTool(root, {
  placeholder: 'a\nb\na\nc', wrapIn: true, wrapOut: true, auto: true,
  actions: [
    { name: 'Remove duplicates', primary: true, run: t => [...new Set(t.split('\n'))].join('\n') },
    { name: 'Case-insensitive', run: t => { const seen = new Set(), out = []; t.split('\n').forEach(l => { const k = l.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(l); } }); return out.join('\n'); } },
  ],
}));
T('text', 'sort-lines', 'Sort Lines', 'Alphabetical, numeric, length or shuffle.', root => ioTool(root, {
  placeholder: 'banana\napple\ncherry', wrapIn: true, wrapOut: true,
  actions: [
    { name: 'A → Z', primary: true, run: t => t.split('\n').sort((a, b) => a.localeCompare(b)).join('\n') },
    { name: 'Z → A', run: t => t.split('\n').sort((a, b) => b.localeCompare(a)).join('\n') },
    { name: 'Numeric', run: t => t.split('\n').sort((a, b) => num(a) - num(b)).join('\n') },
    { name: 'By length', run: t => t.split('\n').sort((a, b) => a.length - b.length).join('\n') },
    { name: 'Shuffle', run: t => { const a = t.split('\n'); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a.join('\n'); } },
  ],
}));
T('text', 'reverse-text', 'Reverse Text', 'Reverse characters, words or lines.', root => ioTool(root, {
  placeholder: 'Hello World', wrapIn: true, wrapOut: true,
  actions: [
    { name: 'Reverse characters', primary: true, run: t => [...t].reverse().join('') },
    { name: 'Reverse words', run: t => t.split(/\s+/).reverse().join(' ') },
    { name: 'Reverse lines', run: t => t.split('\n').reverse().join('\n') },
  ],
}));
T('text', 'find-replace', 'Find & Replace', 'Replace text, with optional regex.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="field-row">
      <div class="field"><label>Find</label><input class="fld" id="ff" placeholder="find"></div>
      <div class="field"><label>Replace with</label><input class="fld" id="fr" placeholder="replace"></div>
    </div>
    <div class="row" style="margin-bottom:10px">
      <label class="chip" style="cursor:pointer"><input type="checkbox" id="freg"> regex</label>
      <label class="chip" style="cursor:pointer"><input type="checkbox" id="fci" checked> ignore case</label>
      <button class="btn primary" id="fgo">Replace all</button>
    </div>
    <div class="io-grid"><div class="io-col"><span class="io-label">Text</span><textarea class="ta wrap" id="ftxt" style="min-height:240px"></textarea></div>
    <div class="io-col"><span class="io-label">Result <button class="btn sm ghost js-copy" data-target="fres" style="float:right">Copy</button></span><textarea class="ta wrap out" id="fres" readonly style="min-height:240px"></textarea></div></div></div>`;
  $('#fgo', root).onclick = () => {
    const f = $('#ff', root).value, r = $('#fr', root).value, txt = $('#ftxt', root).value;
    if (!f) { $('#fres', root).value = txt; return; }
    let flags = 'g' + ($('#fci', root).checked ? 'i' : '');
    try { const re = $('#freg', root).checked ? new RegExp(f, flags) : new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags); $('#fres', root).value = txt.replace(re, r); }
    catch (e) { $('#fres', root).value = '✕ ' + e.message; }
  };
});
T('text', 'remove-blank-lines', 'Remove Blank Lines', 'Strip empty / whitespace-only lines.', root => ioTool(root, {
  placeholder: 'a\n\n\nb', wrapIn: true, wrapOut: true, auto: true,
  actions: [{ name: 'Remove blank lines', primary: true, run: t => t.split('\n').filter(l => l.trim()).join('\n') },
  { name: 'Collapse multiples', run: t => t.replace(/\n{3,}/g, '\n\n') }],
}));
T('text', 'text-cleaner', 'Text Cleaner', 'Trim lines, collapse spaces, tidy text.', root => ioTool(root, {
  placeholder: '  messy   text  ', wrapIn: true, wrapOut: true, auto: true,
  actions: [{ name: 'Clean', primary: true, run: t => t.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim() }],
}));
T('text', 'csv-to-json', 'CSV → JSON', 'Parse CSV into a JSON array of objects.', root => ioTool(root, {
  placeholder: 'name,age\nAda,30', dlName: 'data.json', wrapIn: true,
  sample: 'name,city,age\nAda,NYC,30\nLinus,Helsinki,54',
  actions: [{ name: 'To JSON', primary: true, run: t => JSON.stringify(csvToJson(t), null, 2) }],
}));
T('text', 'json-to-csv-text', 'JSON → CSV', 'Convert JSON array of objects to CSV.', root => ioTool(root, {
  placeholder: '[{"a":1}]', dlName: 'data.csv', wrapOut: true,
  sample: '[{"name":"Ada","age":30},{"name":"Linus","age":54}]',
  actions: [{ name: 'To CSV', primary: true, run: t => jsonToCsv(JSON.parse(t)) }],
}));
T('text', 'word-frequency', 'Word Frequency', 'Count how often each word appears.', root => ioTool(root, {
  placeholder: 'paste text…', wrapIn: true, wrapOut: true,
  actions: [{ name: 'Count words', primary: true, run: t => { const m = {}; (t.toLowerCase().match(/[a-z0-9']+/g) || []).forEach(w => m[w] = (m[w] || 0) + 1); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([w, c]) => `${c}\t${w}`).join('\n') || '(no words)'; } }],
}));
T('text', 'reading-time', 'Reading Time', 'Estimate reading & speaking time.', root => {
  root.innerHTML = `<div class="tool-body"><textarea class="ta wrap" id="rtin" style="min-height:200px" placeholder="Paste your article…"></textarea><div id="rto" style="margin-top:16px"></div></div>`;
  const run = () => { const w = (($('#rtin', root).value).match(/\S+/g) || []).length; $('#rto', root).innerHTML = bigResult(stat(fmt(w, 0), 'Words', true), stat(Math.max(1, Math.ceil(w / 200)) + ' min', 'Reading @200wpm'), stat(Math.max(1, Math.ceil(w / 130)) + ' min', 'Speaking @130wpm')); };
  $('#rtin', root).addEventListener('input', run); run();
});
T('text', 'text-splitter', 'Text Splitter', 'Split text by a delimiter into lines.', root => {
  root.innerHTML = `<div class="tool-body"><div class="field-row">
    <div class="field"><label>Delimiter</label><input class="fld" id="sdl" value=","></div>
    <div class="field"><label>Trim parts</label><input type="checkbox" id="strim" checked style="width:18px;height:18px;accent-color:var(--accent)"></div></div>
    <div class="io-grid"><div class="io-col"><span class="io-label">Input</span><textarea class="ta wrap" id="stin" style="min-height:220px">a, b, c, d</textarea></div>
    <div class="io-col"><span class="io-label">Output <button class="btn sm ghost js-copy" data-target="stout" style="float:right">Copy</button></span><textarea class="ta wrap out" id="stout" readonly style="min-height:220px"></textarea></div></div></div>`;
  const run = () => { let d = $('#sdl', root).value || ','; let parts = $('#stin', root).value.split(d); if ($('#strim', root).checked) parts = parts.map(p => p.trim()).filter(p => p); $('#stout', root).value = parts.join('\n'); };
  ['sdl', 'stin', 'strim'].forEach(id => $('#' + id, root).addEventListener('input', run)); run();
});
T('text', 'remove-emojis', 'Remove Emojis', 'Strip emoji & pictographs from text.', root => ioTool(root, {
  placeholder: 'Hello 👋 world 🌍!', wrapIn: true, wrapOut: true, auto: true,
  actions: [{ name: 'Remove emojis', primary: true, run: t => t.replace(/[\p{Extended_Pictographic}\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]/gu, '').replace(/\s{2,}/g, ' ') }],
}));
T('text', 'email-extractor', 'Email Extractor', 'Pull all email addresses from text.', root => ioTool(root, {
  placeholder: 'paste text containing emails…', wrapIn: true, wrapOut: true,
  actions: [{ name: 'Extract emails', primary: true, run: t => { const m = t.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []; return [...new Set(m)].join('\n') || '(none found)'; } }],
}));
T('text', 'url-extractor', 'URL Extractor', 'Pull all links from text.', root => ioTool(root, {
  placeholder: 'paste text containing links…', wrapIn: true, wrapOut: true,
  actions: [{ name: 'Extract URLs', primary: true, run: t => { const m = t.match(/\bhttps?:\/\/[^\s<>"')]+/gi) || []; return [...new Set(m)].join('\n') || '(none found)'; } }],
}));
T('text', 'phone-extractor', 'Phone Extractor', 'Pull phone numbers from text.', root => ioTool(root, {
  placeholder: 'paste text containing numbers…', wrapIn: true, wrapOut: true,
  actions: [{ name: 'Extract phones', primary: true, run: t => { const m = (t.match(/\+?\d[\d\-\s().]{7,}\d/g) || []).filter(x => (x.replace(/\D/g, '').length >= 8)); return [...new Set(m.map(x => x.trim()))].join('\n') || '(none found)'; } }],
}));

/* ---------------- EVERYDAY ---------------- */
T('everyday', 'password-generator', 'Password Generator', 'Strong random passwords.', root => calcTool(root, {
  button: 'Generate', button2: 'Regenerate',
  fields: [
    { id: 'len', label: 'Length', type: 'number', value: 16, min: 4, max: 128 },
    { id: 'up', label: 'A-Z', type: 'checkbox', value: true },
    { id: 'lo', label: 'a-z', type: 'checkbox', value: true },
    { id: 'di', label: '0-9', type: 'checkbox', value: true },
    { id: 'sy', label: 'Symbols', type: 'checkbox', value: true },
    { id: 'cnt', label: 'How many', type: 'number', value: 5, min: 1, max: 50 },
  ],
  compute: gen, compute2: gen,
}));
function gen(v) {
  let set = ''; if (v.up) set += 'ABCDEFGHJKLMNPQRSTUVWXYZ'; if (v.lo) set += 'abcdefghijkmnopqrstuvwxyz'; if (v.di) set += '23456789'; if (v.sy) set += '!@#$%^&*-_=+?';
  if (!set) return errBox('Pick at least one character set');
  const len = clamp(parseInt(v.len) || 16, 4, 128), cnt = clamp(parseInt(v.cnt) || 1, 1, 50), out = [];
  for (let i = 0; i < cnt; i++) { let p = ''; const r = crypto.getRandomValues(new Uint32Array(len)); for (let j = 0; j < len; j++) p += set[r[j] % set.length]; out.push(p); }
  return outBlock(out.join('\n'), 'pwout', 'passwords.txt');
}
T('everyday', 'lorem-ipsum', 'Lorem Ipsum', 'Placeholder paragraphs.', root => calcTool(root, {
  button: 'Generate',
  fields: [{ id: 'p', label: 'Paragraphs', type: 'number', value: 3, min: 1, max: 50 }, { id: 'len', label: 'Sentences each', type: 'number', value: 5, min: 1, max: 20 }],
  compute: v => {
    const W = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum'.split(' ');
    const rw = () => W[Math.floor(Math.random() * W.length)];
    const sent = () => { const n = 6 + Math.floor(Math.random() * 8); let s = Array.from({ length: n }, rw).join(' '); return s[0].toUpperCase() + s.slice(1) + '.'; };
    const paras = clamp(parseInt(v.p) || 3, 1, 50), sc = clamp(parseInt(v.len) || 5, 1, 20);
    const out = Array.from({ length: paras }, () => Array.from({ length: sc }, sent).join(' ')).join('\n\n');
    return outBlock(out, 'loremout', 'lorem.txt', false);
  },
}));
T('everyday', 'random-number', 'Random Number', 'Random integers in a range.', root => calcTool(root, {
  button: 'Generate',
  fields: [{ id: 'min', label: 'Min', value: 1 }, { id: 'max', label: 'Max', value: 100 }, { id: 'n', label: 'How many', value: 5, min: 1, max: 1000 }, { id: 'uniq', label: 'Unique', type: 'checkbox' }],
  compute: v => {
    const min = Math.ceil(num(v.min)), max = Math.floor(num(v.max)), n = clamp(parseInt(v.n) || 1, 1, 1000);
    if (min > max) return errBox('Min must be ≤ Max');
    if (v.uniq && (max - min + 1) < n) return errBox('Range too small for that many unique numbers');
    const out = []; const used = new Set();
    while (out.length < n) { const r = Math.floor(Math.random() * (max - min + 1)) + min; if (v.uniq) { if (used.has(r)) continue; used.add(r); } out.push(r); }
    return outBlock(out.join('\n'), 'rndout', 'numbers.txt');
  },
}));
T('everyday', 'age-calculator', 'Age Calculator', 'Exact age from a birth date.', root => calcTool(root, {
  button: 'Calculate age', auto: true,
  fields: [{ id: 'dob', label: 'Date of birth', type: 'date' }, { id: 'on', label: 'Age at date', type: 'date', hint: '(default today)' }],
  compute: v => {
    if (!v.dob) return '<p class="subtle">Pick your date of birth.</p>';
    const b = new Date(v.dob), now = v.on ? new Date(v.on) : new Date();
    if (b > now) return errBox('Birth date is in the future');
    let y = now.getFullYear() - b.getFullYear(), m = now.getMonth() - b.getMonth(), d = now.getDate() - b.getDate();
    if (d < 0) { m--; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
    if (m < 0) { y--; m += 12; }
    const days = Math.floor((now - b) / 86400000);
    const next = new Date(now.getFullYear(), b.getMonth(), b.getDate()); if (next < now) next.setFullYear(now.getFullYear() + 1);
    const toNext = Math.ceil((next - now) / 86400000);
    return bigResult(stat(y, 'Years', true), stat(m, 'Months'), stat(d, 'Days')) +
      kv([['Total days', fmt(days, 0)], ['Total weeks', fmt(Math.floor(days / 7), 0)], ['Total months', fmt(y * 12 + m, 0)], ['Next birthday', toNext + ' days']]);
  },
}));
T('everyday', 'percentage-calculator', 'Percentage Calculator', 'Common percentage questions.', root => calcTool(root, {
  button: 'Calculate', auto: true,
  fields: [{ id: 'mode', label: 'Calculation', type: 'select', options: [['p_of', 'What is X% of Y'], ['is_what', 'X is what % of Y'], ['change', '% change from X to Y']] },
  { id: 'x', label: 'X', value: 20 }, { id: 'y', label: 'Y', value: 150 }],
  compute: v => {
    const x = num(v.x), y = num(v.y);
    if (v.mode === 'p_of') return bigResult(stat(fmt(x * y / 100), `${x}% of ${y}`, true));
    if (v.mode === 'is_what') { if (!y) return errBox('Y cannot be 0'); return bigResult(stat(fmt(x / y * 100) + '%', `${x} is this % of ${y}`, true)); }
    if (!x) return errBox('X cannot be 0'); const ch = (y - x) / x * 100; return bigResult(stat((ch >= 0 ? '+' : '') + fmt(ch) + '%', `change ${x} → ${y}`, true));
  },
}));
T('everyday', 'unit-converter', 'Unit Converter', 'Length, weight & temperature.', root => {
  const sets = {
    Length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254 },
    Weight: { kg: 1, g: 0.001, mg: 1e-6, lb: 0.453592, oz: 0.0283495, ton: 1000 },
    Temperature: { '°C': 1, '°F': 1, K: 1 },
  };
  root.innerHTML = `<div class="tool-body"><div class="field-row">
    <div class="field"><label>Category</label><select class="fld" id="ucat">${Object.keys(sets).map(k => `<option>${k}</option>`).join('')}</select></div>
    <div class="field"><label>Value</label><input class="fld" id="uval" value="1"></div>
    <div class="field"><label>From</label><select class="fld" id="ufrom"></select></div>
    <div class="field"><label>To</label><select class="fld" id="uto"></select></div></div>
    <div id="uout"></div></div>`;
  const fillUnits = () => { const c = $('#ucat', root).value, opts = Object.keys(sets[c]).map(u => `<option>${u}</option>`).join(''); $('#ufrom', root).innerHTML = opts; $('#uto', root).innerHTML = opts; $('#uto', root).selectedIndex = 1; run(); };
  const run = () => {
    const c = $('#ucat', root).value, val = num($('#uval', root).value), f = $('#ufrom', root).value, t = $('#uto', root).value; let res;
    if (c === 'Temperature') { let cc = f === '°C' ? val : f === '°F' ? (val - 32) * 5 / 9 : val - 273.15; res = t === '°C' ? cc : t === '°F' ? cc * 9 / 5 + 32 : cc + 273.15; }
    else res = val * sets[c][f] / sets[c][t];
    $('#uout', root).innerHTML = bigResult(stat(fmt(res, 6), `${val} ${f} =`, true), stat(t, 'unit'));
  };
  $('#ucat', root).addEventListener('change', fillUnits);
  ['uval', 'ufrom', 'uto'].forEach(id => $('#' + id, root).addEventListener('input', run));
  fillUnits();
});
T('everyday', 'date-calculator', 'Date Calculator', 'Difference between dates & add/subtract days.', root => calcTool(root, {
  button: 'Calculate', auto: true,
  fields: [{ id: 'a', label: 'Start date', type: 'date' }, { id: 'b', label: 'End date', type: 'date' }, { id: 'add', label: 'Add days to start', type: 'number', value: 0 }],
  compute: v => {
    if (!v.a) return '<p class="subtle">Pick a start date.</p>';
    let html = '';
    const a = new Date(v.a);
    if (v.b) { const b = new Date(v.b); const days = Math.round((b - a) / 86400000); html += bigResult(stat(fmt(Math.abs(days), 0), 'Days apart', true), stat(fmt(Math.abs(days / 7), 1), 'Weeks'), stat(fmt(Math.abs(days / 30.44), 1), 'Months')); }
    const n = parseInt(v.add) || 0; if (n) { const d = new Date(a); d.setDate(d.getDate() + n); html += kv([[`Start ${n >= 0 ? '+' : ''}${n} days`, d.toDateString()]]); }
    return html || '<p class="subtle">Add an end date or a day offset.</p>';
  },
}));
T('everyday', 'stopwatch', 'Stopwatch', 'Start, stop, lap.', root => {
  root.innerHTML = `<div class="tool-body"><div class="result" style="text-align:center;padding:40px">
    <div id="swt" style="font-family:var(--mono);font-size:54px;font-weight:600;letter-spacing:-.02em">00:00.00</div>
    <div class="row" style="justify-content:center;margin-top:20px"><button class="btn primary" id="swgo">Start</button><button class="btn" id="swlap">Lap</button><button class="btn" id="swrst">Reset</button></div></div>
    <div id="swlaps" class="chips" style="margin-top:14px"></div></div>`;
  let t0 = 0, acc = 0, raf = null, laps = [];
  const fmtT = ms => { const m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000), cs = Math.floor(ms % 1000 / 10); return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`; };
  const tick = () => { $('#swt', root).textContent = fmtT(acc + (performance.now() - t0)); raf = requestAnimationFrame(tick); };
  $('#swgo', root).onclick = e => { if (raf) { acc += performance.now() - t0; cancelAnimationFrame(raf); raf = null; e.target.textContent = 'Start'; e.target.classList.add('primary'); } else { t0 = performance.now(); raf = requestAnimationFrame(tick); e.target.textContent = 'Pause'; e.target.classList.remove('primary'); } };
  $('#swlap', root).onclick = () => { const ms = acc + (raf ? performance.now() - t0 : 0); laps.unshift(fmtT(ms)); $('#swlaps', root).innerHTML = laps.map((l, i) => `<span class="chip">#${laps.length - i} ${l}</span>`).join(''); };
  $('#swrst', root).onclick = () => { cancelAnimationFrame(raf); raf = null; acc = 0; laps = []; $('#swt', root).textContent = '00:00.00'; $('#swlaps', root).innerHTML = ''; $('#swgo', root).textContent = 'Start'; $('#swgo', root).classList.add('primary'); };
  return () => cancelAnimationFrame(raf);
});
T('everyday', 'timer', 'Countdown Timer', 'Set a countdown with alarm.', root => {
  root.innerHTML = `<div class="tool-body"><div class="field-row">
    <div class="field"><label>Minutes</label><input class="fld" type="number" id="tm" value="5" min="0"></div>
    <div class="field"><label>Seconds</label><input class="fld" type="number" id="ts" value="0" min="0" max="59"></div></div>
    <div class="result" style="text-align:center;padding:36px"><div id="tdisp" style="font-family:var(--mono);font-size:54px;font-weight:600">05:00</div>
    <div class="row" style="justify-content:center;margin-top:18px"><button class="btn primary" id="tgo">Start</button><button class="btn" id="trst">Reset</button></div></div></div>`;
  let left = 300, iv = null;
  const show = () => { const m = Math.floor(left / 60), s = left % 60; $('#tdisp', root).textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
  const setFromInputs = () => { left = (parseInt($('#tm', root).value) || 0) * 60 + (parseInt($('#ts', root).value) || 0); show(); };
  ['tm', 'ts'].forEach(id => $('#' + id, root).addEventListener('input', () => { if (!iv) setFromInputs(); }));
  $('#tgo', root).onclick = e => {
    if (iv) { clearInterval(iv); iv = null; e.target.textContent = 'Resume'; return; }
    if (left <= 0) setFromInputs();
    e.target.textContent = 'Pause';
    iv = setInterval(() => { left--; show(); if (left <= 0) { clearInterval(iv); iv = null; $('#tgo', root).textContent = 'Start'; toast('⏰ Time is up!'); beep(); } }, 1000);
  };
  $('#trst', root).onclick = () => { clearInterval(iv); iv = null; setFromInputs(); $('#tgo', root).textContent = 'Start'; };
  setFromInputs();
  return () => clearInterval(iv);
});
function beep() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = .2; o.start(); setTimeout(() => { o.stop(); a.close(); }, 500); } catch {} }
T('everyday', 'pomodoro', 'Pomodoro Timer', 'Focus & break cycles.', root => {
  root.innerHTML = `<div class="tool-body"><div class="field-row">
    <div class="field"><label>Focus (min)</label><input class="fld" type="number" id="pf" value="25"></div>
    <div class="field"><label>Break (min)</label><input class="fld" type="number" id="pb" value="5"></div></div>
    <div class="result" style="text-align:center;padding:36px"><div id="pmode" class="io-label" style="margin-bottom:6px">FOCUS</div>
    <div id="pdisp" style="font-family:var(--mono);font-size:54px;font-weight:600">25:00</div>
    <div class="row" style="justify-content:center;margin-top:18px"><button class="btn primary" id="pgo">Start</button><button class="btn" id="prst">Reset</button></div>
    <div class="subtle" style="margin-top:12px">Completed focus sessions: <b id="pcnt">0</b></div></div></div>`;
  let focus = true, left = 1500, iv = null, done = 0;
  const show = () => { const m = Math.floor(left / 60), s = left % 60; $('#pdisp', root).textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; $('#pmode', root).textContent = focus ? 'FOCUS' : 'BREAK'; };
  const reset = () => { focus = true; left = (parseInt($('#pf', root).value) || 25) * 60; show(); };
  $('#pgo', root).onclick = e => {
    if (iv) { clearInterval(iv); iv = null; e.target.textContent = 'Resume'; return; }
    e.target.textContent = 'Pause';
    iv = setInterval(() => { left--; show(); if (left <= 0) { beep(); if (focus) { done++; $('#pcnt', root).textContent = done; toast('Focus done — take a break!'); focus = false; left = (parseInt($('#pb', root).value) || 5) * 60; } else { toast('Break over — back to focus!'); focus = true; left = (parseInt($('#pf', root).value) || 25) * 60; } show(); } }, 1000);
  };
  $('#prst', root).onclick = () => { clearInterval(iv); iv = null; reset(); $('#pgo', root).textContent = 'Start'; };
  reset();
  return () => clearInterval(iv);
});

/* ---------------- FINANCE ---------------- */
T('finance', 'emi', 'EMI Calculator', 'Loan equated monthly installment.', root => calcTool(root, {
  button: 'Calculate EMI', auto: true,
  fields: [{ id: 'p', label: 'Loan amount (₹)', value: 1000000 }, { id: 'r', label: 'Interest rate (% p.a.)', value: 9, step: '0.1' }, { id: 'n', label: 'Tenure (months)', value: 120 }],
  compute: v => { const P = num(v.p), r = num(v.r) / 1200, n = parseInt(v.n); if (!P || !n) return errBox('Enter amount & tenure'); const emi = r ? P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : P / n; const tot = emi * n; return bigResult(stat(money(emi), 'Monthly EMI', true), stat(money(tot - P), 'Total interest'), stat(money(tot), 'Total payable')); },
}));
T('finance', 'sip', 'SIP Calculator', 'Mutual fund SIP future value.', root => calcTool(root, {
  button: 'Calculate', auto: true,
  fields: [{ id: 'm', label: 'Monthly investment (₹)', value: 10000 }, { id: 'r', label: 'Expected return (% p.a.)', value: 12, step: '0.1' }, { id: 'y', label: 'Years', value: 10 }],
  compute: v => { const M = num(v.m), i = num(v.r) / 1200, n = num(v.y) * 12; if (!M || !n) return errBox('Enter investment & years'); const fv = i ? M * (Math.pow(1 + i, n) - 1) / i * (1 + i) : M * n; const inv = M * n; return bigResult(stat(money(fv), 'Future value', true), stat(money(inv), 'Invested'), stat(money(fv - inv), 'Est. returns')); },
}));
T('finance', 'fd', 'FD Calculator', 'Fixed deposit maturity (compound).', root => calcTool(root, {
  button: 'Calculate', auto: true,
  fields: [{ id: 'p', label: 'Principal (₹)', value: 100000 }, { id: 'r', label: 'Rate (% p.a.)', value: 7, step: '0.1' }, { id: 'y', label: 'Years', value: 5, step: '0.5' }, { id: 'n', label: 'Compounding', type: 'select', options: [['4', 'Quarterly'], ['12', 'Monthly'], ['2', 'Half-yearly'], ['1', 'Yearly']] }],
  compute: v => { const P = num(v.p), r = num(v.r) / 100, n = parseInt(v.n), t = num(v.y); if (!P) return errBox('Enter principal'); const A = P * Math.pow(1 + r / n, n * t); return bigResult(stat(money(A), 'Maturity value', true), stat(money(A - P), 'Interest earned')); },
}));
T('finance', 'rd', 'RD Calculator', 'Recurring deposit maturity (approx).', root => calcTool(root, {
  button: 'Calculate', auto: true,
  fields: [{ id: 'm', label: 'Monthly deposit (₹)', value: 5000 }, { id: 'r', label: 'Rate (% p.a.)', value: 7, step: '0.1' }, { id: 'n', label: 'Months', value: 24 }],
  compute: v => { const M = num(v.m), i = num(v.r) / 1200, n = parseInt(v.n); if (!M || !n) return errBox('Enter deposit & months'); const fv = i ? M * (Math.pow(1 + i, n) - 1) / i * (1 + i) : M * n; const inv = M * n; return bigResult(stat(money(fv), 'Maturity value', true), stat(money(inv), 'Deposited'), stat(money(fv - inv), 'Interest')); },
  note: 'Uses monthly compounding approximation.',
}));
T('finance', 'compound-interest', 'Compound Interest', 'Grow a principal over time.', root => calcTool(root, {
  button: 'Calculate', auto: true,
  fields: [{ id: 'p', label: 'Principal (₹)', value: 100000 }, { id: 'r', label: 'Rate (% p.a.)', value: 8, step: '0.1' }, { id: 't', label: 'Years', value: 10, step: '0.5' }, { id: 'n', label: 'Compounds/year', value: 1 }],
  compute: v => { const P = num(v.p), r = num(v.r) / 100, t = num(v.t), n = parseInt(v.n) || 1; const A = P * Math.pow(1 + r / n, n * t); return bigResult(stat(money(A), 'Final amount', true), stat(money(A - P), 'Interest')); },
}));
T('finance', 'simple-interest', 'Simple Interest', 'Flat interest on a principal.', root => calcTool(root, {
  button: 'Calculate', auto: true,
  fields: [{ id: 'p', label: 'Principal (₹)', value: 100000 }, { id: 'r', label: 'Rate (% p.a.)', value: 8, step: '0.1' }, { id: 't', label: 'Years', value: 5, step: '0.5' }],
  compute: v => { const P = num(v.p), si = P * num(v.r) * num(v.t) / 100; return bigResult(stat(money(si), 'Interest', true), stat(money(P + si), 'Total amount')); },
}));
T('finance', 'gst', 'GST Calculator', 'Add or remove GST.', root => calcTool(root, {
  button: 'Calculate', auto: true,
  fields: [{ id: 'amt', label: 'Amount (₹)', value: 1000 }, { id: 'rate', label: 'GST %', type: 'select', options: ['5', '12', '18', '28', '3', '0.25'] }, { id: 'mode', label: 'Mode', type: 'select', options: [['add', 'Add GST (exclusive)'], ['rem', 'Remove GST (inclusive)']] }],
  compute: v => { const a = num(v.amt), r = num(v.rate); if (v.mode === 'add') { const g = a * r / 100; return bigResult(stat(money(a), 'Base', false), stat(money(g), `GST ${r}%`, true), stat(money(a + g), 'Total')); } const base = a / (1 + r / 100); return bigResult(stat(money(base), 'Base', false), stat(money(a - base), `GST ${r}%`, true), stat(money(a), 'Total (incl.)')); },
}));
T('finance', 'discount', 'Discount Calculator', 'Final price after discount.', root => calcTool(root, {
  button: 'Calculate', auto: true,
  fields: [{ id: 'p', label: 'Original price (₹)', value: 2999 }, { id: 'd', label: 'Discount %', value: 25 }],
  compute: v => { const p = num(v.p), saved = p * num(v.d) / 100; return bigResult(stat(money(p - saved), 'You pay', true), stat(money(saved), 'You save')); },
}));
T('finance', 'roi', 'ROI Calculator', 'Return on investment.', root => calcTool(root, {
  button: 'Calculate', auto: true,
  fields: [{ id: 'inv', label: 'Amount invested (₹)', value: 100000 }, { id: 'ret', label: 'Amount returned (₹)', value: 150000 }],
  compute: v => { const i = num(v.inv), r = num(v.ret); if (!i) return errBox('Enter investment'); return bigResult(stat(fmt((r - i) / i * 100) + '%', 'ROI', true), stat(money(r - i), 'Net profit')); },
}));
T('finance', 'cagr', 'CAGR Calculator', 'Compound annual growth rate.', root => calcTool(root, {
  button: 'Calculate', auto: true,
  fields: [{ id: 'b', label: 'Initial value (₹)', value: 100000 }, { id: 'e', label: 'Final value (₹)', value: 200000 }, { id: 'y', label: 'Years', value: 5, step: '0.5' }],
  compute: v => { const b = num(v.b), e = num(v.e), y = num(v.y); if (!b || !y) return errBox('Enter values & years'); const c = (Math.pow(e / b, 1 / y) - 1) * 100; return bigResult(stat(fmt(c) + '%', 'CAGR', true), stat(money(e - b), 'Total gain')); },
}));
T('finance', 'breakeven', 'Break-even Calculator', 'Units needed to break even.', root => calcTool(root, {
  button: 'Calculate', auto: true,
  fields: [{ id: 'fc', label: 'Fixed costs (₹)', value: 100000 }, { id: 'price', label: 'Price per unit (₹)', value: 500 }, { id: 'vc', label: 'Variable cost / unit (₹)', value: 200 }],
  compute: v => { const m = num(v.price) - num(v.vc); if (m <= 0) return errBox('Price must exceed variable cost'); const u = num(v.fc) / m; return bigResult(stat(fmt(Math.ceil(u), 0), 'Break-even units', true), stat(money(Math.ceil(u) * num(v.price)), 'Break-even revenue')); },
}));
T('finance', 'margin', 'Margin Calculator', 'Profit, margin & markup.', root => calcTool(root, {
  button: 'Calculate', auto: true,
  fields: [{ id: 'cost', label: 'Cost (₹)', value: 800 }, { id: 'price', label: 'Selling price (₹)', value: 1000 }],
  compute: v => { const c = num(v.cost), p = num(v.price), profit = p - c; if (!p) return errBox('Enter price'); return bigResult(stat(money(profit), 'Profit', true), stat(fmt(profit / p * 100) + '%', 'Margin'), stat(c ? fmt(profit / c * 100) + '%' : '—', 'Markup')); },
}));
T('finance', 'income-tax-calculator', 'Income Tax Calculator (Old vs New Regime)', 'Compare Old vs New tax regime, FY 2025-26 (AY 2026-27).', root => calcTool(root, {
  button: 'Compare', auto: true,
  fields: [
    { id: 'gross', label: 'Gross Total Income (₹)', value: 900000 },
    { id: 'age', label: 'Age (years)', value: 30 },
    { id: 'ded80c', label: '80C Investments (₹)', value: 0 },
    { id: 'ded80d', label: '80D Health Insurance (₹)', value: 0 },
    { id: 'hra', label: 'HRA Exemption (₹)', value: 0 },
    { id: 'homeloan', label: 'Home Loan Interest 24b (₹)', value: 0 },
    { id: 'nps', label: 'NPS 80CCD(1B) (₹)', value: 0 },
    { id: 'other', label: 'Other Deductions (₹)', value: 0 },
  ],
  compute: v => {
    const gross = num(v.gross), age = num(v.age);
    if (!gross) return errBox('Enter gross total income');
    const ded80c = Math.min(num(v.ded80c), 150000);
    const ded80d = num(v.ded80d);
    const hra = num(v.hra);
    const homeloan = Math.min(num(v.homeloan), 200000);
    const nps = Math.min(num(v.nps), 50000);
    const other = num(v.other);
    const exemption = age >= 80 ? 500000 : age >= 60 ? 300000 : 250000;

    function slabNew(income) {
      const slabs = [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]];
      let tax = 0, prev = 0;
      for (const [limit, rate] of slabs) { if (income > prev) { tax += (Math.min(income, limit) - prev) * rate; prev = limit; } else break; }
      return tax;
    }
    function slabOld(income, exemption) {
      if (income <= exemption) return 0;
      let tax = Math.max(0, Math.min(income, 500000) - exemption) * 0.05;
      if (income > 500000) tax += (Math.min(income, 1000000) - 500000) * 0.20;
      if (income > 1000000) tax += (income - 1000000) * 0.30;
      return tax;
    }

    const stdNew = 75000;
    const taxableNew = Math.max(0, gross - stdNew);
    let taxNew = slabNew(taxableNew);
    if (taxableNew <= 1200000) taxNew = 0;
    const finalNew = Math.round(taxNew * 1.04);

    const stdOld = 50000;
    const totalDed = ded80c + ded80d + hra + homeloan + nps + other + stdOld;
    const taxableOld = Math.max(0, gross - totalDed);
    let taxOld = slabOld(taxableOld, exemption);
    if (taxableOld <= 500000) taxOld = 0;
    const finalOld = Math.round(taxOld * 1.04);

    const winner = finalNew <= finalOld ? 'New Regime' : 'Old Regime';
    const savings = Math.abs(finalNew - finalOld);

    return bigResult(
      stat(winner, 'Better Regime', true),
      stat(money(savings), 'You Save'),
      stat(money(finalOld), 'Old Regime Tax'),
      stat(money(finalNew), 'New Regime Tax')
    );
  },
}));
T('finance', 'salary', 'Salary Converter', 'Hourly ⇄ daily ⇄ monthly ⇄ yearly.', root => calcTool(root, {
  button: 'Convert', auto: true,
  fields: [{ id: 'rate', label: 'Hourly rate (₹)', value: 500 }, { id: 'hpd', label: 'Hours / day', value: 8 }, { id: 'dpw', label: 'Days / week', value: 5 }],
  compute: v => { const r = num(v.rate), h = num(v.hpd), d = num(v.dpw); const wk = r * h * d, yr = wk * 52; return bigResult(stat(money(r * h), 'Daily', true), stat(money(wk), 'Weekly'), stat(money(yr / 12), 'Monthly'), stat(money(yr), 'Yearly')); },
}));

/* ---------------- STUDENT ---------------- */
T('student', 'cgpa', 'CGPA Calculator', 'Weighted CGPA from semesters.', root => calcTool(root, {
  button: 'Calculate CGPA', auto: true,
  fields: [{ id: 'rows', label: 'One per line: GPA, credits', type: 'textarea', value: '8.5, 20\n9.0, 22\n7.8, 18' }],
  compute: v => { let tc = 0, tp = 0; v.rows.split('\n').forEach(l => { if (!l.trim()) return; const [g, c] = l.split(',').map(num); tp += g * c; tc += c; }); if (!tc) return errBox('Enter at least one GPA, credits line'); return bigResult(stat(fmt(tp / tc, 2), 'CGPA', true), stat(fmt(tc, 0), 'Total credits')); },
}));
T('student', 'gpa', 'GPA Calculator', 'GPA from grades (4.0 scale).', root => calcTool(root, {
  button: 'Calculate GPA', auto: true,
  fields: [{ id: 'rows', label: 'One per line: credits, grade (A/A-/B+…)', type: 'textarea', value: '3, A\n4, B+\n3, A-\n2, B' }],
  compute: v => { const map = { 'A+': 4, A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, D: 1, F: 0 }; let tc = 0, tp = 0; for (const l of v.rows.split('\n')) { if (!l.trim()) continue; const [c, g] = l.split(','); const cr = num(c), gp = map[(g || '').trim().toUpperCase()]; if (gp == null) return errBox('Unknown grade: ' + g); tp += gp * cr; tc += cr; } if (!tc) return errBox('Enter credits & grades'); return bigResult(stat(fmt(tp / tc, 2), 'GPA', true), stat(fmt(tc, 0), 'Credits')); },
}));
T('student', 'cgpa-to-percent', 'CGPA → Percentage', 'Convert CGPA to % (×9.5).', root => calcTool(root, {
  button: 'Convert', auto: true,
  fields: [{ id: 'cgpa', label: 'CGPA', value: 8.4, step: '0.01' }, { id: 'mul', label: 'Multiplier', value: 9.5, step: '0.1', hint: '(CBSE uses 9.5)' }],
  compute: v => bigResult(stat(fmt(num(v.cgpa) * num(v.mul)) + '%', 'Percentage', true)),
}));
T('student', 'attendance', 'Attendance Calculator', 'Your % and classes you can skip.', root => calcTool(root, {
  button: 'Calculate', auto: true,
  fields: [{ id: 'att', label: 'Classes attended', value: 42 }, { id: 'tot', label: 'Total classes', value: 50 }, { id: 'req', label: 'Required %', value: 75 }],
  compute: v => { const a = num(v.att), t = num(v.tot), req = num(v.req); if (!t) return errBox('Enter total classes'); const pct = a / t * 100; let msg; if (pct >= req) { const canSkip = Math.floor((a * 100 - req * t) / req); msg = stat(canSkip, 'Can skip', true); } else { const need = Math.ceil((req * t - a * 100) / (100 - req)); msg = stat(need, 'Must attend', true); } return bigResult(stat(fmt(pct) + '%', 'Attendance', pct >= req), msg); },
}));
T('student', 'marks', 'Marks / Grade Calculator', 'Total, percentage & grade.', root => calcTool(root, {
  button: 'Calculate', auto: true,
  fields: [{ id: 'rows', label: 'One per line: obtained, total', type: 'textarea', value: '82, 100\n74, 100\n91, 100\n68, 100' }],
  compute: v => { let ob = 0, mx = 0; for (const l of v.rows.split('\n')) { if (!l.trim()) continue; const [o, m] = l.split(',').map(num); ob += o; mx += m; } if (!mx) return errBox('Enter marks'); const p = ob / mx * 100; const g = p >= 90 ? 'A+' : p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 40 ? 'D' : 'F'; return bigResult(stat(fmt(ob, 0) + '/' + fmt(mx, 0), 'Total', false), stat(fmt(p) + '%', 'Percentage', true), stat(g, 'Grade')); },
}));

/* ---------------- STUDENT — MATHS & SCIENCE (advanced) ---------------- */

/* ── Quadratic / Cubic / Quartic Solver ── */
T('student', 'poly-solver', 'Polynomial Equation Solver', 'Solve quadratic, cubic and quartic equations with complex roots.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="field-row">
      <div class="field"><label>Degree</label>
        <select class="fld" id="ps-deg">
          <option value="2">Quadratic (ax²+bx+c)</option>
          <option value="3">Cubic (ax³+bx²+cx+d)</option>
          <option value="4">Quartic (ax⁴+bx³+cx²+dx+e)</option>
        </select></div>
    </div>
    <div class="field-row" id="ps-fields"></div>
    <div class="row"><button class="btn primary" id="ps-go">Solve</button></div>
    <div id="ps-out"></div>
  </div>`;

  const labels = { 2: ['a','b','c'], 3: ['a','b','c','d'], 4: ['a','b','c','d','e'] };
  const superscripts = { 2: ['x²','x',''], 3: ['x³','x²','x',''], 4: ['x⁴','x³','x²','x',''] };

  function buildFields() {
    const deg = parseInt($('#ps-deg', root).value);
    const lbls = labels[deg];
    $('#ps-fields', root).innerHTML = lbls.map((l, i) =>
      `<div class="field"><label>${l} <span class="hint">(${superscripts[deg][i] || 'constant'})</span></label>
       <input class="fld" id="ps-${l}" type="number" step="any" value="${i===0?1:0}"></div>`
    ).join('');
  }

  function cplx(re, im) {
    if (Math.abs(im) < 1e-9) return fmt(re, 6);
    const sign = im >= 0 ? '+' : '-';
    return `${fmt(re,6)} ${sign} ${fmt(Math.abs(im),6)}i`;
  }

  function solveQuad(a, b, c) {
    const disc = b*b - 4*a*c;
    if (disc >= 0) {
      const r1 = (-b + Math.sqrt(disc)) / (2*a);
      const r2 = (-b - Math.sqrt(disc)) / (2*a);
      return [{ re: r1, im: 0 }, { re: r2, im: 0 }];
    }
    const re = -b / (2*a), im = Math.sqrt(-disc) / (2*a);
    return [{ re, im }, { re, im: -im }];
  }

  function solveCubic(a, b, c, d) {
    // Cardano's method
    b/=a; c/=a; d/=a;
    const p = c - b*b/3;
    const q = 2*b*b*b/27 - b*c/3 + d;
    const disc = q*q/4 + p*p*p/27;
    const cbrt = (x) => x < 0 ? -Math.pow(-x, 1/3) : Math.pow(x, 1/3);
    const shift = b/3;
    if (disc > 1e-10) {
      const u = cbrt(-q/2 + Math.sqrt(disc));
      const v = cbrt(-q/2 - Math.sqrt(disc));
      const r1 = u + v - shift;
      const re = -(u+v)/2 - shift, im = (u-v)*Math.sqrt(3)/2;
      return [{ re: r1, im: 0 }, { re, im }, { re, im: -im }];
    }
    if (Math.abs(disc) <= 1e-10) {
      const u = cbrt(-q/2);
      return [{ re: 2*u - shift, im: 0 }, { re: -u - shift, im: 0 }, { re: -u - shift, im: 0 }];
    }
    const r = Math.sqrt(-p*p*p/27), theta = Math.acos(-q/(2*r));
    const m = 2*Math.cbrt(r);
    return [0,1,2].map(k => ({ re: m*Math.cos((theta+2*Math.PI*k)/3) - shift, im: 0 }));
  }

  function solveQuartic(a, b, c, d, e) {
    // Companion matrix eigenvalue approach via numerical method (Newton's + deflation)
    // Using Ferrari's method
    b/=a; c/=a; d/=a; e/=a;
    // Substitute x = t - b/4
    const s = b/4;
    const p = c - 6*s*s;
    const q = d + 2*s*(2*s*s - c);  // fixed sign
    const r2 = e - s*(d - s*(c - s*(b - 3*s)));  // constant term after shift
    // Resolvent cubic: 8m³ + 8pm² + (2p²-8r)m - q² = 0
    const roots3 = solveCubic(8, 8*p, 2*p*p - 8*r2, -q*q);
    let m = roots3.find(r => Math.abs(r.im) < 1e-6)?.re ?? roots3[0].re;
    if (m < 0) m = 0;
    const sqrtM = Math.sqrt(Math.abs(m));
    const quads = [];
    if (sqrtM < 1e-9) {
      quads.push([1, 0, p/2 + m - Math.sqrt(Math.max(0,(p/2+m)**2 - r2))]);
      quads.push([1, 0, p/2 + m + Math.sqrt(Math.max(0,(p/2+m)**2 - r2))]);
    } else {
      quads.push([1,  2*sqrtM, m + p/2 - q/(4*sqrtM)]);
      quads.push([1, -2*sqrtM, m + p/2 + q/(4*sqrtM)]);
    }
    return quads.flatMap(([qa, qb, qc]) => solveQuad(qa, qb, qc)).map(r => ({ re: r.re - s, im: r.im }));
  }

  function render() {
    const deg = parseInt($('#ps-deg', root).value);
    const coeffs = labels[deg].map(l => parseFloat($(`#ps-${l}`, root).value) || 0);
    if (coeffs[0] === 0) { $('#ps-out', root).innerHTML = errBox('Leading coefficient cannot be 0'); return; }
    let roots;
    try {
      if (deg === 2) roots = solveQuad(...coeffs);
      else if (deg === 3) roots = solveCubic(...coeffs);
      else roots = solveQuartic(...coeffs);
    } catch(e) { $('#ps-out', root).innerHTML = errBox(e.message); return; }

    const eqn = coeffs.map((c, i) => {
      const exp = deg - i;
      const term = exp > 1 ? `${c}x${superscripts[deg][i]}` : exp === 1 ? `${c}x` : `${c}`;
      return (i === 0 ? '' : (c >= 0 ? ' + ' : ' ')) + term;
    }).join('').replace(/\+ -/g,'- ') + ' = 0';

    const rowsHtml = roots.map((r, i) =>
      `<tr><td>x<sub>${i+1}</sub></td><td><b>${cplx(r.re, r.im)}</b></td>
       <td style="color:var(--muted);font-size:12px">${Math.abs(r.im) > 1e-9 ? 'Complex' : 'Real'}</td></tr>`
    ).join('');

    $('#ps-out', root).innerHTML = `
      <div class="result">
        <div class="note-box" style="font-family:var(--mono);font-size:13px;margin-bottom:12px">${esc(eqn)}</div>
        <table class="kvtable"><tbody>${rowsHtml}</tbody></table>
      </div>`;
  }

  $('#ps-deg', root).onchange = () => { buildFields(); };
  $('#ps-go', root).onclick = render;
  buildFields();
});

/* ── Linear System Solver (up to 5×5) ── */
T('student', 'linear-system', 'Linear System Solver', 'Solve systems of linear equations (up to 5×5) using Gaussian elimination.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="field-row">
      <div class="field"><label>Number of variables</label>
        <select class="fld" id="ls-n"><option>2</option><option selected>3</option><option>4</option><option>5</option></select></div>
    </div>
    <div id="ls-grid" style="margin:14px 0;overflow-x:auto"></div>
    <div class="row"><button class="btn primary" id="ls-go">Solve</button><button class="btn ghost" id="ls-clear">Clear</button></div>
    <div id="ls-out"></div>
    <div class="note-box" style="margin-top:12px">Enter coefficients in the augmented matrix [A|b]. Each row = one equation.</div>
  </div>`;

  function buildGrid() {
    const n = parseInt($('#ls-n', root).value);
    const vars = ['x','y','z','w','v'].slice(0, n);
    let html = `<table style="border-collapse:collapse;font-size:13px">
      <thead><tr>${vars.map(v => `<th style="padding:4px 8px;color:var(--muted)">${v}</th>`).join('')}<th style="padding:4px 12px;color:var(--accent)">= b</th></tr></thead><tbody>`;
    for (let i = 0; i < n; i++) {
      html += `<tr>${Array.from({length: n+1}, (_, j) =>
        `<td style="padding:4px"><input class="fld ls-cell" data-r="${i}" data-c="${j}" type="number" step="any" value="0" style="width:70px;text-align:center"></td>`
      ).join('')}</tr>`;
    }
    html += '</tbody></table>';
    $('#ls-grid', root).innerHTML = html;
  }

  function gaussianElim(M, n) {
    // Forward elimination with partial pivoting
    for (let col = 0; col < n; col++) {
      let maxRow = col;
      for (let row = col+1; row < n; row++) if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
      [M[col], M[maxRow]] = [M[maxRow], M[col]];
      if (Math.abs(M[col][col]) < 1e-12) continue;
      for (let row = col+1; row < n; row++) {
        const factor = M[row][col] / M[col][col];
        for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k];
      }
    }
    // Back substitution
    const x = new Array(n).fill(0);
    for (let i = n-1; i >= 0; i--) {
      if (Math.abs(M[i][i]) < 1e-12) {
        if (Math.abs(M[i][n]) > 1e-9) throw new Error('No solution (inconsistent system)');
        x[i] = 0; // free variable
        continue;
      }
      x[i] = M[i][n];
      for (let j = i+1; j < n; j++) x[i] -= M[i][j] * x[j];
      x[i] /= M[i][i];
    }
    return x;
  }

  $('#ls-n', root).onchange = buildGrid;
  $('#ls-clear', root).onclick = () => { root.querySelectorAll('.ls-cell').forEach(c => c.value = '0'); };
  $('#ls-go', root).onclick = () => {
    const n = parseInt($('#ls-n', root).value);
    const vars = ['x','y','z','w','v'].slice(0, n);
    const M = Array.from({length: n}, (_, i) =>
      Array.from({length: n+1}, (_, j) => parseFloat(root.querySelector(`[data-r="${i}"][data-c="${j}"]`).value) || 0)
    );
    try {
      const x = gaussianElim(M.map(r => [...r]), n);
      const rows = vars.map((v, i) => `<tr><td>${v}</td><td><b>${fmt(x[i], 8)}</b></td></tr>`).join('');
      // Verification
      const checks = Array.from({length: n}, (_, i) => {
        const lhs = M[i].slice(0, n).reduce((s, c, j) => s + c * x[j], 0);
        return Math.abs(lhs - M[i][n]) < 1e-6 ? '✓' : '✗';
      });
      $('#ls-out', root).innerHTML = `<div class="result"><table class="kvtable"><tbody>${rows}</tbody></table>
        <div class="subtle" style="margin-top:8px;font-size:12px">Verification: ${checks.join(' ')} (substituted back)</div></div>`;
    } catch(e) { $('#ls-out', root).innerHTML = errBox(e.message); }
  };
  buildGrid();
});

/* ── Matrix Calculator ── */
T('student', 'matrix-calc', 'Matrix Calculator', 'Add, multiply, determinant, inverse, transpose and rank.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="field-row">
      <div class="field"><label>Rows</label><input class="fld" type="number" id="mx-r" value="3" min="1" max="6"></div>
      <div class="field"><label>Cols</label><input class="fld" type="number" id="mx-c" value="3" min="1" max="6"></div>
      <div class="field"><label>Operation</label>
        <select class="fld" id="mx-op">
          <option value="det">Determinant</option>
          <option value="inv">Inverse</option>
          <option value="trans">Transpose</option>
          <option value="rank">Rank</option>
          <option value="add">A + B</option>
          <option value="mul">A × B</option>
        </select></div>
    </div>
    <div style="display:flex;gap:24px;flex-wrap:wrap;margin:14px 0">
      <div><div class="io-label">Matrix A</div><div id="mx-a-grid"></div></div>
      <div id="mx-b-wrap" style="display:none"><div class="io-label">Matrix B</div><div id="mx-b-grid"></div></div>
    </div>
    <div class="row"><button class="btn primary" id="mx-go">Calculate</button><button class="btn ghost" id="mx-identity">Identity</button><button class="btn ghost" id="mx-clear">Clear</button></div>
    <div id="mx-out"></div>
  </div>`;

  const makeGrid = (id, rows, cols, vals) => {
    const el = document.getElementById(id);
    el.innerHTML = Array.from({length: rows}, (_, i) =>
      `<div style="display:flex;gap:4px;margin-bottom:4px">${Array.from({length: cols}, (_, j) =>
        `<input class="fld mx-cell" data-id="${id}" data-r="${i}" data-c="${j}" type="number" step="any"
         value="${vals?.[i]?.[j] ?? 0}" style="width:60px;text-align:center;padding:6px 4px">`
      ).join('')}</div>`
    ).join('');
  };

  const readMat = (id, r, c) => Array.from({length: r}, (_, i) =>
    Array.from({length: c}, (_, j) => parseFloat(root.querySelector(`[data-id="${id}"][data-r="${i}"][data-c="${j}"]`)?.value) || 0)
  );

  const det = (M) => {
    const n = M.length;
    if (n === 1) return M[0][0];
    if (n === 2) return M[0][0]*M[1][1] - M[0][1]*M[1][0];
    return M[0].reduce((sum, val, j) => {
      const minor = M.slice(1).map(r => r.filter((_,k) => k !== j));
      return sum + (j%2===0?1:-1) * val * det(minor);
    }, 0);
  };

  const inv = (M) => {
    const n = M.length;
    const aug = M.map((r, i) => [...r, ...Array.from({length: n}, (_, j) => i===j ? 1 : 0)]);
    for (let col = 0; col < n; col++) {
      let maxRow = col;
      for (let row = col+1; row < n; row++) if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
      const pivot = aug[col][col];
      if (Math.abs(pivot) < 1e-12) throw new Error('Matrix is singular (not invertible)');
      for (let k = 0; k < 2*n; k++) aug[col][k] /= pivot;
      for (let row = 0; row < n; row++) {
        if (row === col) continue;
        const factor = aug[row][col];
        for (let k = 0; k < 2*n; k++) aug[row][k] -= factor * aug[col][k];
      }
    }
    return aug.map(r => r.slice(n));
  };

  const rank = (M) => {
    const A = M.map(r => [...r]);
    const rows = A.length, cols = A[0].length;
    let r = 0;
    for (let col = 0; col < cols && r < rows; col++) {
      let pivot = -1;
      for (let row = r; row < rows; row++) if (Math.abs(A[row][col]) > 1e-9) { pivot = row; break; }
      if (pivot === -1) continue;
      [A[r], A[pivot]] = [A[pivot], A[r]];
      for (let row = 0; row < rows; row++) {
        if (row === r || Math.abs(A[row][col]) < 1e-12) continue;
        const f = A[row][col] / A[r][col];
        for (let k = 0; k < cols; k++) A[row][k] -= f * A[r][k];
      }
      r++;
    }
    return r;
  };

  const matMul = (A, B) => {
    const ra = A.length, ca = A[0].length, cb = B[0].length;
    if (ca !== B.length) throw new Error(`Incompatible dimensions: ${ra}×${ca} × ${B.length}×${cb}`);
    return Array.from({length: ra}, (_, i) =>
      Array.from({length: cb}, (_, j) =>
        A[i].reduce((s, _, k) => s + A[i][k]*B[k][j], 0)
      )
    );
  };

  const renderMat = (M, label) => {
    const rows = M.map(r =>
      `<tr>${r.map(v => `<td style="padding:4px 10px;text-align:center;font-family:var(--mono);font-size:13px;border:1px solid var(--line)">${fmt(v,6)}</td>`).join('')}</tr>`
    ).join('');
    return `<div class="result"><div class="io-label" style="margin-bottom:6px">${label}</div>
      <table style="border-collapse:collapse">${rows}</table></div>`;
  };

  const rebuild = () => {
    const r = clamp(parseInt($('#mx-r',root).value)||3,1,6);
    const c = clamp(parseInt($('#mx-c',root).value)||3,1,6);
    const op = $('#mx-op',root).value;
    makeGrid('mx-a-grid', r, c);
    const needsB = op === 'add' || op === 'mul';
    $('#mx-b-wrap',root).style.display = needsB ? '' : 'none';
    if (needsB) makeGrid('mx-b-grid', r, c);
  };

  ['mx-r','mx-c','mx-op'].forEach(id => $('#'+id,root).addEventListener('change', rebuild));
  $('#mx-identity',root).onclick = () => {
    const n = clamp(parseInt($('#mx-r',root).value)||3,1,6);
    $('#mx-r',root).value = n; $('#mx-c',root).value = n;
    const identity = Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));
    makeGrid('mx-a-grid', n, n, identity);
    $('#mx-b-wrap',root).style.display='none';
  };
  $('#mx-clear',root).onclick = () => rebuild();

  $('#mx-go',root).onclick = () => {
    const r = clamp(parseInt($('#mx-r',root).value)||3,1,6);
    const c = clamp(parseInt($('#mx-c',root).value)||3,1,6);
    const op = $('#mx-op',root).value;
    const A = readMat('mx-a-grid', r, c);
    try {
      let html = '';
      if (op === 'det') {
        if (r !== c) throw new Error('Determinant requires a square matrix');
        html = `<div class="result">${bigResult(stat(fmt(det(A),8), 'Determinant', true))}</div>`;
      } else if (op === 'inv') {
        if (r !== c) throw new Error('Inverse requires a square matrix');
        html = renderMat(inv(A), 'A⁻¹ (Inverse)');
      } else if (op === 'trans') {
        html = renderMat(A[0].map((_,i) => A.map(r => r[i])), 'Aᵀ (Transpose)');
      } else if (op === 'rank') {
        html = `<div class="result">${bigResult(stat(rank(A), 'Rank', true))}</div>`;
      } else if (op === 'add') {
        const B = readMat('mx-b-grid', r, c);
        html = renderMat(A.map((row,i) => row.map((v,j) => v + B[i][j])), 'A + B');
      } else if (op === 'mul') {
        const B = readMat('mx-b-grid', r, c);
        html = renderMat(matMul(A, B), 'A × B');
      }
      $('#mx-out',root).innerHTML = html;
    } catch(e) { $('#mx-out',root).innerHTML = errBox(e.message); }
  };
  rebuild();
});

/* ── Statistics Calculator ── */
T('student', 'stats-calc', 'Statistics Calculator', 'Mean, median, mode, SD, variance, quartiles, skewness, z-scores.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="field"><label>Data <span class="hint">comma or newline separated</span></label>
      <textarea class="ta wrap" id="st-data" style="min-height:100px" placeholder="23, 45, 12, 67, 34, 45, 89, 12, 45, 56"></textarea></div>
    <div class="row" style="margin-top:8px">
      <button class="btn primary" id="st-go">Calculate</button>
      <button class="btn ghost" id="st-sample">Sample data</button>
    </div>
    <div id="st-out"></div>
  </div>`;

  $('#st-sample',root).onclick = () => { $('#st-data',root).value = '23, 45, 12, 67, 34, 45, 89, 12, 45, 56, 78, 34, 90, 11, 55'; run(); };

  const run = () => {
    const raw = $('#st-data',root).value.trim();
    if (!raw) return;
    const data = raw.split(/[\n,]+/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n)).sort((a,b) => a-b);
    if (!data.length) { $('#st-out',root).innerHTML = errBox('No valid numbers found'); return; }
    const n = data.length;
    const mean = data.reduce((s,v) => s+v, 0) / n;
    const median = n%2 ? data[Math.floor(n/2)] : (data[n/2-1]+data[n/2])/2;
    const freq = {}; data.forEach(v => freq[v] = (freq[v]||0)+1);
    const maxF = Math.max(...Object.values(freq));
    const mode = Object.entries(freq).filter(([,f]) => f===maxF).map(([v]) => v).join(', ');
    const variance = data.reduce((s,v) => s+(v-mean)**2, 0) / (n-1);
    const sd = Math.sqrt(variance);
    const popVar = data.reduce((s,v) => s+(v-mean)**2, 0) / n;
    const popSd = Math.sqrt(popVar);
    const q1 = data[Math.floor(n/4)];
    const q3 = data[Math.floor(3*n/4)];
    const iqr = q3 - q1;
    const skew = data.reduce((s,v) => s+((v-mean)/sd)**3, 0) / n;
    const kurt = data.reduce((s,v) => s+((v-mean)/sd)**4, 0) / n - 3;
    const zscores = data.slice(0,10).map(v => `${fmt(v,2)}→${fmt((v-mean)/sd,3)}`).join(', ');

    $('#st-out',root).innerHTML = `
      ${bigResult(
        stat(fmt(mean,6), 'Mean', true),
        stat(fmt(median,6), 'Median'),
        stat(mode, 'Mode'),
        stat(n, 'Count')
      )}
      <div class="result"><table class="kvtable"><tbody>
        <tr><td>Min</td><td><b>${fmt(data[0],6)}</b></td></tr>
        <tr><td>Max</td><td><b>${fmt(data[n-1],6)}</b></td></tr>
        <tr><td>Range</td><td><b>${fmt(data[n-1]-data[0],6)}</b></td></tr>
        <tr><td>Q1 (25th %ile)</td><td><b>${fmt(q1,6)}</b></td></tr>
        <tr><td>Q3 (75th %ile)</td><td><b>${fmt(q3,6)}</b></td></tr>
        <tr><td>IQR</td><td><b>${fmt(iqr,6)}</b></td></tr>
        <tr><td>Sample variance (s²)</td><td><b>${fmt(variance,6)}</b></td></tr>
        <tr><td>Sample SD (s)</td><td><b>${fmt(sd,6)}</b></td></tr>
        <tr><td>Population variance (σ²)</td><td><b>${fmt(popVar,6)}</b></td></tr>
        <tr><td>Population SD (σ)</td><td><b>${fmt(popSd,6)}</b></td></tr>
        <tr><td>Skewness</td><td><b>${fmt(skew,6)}</b> <span class="subtle">(${skew>0.5?'right-skewed':skew<-0.5?'left-skewed':'approx. symmetric'})</span></td></tr>
        <tr><td>Excess kurtosis</td><td><b>${fmt(kurt,6)}</b></td></tr>
        <tr><td>z-scores (first 10)</td><td style="font-size:12px;font-family:var(--mono)"><b>${zscores}</b></td></tr>
        <tr><td>Sum</td><td><b>${fmt(data.reduce((s,v)=>s+v,0),6)}</b></td></tr>
      </tbody></table></div>`;
  };

  $('#st-go',root).onclick = run;
  $('#st-data',root).addEventListener('input', () => clearTimeout(root._st_t) || (root._st_t = setTimeout(run, 400)));
});

/* ── Number Theory: Prime Factorization, LCM, HCF ── */
T('student', 'number-theory', 'Number Theory Tools', 'Prime factorization, LCM, HCF/GCD, primality test, modular arithmetic.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="field-row">
      <div class="field"><label>Operation</label>
        <select class="fld" id="nt-op">
          <option value="factor">Prime Factorization</option>
          <option value="lcm">LCM</option>
          <option value="gcd">GCD / HCF</option>
          <option value="prime">Primality Test</option>
          <option value="mod">Modular Arithmetic</option>
          <option value="euler">Euler's Totient φ(n)</option>
        </select></div>
    </div>
    <div id="nt-inputs" class="field-row"></div>
    <div class="row"><button class="btn primary" id="nt-go">Calculate</button></div>
    <div id="nt-out"></div>
  </div>`;

  const inputs = {
    factor: `<div class="field"><label>n</label><input class="fld" id="nt-a" type="number" value="360" min="2"></div>`,
    lcm:    `<div class="field"><label>Numbers <span class="hint">comma separated</span></label><input class="fld" id="nt-a" value="12, 18, 24"></div>`,
    gcd:    `<div class="field"><label>Numbers <span class="hint">comma separated</span></label><input class="fld" id="nt-a" value="48, 36, 60"></div>`,
    prime:  `<div class="field"><label>n</label><input class="fld" id="nt-a" type="number" value="104729"></div>`,
    mod:    `<div class="field"><label>a</label><input class="fld" id="nt-a" type="number" value="17"></div>
             <div class="field"><label>b</label><input class="fld" id="nt-b" type="number" value="5"></div>
             <div class="field"><label>m (modulus)</label><input class="fld" id="nt-m" type="number" value="13"></div>`,
    euler:  `<div class="field"><label>n</label><input class="fld" id="nt-a" type="number" value="36" min="1"></div>`,
  };

  $('#nt-op',root).onchange = () => { $('#nt-inputs',root).innerHTML = inputs[$('#nt-op',root).value]; };
  $('#nt-inputs',root).innerHTML = inputs['factor'];

  const primeFactors = n => {
    const factors = [];
    for (let d = 2; d*d <= n; d++) while (n%d===0) { factors.push(d); n/=d; }
    if (n > 1) factors.push(n);
    return factors;
  };
  const gcdTwo = (a,b) => b===0?a:gcdTwo(b,a%b);
  const isPrime = n => {
    if (n < 2) return false;
    if (n < 4) return true;
    if (n%2===0||n%3===0) return false;
    for (let i=5; i*i<=n; i+=6) if (n%i===0||n%(i+2)===0) return false;
    return true;
  };
  const euler = n => {
    let result = n;
    const orig = n;
    for (let p=2; p*p<=n; p++) if (n%p===0) { while(n%p===0) n/=p; result -= result/p; }
    if (n > 1) result -= result/n;
    return result;
  };

  $('#nt-go',root).onclick = () => {
    const op = $('#nt-op',root).value;
    const aVal = $('#nt-a',root)?.value || '';
    const out = $('#nt-out',root);
    try {
      if (op === 'factor') {
        const n = parseInt(aVal);
        if (n < 2 || n > 1e12) throw new Error('Enter a number between 2 and 10¹²');
        const f = primeFactors(n);
        const grouped = {};
        f.forEach(p => grouped[p] = (grouped[p]||0)+1);
        const notation = Object.entries(grouped).map(([p,e]) => e>1?`${p}^${e}`:p).join(' × ');
        out.innerHTML = `<div class="result"><table class="kvtable"><tbody>
          <tr><td>Prime factorization</td><td><b>${n} = ${notation}</b></td></tr>
          <tr><td>Factors</td><td><b>${f.join(' × ')}</b></td></tr>
          <tr><td>Number of prime factors</td><td><b>${f.length}</b></td></tr>
          <tr><td>Distinct prime factors</td><td><b>${Object.keys(grouped).join(', ')}</b></td></tr>
        </tbody></table></div>`;
      } else if (op === 'lcm') {
        const nums = aVal.split(',').map(s => parseInt(s.trim())).filter(n => n > 0);
        if (nums.length < 2) throw new Error('Enter at least 2 numbers');
        const lcmTwo = (a,b) => a/gcdTwo(a,b)*b;
        const result = nums.reduce(lcmTwo);
        out.innerHTML = `<div class="result">${bigResult(stat(result, 'LCM', true))}</div>
          <div class="result"><div class="subtle">LCM(${nums.join(', ')}) = ${result}</div></div>`;
      } else if (op === 'gcd') {
        const nums = aVal.split(',').map(s => parseInt(s.trim())).filter(n => n > 0);
        if (nums.length < 2) throw new Error('Enter at least 2 numbers');
        const result = nums.reduce(gcdTwo);
        out.innerHTML = `<div class="result">${bigResult(stat(result, 'GCD / HCF', true))}</div>`;
      } else if (op === 'prime') {
        const n = parseInt(aVal);
        const prime = isPrime(n);
        const factors = prime ? [] : primeFactors(n);
        out.innerHTML = `<div class="result">${bigResult(stat(prime ? 'Prime ✓' : 'Composite ✗', n, prime))}</div>
          ${!prime ? `<div class="result"><table class="kvtable"><tbody>
            <tr><td>Factorization</td><td><b>${factors.join(' × ')}</b></td></tr>
          </tbody></table></div>` : ''}`;
      } else if (op === 'mod') {
        const a = parseInt(aVal), b = parseInt($('#nt-b',root).value), m = parseInt($('#nt-m',root).value);
        if (m <= 0) throw new Error('Modulus must be positive');
        out.innerHTML = `<div class="result"><table class="kvtable"><tbody>
          <tr><td>a + b (mod m)</td><td><b>${((a+b)%m+m)%m}</b></td></tr>
          <tr><td>a − b (mod m)</td><td><b>${((a-b)%m+m)%m}</b></td></tr>
          <tr><td>a × b (mod m)</td><td><b>${((a*b)%m+m)%m}</b></td></tr>
          <tr><td>a mod m</td><td><b>${((a%m)+m)%m}</b></td></tr>
          <tr><td>b mod m</td><td><b>${((b%m)+m)%m}</b></td></tr>
          <tr><td>aᵇ mod m</td><td><b>${(() => { let r=1,base=((a%m)+m)%m,exp=b; while(exp>0){if(exp%2===1)r=r*base%m;base=base*base%m;exp=Math.floor(exp/2);} return r; })()}</b></td></tr>
        </tbody></table></div>`;
      } else if (op === 'euler') {
        const n = parseInt(aVal);
        if (n < 1) throw new Error('Enter a positive integer');
        const phi = euler(n);
        out.innerHTML = `<div class="result">${bigResult(stat(`φ(${n}) = ${phi}`, 'Euler\'s Totient', true))}</div>
          <div class="note-box">φ(${n}) = ${phi} means there are ${phi} integers from 1 to ${n} that are coprime to ${n}.</div>`;
      }
    } catch(e) { out.innerHTML = errBox(e.message); }
  };
});

/* ── Base Converter ── */
T('student', 'base-converter', 'Number Base Converter', 'Convert between any bases 2–36. Supports binary, octal, decimal, hex and custom.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="field-row">
      <div class="field" style="grid-column:1/-1"><label>Number</label>
        <input class="fld" id="bc-val" placeholder="Enter number…" spellcheck="false"></div>
      <div class="field"><label>From base</label>
        <select class="fld" id="bc-from">
          <option value="2">2 — Binary</option>
          <option value="8">8 — Octal</option>
          <option value="10" selected>10 — Decimal</option>
          <option value="16">16 — Hexadecimal</option>
          <option value="custom-from">Custom…</option>
        </select></div>
      <div class="field" id="bc-from-custom-wrap" style="display:none"><label>From base (2–36)</label>
        <input class="fld" id="bc-from-n" type="number" min="2" max="36" value="12"></div>
    </div>
    <div id="bc-out"></div>
  </div>`;

  $('#bc-from',root).onchange = () => {
    $('#bc-from-custom-wrap',root).style.display = $('#bc-from',root).value==='custom-from' ? '' : 'none';
    run();
  };

  const run = () => {
    const raw = $('#bc-val',root).value.trim().toUpperCase();
    if (!raw) { $('#bc-out',root).innerHTML = ''; return; }
    const fromSel = $('#bc-from',root).value;
    const fromBase = fromSel === 'custom-from' ? parseInt($('#bc-from-n',root).value)||10 : parseInt(fromSel);
    try {
      const decimal = parseInt(raw, fromBase);
      if (isNaN(decimal)) throw new Error(`"${raw}" is not a valid base-${fromBase} number`);
      const bases = [
        [2, 'Binary'], [3, 'Ternary'], [4, 'Base 4'], [6, 'Base 6'],
        [8, 'Octal'], [10, 'Decimal'], [12, 'Duodecimal'],
        [16, 'Hexadecimal'], [32, 'Base 32'], [36, 'Base 36']
      ];
      const rows = bases.map(([b, name]) =>
        `<tr${b===10?' style="font-weight:500"':''}><td>${b} <span class="subtle">(${name})</span></td>
         <td style="font-family:var(--mono)"><b>${decimal.toString(b).toUpperCase()}</b></td></tr>`
      ).join('');
      $('#bc-out',root).innerHTML = `<div class="result"><div class="note-box" style="margin-bottom:10px">
        Decimal value: <b>${decimal}</b> (input: ${raw} in base ${fromBase})</div>
        <table class="kvtable"><tbody>${rows}</tbody></table></div>`;
    } catch(e) { $('#bc-out',root).innerHTML = errBox(e.message); }
  };

  ['bc-val','bc-from-n'].forEach(id => $('#'+id,root).addEventListener('input', run));
  run();
});

/* ── Trigonometry Calculator ── */
T('student', 'trig-calc', 'Trigonometry Calculator', 'All trig functions, inverse functions, and identities — degrees or radians.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="field-row">
      <div class="field"><label>Angle</label>
        <input class="fld" id="tg-val" type="number" step="any" value="30"></div>
      <div class="field"><label>Unit</label>
        <select class="fld" id="tg-unit"><option value="deg" selected>Degrees</option><option value="rad">Radians</option></select></div>
    </div>
    <div id="tg-out"></div>
    <div style="margin-top:24px;border-top:1px solid var(--line);padding-top:16px">
      <div class="io-label" style="margin-bottom:10px">Inverse functions</div>
      <div class="field-row">
        <div class="field"><label>Value</label><input class="fld" id="tg-inv-val" type="number" step="any" value="0.5"></div>
        <div class="field"><label>Function</label>
          <select class="fld" id="tg-inv-fn">
            <option>arcsin</option><option>arccos</option><option>arctan</option>
          </select></div>
      </div>
      <div class="row"><button class="btn" id="tg-inv-go">Calculate Inverse</button></div>
      <div id="tg-inv-out"></div>
    </div>
  </div>`;

  const run = () => {
    let a = parseFloat($('#tg-val',root).value);
    if (isNaN(a)) return;
    const rad = $('#tg-unit',root).value === 'deg' ? a * Math.PI / 180 : a;
    const f6 = v => isFinite(v) ? fmt(v,8) : '∞ (undefined)';
    $('#tg-out',root).innerHTML = `<div class="result"><table class="kvtable"><tbody>
      <tr><td>sin</td><td><b>${f6(Math.sin(rad))}</b></td></tr>
      <tr><td>cos</td><td><b>${f6(Math.cos(rad))}</b></td></tr>
      <tr><td>tan</td><td><b>${f6(Math.tan(rad))}</b></td></tr>
      <tr><td>csc (1/sin)</td><td><b>${f6(1/Math.sin(rad))}</b></td></tr>
      <tr><td>sec (1/cos)</td><td><b>${f6(1/Math.cos(rad))}</b></td></tr>
      <tr><td>cot (1/tan)</td><td><b>${f6(1/Math.tan(rad))}</b></td></tr>
      <tr><td>sinh</td><td><b>${f6(Math.sinh(rad))}</b></td></tr>
      <tr><td>cosh</td><td><b>${f6(Math.cosh(rad))}</b></td></tr>
      <tr><td>tanh</td><td><b>${f6(Math.tanh(rad))}</b></td></tr>
      <tr><td>In radians</td><td><b>${fmt(rad,8)}</b></td></tr>
      <tr><td>In degrees</td><td><b>${fmt(a * (180/Math.PI) * ($('#tg-unit',root).value==='rad'?1:Math.PI/180) * 180/Math.PI,6)}</b></td></tr>
    </tbody></table></div>`;
  };

  ['tg-val','tg-unit'].forEach(id => $('#'+id,root).addEventListener('input', run));
  $('#tg-inv-go',root).onclick = () => {
    const v = parseFloat($('#tg-inv-val',root).value);
    const fn = $('#tg-inv-fn',root).value;
    const unit = $('#tg-unit',root).value;
    let rad;
    if (fn==='arcsin') { if(Math.abs(v)>1) { $('#tg-inv-out',root).innerHTML=errBox('arcsin domain: [-1,1]'); return; } rad=Math.asin(v); }
    else if (fn==='arccos') { if(Math.abs(v)>1) { $('#tg-inv-out',root).innerHTML=errBox('arccos domain: [-1,1]'); return; } rad=Math.acos(v); }
    else rad = Math.atan(v);
    const deg = rad * 180 / Math.PI;
    $('#tg-inv-out',root).innerHTML = `<div class="result"><table class="kvtable"><tbody>
      <tr><td>${fn}(${v})</td><td><b>${fmt(unit==='deg'?deg:rad,8)} ${unit==='deg'?'°':'rad'}</b></td></tr>
      <tr><td>In degrees</td><td><b>${fmt(deg,8)}°</b></td></tr>
      <tr><td>In radians</td><td><b>${fmt(rad,8)}</b></td></tr>
    </tbody></table></div>`;
  };
  run();
});

/* ── Binomial Theorem Expander ── */
T('student', 'binomial-expand', 'Binomial Theorem Expander', 'Expand (ax+by)ⁿ, find specific terms, Pascal\'s triangle row.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="field-row">
      <div class="field"><label>a <span class="hint">(coefficient)</span></label><input class="fld" id="bi-a" type="number" step="any" value="1"></div>
      <div class="field"><label>x power</label><input class="fld" id="bi-xp" type="number" value="1" min="0"></div>
      <div class="field"><label>b <span class="hint">(coefficient)</span></label><input class="fld" id="bi-b" type="number" step="any" value="1"></div>
      <div class="field"><label>y power</label><input class="fld" id="bi-yp" type="number" value="1" min="0"></div>
      <div class="field"><label>n <span class="hint">(exponent)</span></label><input class="fld" id="bi-n" type="number" value="4" min="0" max="20"></div>
    </div>
    <div class="row"><button class="btn primary" id="bi-go">Expand</button></div>
    <div id="bi-out"></div>
  </div>`;

  const binom = (n,k) => { if(k<0||k>n)return 0; if(k===0||k===n)return 1; let r=1; for(let i=0;i<k;i++){r=r*(n-i)/(i+1);} return Math.round(r); };
  const fmtCoeff = (c, first) => {
    if (c===0) return '';
    if (first) return c===1?'':c===-1?'-':String(c);
    return c>0?(c===1?' + ':` + ${c}`):(c===-1?' - ':` - ${Math.abs(c)}`);
  };

  $('#bi-go',root).onclick = () => {
    const a = parseFloat($('#bi-a',root).value)||1;
    const b = parseFloat($('#bi-b',root).value)||1;
    const xp = parseInt($('#bi-xp',root).value)||1;
    const yp = parseInt($('#bi-yp',root).value)||1;
    const n = parseInt($('#bi-n',root).value)||4;
    const terms = [];
    let expansion = '';
    for (let k=0; k<=n; k++) {
      const C = binom(n,k);
      const aPow = n-k, bPow = k;
      const coeff = C * Math.pow(a,aPow) * Math.pow(b,bPow);
      const xExp = aPow*xp, yExp = bPow*yp;
      const xPart = xExp===0?'':(xExp===1?'x':`x^${xExp}`);
      const yPart = yExp===0?'':(yExp===1?'y':`y^${yExp}`);
      const term = `${Math.abs(coeff)===1&&(xPart||yPart)?'':(coeff<0&&k>0?Math.abs(coeff):Math.abs(coeff))}${xPart}${yPart}`;
      expansion += (k===0?(coeff<0?'-':''):`${coeff<0?' - ':' + '}`) + term;
      terms.push({ k, C, coeff, term: `${coeff<0?'-':''}${term}`, xExp, yExp });
    }
    const rows = terms.map(t =>
      `<tr><td>k=${t.k}</td><td>C(${n},${t.k})=${t.C}</td><td style="font-family:var(--mono)">${t.coeff>=0?'+':'-'}${Math.abs(t.coeff)}${t.xExp?`x^${t.xExp}`:''}${t.yExp?`y^${t.yExp}`:''}</td></tr>`
    ).join('');
    const pascal = Array.from({length:n+1},(_,k)=>binom(n,k)).join('  ');
    $('#bi-out',root).innerHTML = `
      <div class="result"><div class="io-label" style="margin-bottom:8px">Expansion</div>
        <div style="font-family:var(--mono);font-size:13px;line-height:1.8;word-break:break-all;padding:12px;background:var(--panel);border-radius:var(--radius)">${esc(expansion.trim())}</div>
      </div>
      <div class="result"><div class="io-label" style="margin-bottom:8px">Term by term</div>
        <table class="kvtable"><thead><tr><td>Term</td><td>Binomial coeff</td><td>Value</td></tr></thead><tbody>${rows}</tbody></table>
      </div>
      <div class="note-box">Pascal's row n=${n}: ${pascal}</div>`;
  };
});

/* ── Sequence & Series ── */
T('student', 'sequences', 'Sequence & Series', 'AP, GP — nth term, partial sums, convergence.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="field-row">
      <div class="field"><label>Type</label>
        <select class="fld" id="sq-type">
          <option value="ap">Arithmetic Progression (AP)</option>
          <option value="gp">Geometric Progression (GP)</option>
        </select></div>
    </div>
    <div id="sq-fields" class="field-row"></div>
    <div class="row"><button class="btn primary" id="sq-go">Calculate</button></div>
    <div id="sq-out"></div>
  </div>`;

  const apFields = `
    <div class="field"><label>First term (a)</label><input class="fld" id="sq-a" type="number" step="any" value="2"></div>
    <div class="field"><label>Common difference (d)</label><input class="fld" id="sq-d" type="number" step="any" value="3"></div>
    <div class="field"><label>n (number of terms)</label><input class="fld" id="sq-n" type="number" value="10" min="1" max="1000"></div>`;
  const gpFields = `
    <div class="field"><label>First term (a)</label><input class="fld" id="sq-a" type="number" step="any" value="2"></div>
    <div class="field"><label>Common ratio (r)</label><input class="fld" id="sq-r" type="number" step="any" value="3"></div>
    <div class="field"><label>n (number of terms)</label><input class="fld" id="sq-n" type="number" value="8" min="1" max="50"></div>`;

  const setFields = () => { $('#sq-fields',root).innerHTML = $('#sq-type',root).value==='ap'?apFields:gpFields; };
  $('#sq-type',root).onchange = setFields;
  setFields();

  $('#sq-go',root).onclick = () => {
    const type = $('#sq-type',root).value;
    const a = parseFloat($('#sq-a',root).value)||0;
    const n = parseInt($('#sq-n',root).value)||10;
    const out = $('#sq-out',root);
    if (type==='ap') {
      const d = parseFloat($('#sq-d',root).value)||0;
      const nth = a + (n-1)*d;
      const sum = n/2*(2*a+(n-1)*d);
      const terms = Array.from({length:Math.min(n,15)},(_,i)=>fmt(a+i*d,4)).join(', ')+(n>15?', …':'');
      out.innerHTML = `${bigResult(stat(fmt(nth,8),'nth term (aₙ)',true),stat(fmt(sum,8),'Sum Sₙ'),stat(n,'n'))}
        <div class="result"><table class="kvtable"><tbody>
          <tr><td>Formula aₙ</td><td><b>a + (n−1)d = ${a} + (n−1)×${d}</b></td></tr>
          <tr><td>Formula Sₙ</td><td><b>n/2 × (2a+(n−1)d)</b></td></tr>
          <tr><td>First ${Math.min(n,15)} terms</td><td style="font-family:var(--mono);font-size:12px"><b>${terms}</b></td></tr>
        </tbody></table></div>`;
    } else {
      const r = parseFloat($('#sq-r',root).value)||1;
      const nth = a*Math.pow(r,n-1);
      const sum = Math.abs(r)!==1 ? a*(Math.pow(r,n)-1)/(r-1) : a*n;
      const infSum = Math.abs(r)<1 ? a/(1-r) : null;
      const terms = Array.from({length:Math.min(n,12)},(_,i)=>fmt(a*Math.pow(r,i),4)).join(', ')+(n>12?', …':'');
      out.innerHTML = `${bigResult(stat(fmt(nth,8),'nth term',true),stat(fmt(sum,8),'Sum Sₙ'),stat(infSum!=null?fmt(infSum,6):'∞','S∞'))}
        <div class="result"><table class="kvtable"><tbody>
          <tr><td>Common ratio r</td><td><b>${r}</b></td></tr>
          <tr><td>Convergent?</td><td><b>${Math.abs(r)<1?'Yes (|r| < 1)':'No (|r| ≥ 1)'}</b></td></tr>
          ${infSum!=null?`<tr><td>Sum to infinity</td><td><b>${fmt(infSum,8)}</b></td></tr>`:''}
          <tr><td>First ${Math.min(n,12)} terms</td><td style="font-family:var(--mono);font-size:12px"><b>${terms}</b></td></tr>
        </tbody></table></div>`;
    }
  };
});

/* ── Molecular Weight Calculator ── */
T('student', 'mol-weight', 'Molecular Weight Calculator', 'Enter any chemical formula — supports nested parentheses. Returns MW, composition & moles.', root => {
  const ELEMENTS = {H:1.008,He:4.003,Li:6.941,Be:9.012,B:10.811,C:12.011,N:14.007,O:15.999,F:18.998,Ne:20.180,Na:22.990,Mg:24.305,Al:26.982,Si:28.086,P:30.974,S:32.065,Cl:35.453,Ar:39.948,K:39.098,Ca:40.078,Sc:44.956,Ti:47.867,V:50.942,Cr:51.996,Mn:54.938,Fe:55.845,Co:58.933,Ni:58.693,Cu:63.546,Zn:65.38,Ga:69.723,Ge:72.640,As:74.922,Se:78.971,Br:79.904,Kr:83.798,Rb:85.468,Sr:87.620,Y:88.906,Zr:91.224,Nb:92.906,Mo:95.960,Tc:98,Ru:101.07,Rh:102.91,Pd:106.42,Ag:107.87,Cd:112.41,In:114.82,Sn:118.71,Sb:121.76,Te:127.60,I:126.90,Xe:131.29,Cs:132.91,Ba:137.33,La:138.91,Ce:140.12,Pr:140.91,Nd:144.24,Pm:145,Sm:150.36,Eu:151.96,Gd:157.25,Tb:158.93,Dy:162.50,Ho:164.93,Er:167.26,Tm:168.93,Yb:173.05,Lu:174.97,Hf:178.49,Ta:180.95,W:183.84,Re:186.21,Os:190.23,Ir:192.22,Pt:195.08,Au:196.97,Hg:200.59,Tl:204.38,Pb:207.20,Bi:208.98,Po:209,At:210,Rn:222,Fr:223,Ra:226,Ac:227,Th:232.04,Pa:231.04,U:238.03,Np:237,Pu:244,Am:243,Cm:247,Bk:247,Cf:251,Es:252,Fm:257,Md:258,No:259,Lr:262};

  function parseFormula(s) {
    const stack = [{}];
    let i = 0;
    while (i < s.length) {
      if (s[i] === '(') { stack.push({}); i++; }
      else if (s[i] === ')') {
        i++;
        let num = '';
        while (i < s.length && /\d/.test(s[i])) { num += s[i++]; }
        const count = num ? parseInt(num) : 1;
        const top = stack.pop();
        Object.entries(top).forEach(([el,n]) => stack[stack.length-1][el] = (stack[stack.length-1][el]||0) + n*count);
      } else if (/[A-Z]/.test(s[i])) {
        let el = s[i++];
        while (i < s.length && /[a-z]/.test(s[i])) el += s[i++];
        let num = '';
        while (i < s.length && /\d/.test(s[i])) num += s[i++];
        const count = num ? parseInt(num) : 1;
        if (!ELEMENTS[el]) throw new Error(`Unknown element: ${el}`);
        stack[stack.length-1][el] = (stack[stack.length-1][el]||0) + count;
      } else throw new Error(`Unexpected character: ${s[i]}`);
    }
    return stack[0];
  }

  root.innerHTML = `<div class="tool-body">
    <div class="field"><label>Chemical formula</label>
      <input class="fld" id="mw-f" placeholder="e.g. H2SO4, Ca3(PO4)2, C6H12O6" spellcheck="false" value="H2SO4"></div>
    <div class="field"><label>Mass (g) <span class="hint">optional — for mole calculation</span></label>
      <input class="fld" id="mw-mass" type="number" step="any" placeholder="e.g. 49"></div>
    <div class="row"><button class="btn primary" id="mw-go">Calculate</button></div>
    <div id="mw-out"></div>
  </div>`;

  const run = () => {
    const formula = $('#mw-f',root).value.trim();
    if (!formula) return;
    try {
      const composition = parseFormula(formula);
      let mw = 0;
      Object.entries(composition).forEach(([el,n]) => mw += ELEMENTS[el]*n);
      const mass = parseFloat($('#mw-mass',root).value);
      const molesHtml = !isNaN(mass) ? `<tr><td>Moles (given ${mass}g)</td><td><b>${fmt(mass/mw,6)} mol</b></td></tr>
        <tr><td>Molecules (N)</td><td><b>${(mass/mw*6.022e23).toExponential(4)}</b></td></tr>` : '';

      const compRows = Object.entries(composition).map(([el,n]) => {
        const elMW = ELEMENTS[el]*n;
        return `<tr><td>${el}</td><td>${n}</td><td>${fmt(ELEMENTS[el],4)}</td><td>${fmt(elMW,4)}</td><td>${fmt(elMW/mw*100,2)}%</td></tr>`;
      }).join('');

      $('#mw-out',root).innerHTML = `
        ${bigResult(stat(fmt(mw,4)+' g/mol','Molecular Weight',true),stat(Object.keys(composition).length,'Elements'))}
        <div class="result"><table class="kvtable"><tbody>
          <tr><td>Formula</td><td><b>${esc(formula)}</b></td></tr>
          <tr><td>Molar mass</td><td><b>${fmt(mw,6)} g/mol</b></td></tr>
          ${molesHtml}
        </tbody></table></div>
        <div class="result"><div class="io-label" style="margin-bottom:8px">Elemental composition</div>
          <table style="width:100%;font-size:13px;border-collapse:collapse">
            <thead><tr>${['Element','Count','Atomic wt','Mass contrib','% mass'].map(h=>`<th style="text-align:left;padding:4px 8px;color:var(--muted);border-bottom:1px solid var(--line)">${h}</th>`).join('')}</tr></thead>
            <tbody>${compRows}</tbody>
          </table></div>`;
    } catch(e) { $('#mw-out',root).innerHTML = errBox(e.message); }
  };
  $('#mw-go',root).onclick = run;
  $('#mw-f',root).addEventListener('input', () => clearTimeout(root._mw_t)||(root._mw_t=setTimeout(run,500)));
  run();
});

/* ── Chemical Equation Balancer ── */
T('student', 'chem-balancer', 'Chemical Equation Balancer', 'Balance chemical equations using linear algebra (Gaussian elimination).', root => {
  const ELEMENTS = {H:1,He:2,Li:3,Be:4,B:5,C:6,N:7,O:8,F:9,Ne:10,Na:11,Mg:12,Al:13,Si:14,P:15,S:16,Cl:17,Ar:18,K:19,Ca:20,Fe:26,Cu:29,Zn:30,Ag:47,Au:79,Pb:82,Hg:80,Br:35,I:53,Mn:25,Cr:24,Co:27,Ni:28,Ti:22};

  function parseFormula(s) {
    const stack = [{}]; let i = 0;
    while (i < s.length) {
      if (s[i]==='(') { stack.push({}); i++; }
      else if (s[i]===')') {
        i++; let num=''; while(i<s.length&&/\d/.test(s[i]))num+=s[i++];
        const cnt=num?parseInt(num):1, top=stack.pop();
        Object.entries(top).forEach(([el,n])=>stack[stack.length-1][el]=(stack[stack.length-1][el]||0)+n*cnt);
      } else if (/[A-Z]/.test(s[i])) {
        let el=s[i++]; while(i<s.length&&/[a-z]/.test(s[i]))el+=s[i++];
        let num=''; while(i<s.length&&/\d/.test(s[i]))num+=s[i++];
        stack[stack.length-1][el]=(stack[stack.length-1][el]||0)+(num?parseInt(num):1);
      } else i++;
    }
    return stack[0];
  }

  function gcd(a,b){return b===0?Math.abs(a):gcd(b,a%b);}
  function lcm(a,b){return a*b/gcd(a,b);}

  function balance(eqn) {
    // Parse into reactants and products
    const [lhs, rhs] = eqn.split(/->|→|=/).map(s=>s.trim());
    if (!rhs) throw new Error('Use -> or = to separate reactants and products');
    const reactants = lhs.split('+').map(s=>s.trim());
    const products = rhs.split('+').map(s=>s.trim());
    const compounds = [...reactants, ...products];
    const nR = reactants.length, nP = products.length, nC = compounds.length;

    // Get all elements
    const allEls = [...new Set(compounds.flatMap(c => Object.keys(parseFormula(c))))];
    const nE = allEls.length;

    // Build matrix: rows=elements, cols=compounds (reactants negative in balance sense)
    // We solve Ax=0 where A[i][j] = count of element i in compound j (negative for products)
    const M = allEls.map(el =>
      compounds.map((c,j) => {
        const cnt = parseFormula(c)[el] || 0;
        return j < nR ? cnt : -cnt;
      })
    );

    // Add constraint: first coefficient = 1 (fix x[0]=1, solve for rest)
    // Gaussian elimination on augmented [M | 0]
    // Use rational arithmetic approximation
    const rows = M.length, cols = nC;
    const aug = M.map(r => [...r, 0]);

    // Forward elimination
    let pivotRow = 0;
    for (let col = 0; col < cols && pivotRow < rows; col++) {
      let maxR = pivotRow;
      for (let r = pivotRow+1; r < rows; r++) if (Math.abs(aug[r][col]) > Math.abs(aug[maxR][col])) maxR = r;
      if (Math.abs(aug[maxR][col]) < 1e-9) continue;
      [aug[pivotRow], aug[maxR]] = [aug[maxR], aug[pivotRow]];
      for (let r = 0; r < rows; r++) {
        if (r === pivotRow || Math.abs(aug[r][col]) < 1e-12) continue;
        const f = aug[r][col] / aug[pivotRow][col];
        for (let k = 0; k <= cols; k++) aug[r][k] -= f * aug[pivotRow][k];
      }
      pivotRow++;
    }

    // Find null space (free variable = last column)
    // Set last compound coefficient = 1, back-solve
    const x = new Array(nC).fill(0);
    x[nC-1] = 1;
    for (let r = pivotRow-1; r >= 0; r--) {
      let pivCol = -1;
      for (let c = 0; c < nC; c++) if (Math.abs(aug[r][c]) > 1e-9) { pivCol = c; break; }
      if (pivCol === -1) continue;
      x[pivCol] = -aug[r][nC] / aug[r][pivCol];
      for (let c = pivCol+1; c < nC; c++) x[pivCol] -= (aug[r][c] / aug[r][pivCol]) * x[c];
    }

    // Convert to integers
    const scale = 1000;
    const ints = x.map(v => Math.round(v * scale));
    let g = ints.reduce((a,b) => gcd(Math.abs(a),Math.abs(b)));
    const coeffs = ints.map(v => Math.round(v/g));
    if (coeffs.some(c => c <= 0)) {
      // Try negating
      const neg = coeffs.map(c => -c);
      if (neg.every(c => c > 0)) return {coeffs: neg, reactants, products, compounds};
      throw new Error('Could not find positive integer coefficients. Try simplifying the equation.');
    }
    return {coeffs, reactants, products, compounds};
  }

  root.innerHTML = `<div class="tool-body">
    <div class="field"><label>Chemical equation</label>
      <input class="fld" id="cb-eq" placeholder="e.g. Fe + O2 -> Fe2O3" spellcheck="false" value="Fe + O2 -> Fe2O3"></div>
    <div class="row"><button class="btn primary" id="cb-go">Balance</button></div>
    <div class="note-box">Use <code>-></code> or <code>=</code> to separate sides. Use <code>+</code> between compounds.</div>
    <div id="cb-out"></div>
  </div>`;

  $('#cb-go',root).onclick = () => {
    try {
      const {coeffs, reactants, products, compounds} = balance($('#cb-eq',root).value);
      const nR = reactants.length;
      const fmtCompound = (c, coeff) => (coeff===1?'':coeff) + c;
      const lhs = reactants.map((c,i) => fmtCompound(c,coeffs[i])).join(' + ');
      const rhs = products.map((c,i) => fmtCompound(c,coeffs[nR+i])).join(' + ');
      $('#cb-out',root).innerHTML = `
        <div class="result">
          <div class="note-box" style="font-size:15px;font-weight:500;text-align:center;padding:16px;margin-bottom:12px">
            ${esc(lhs)} → ${esc(rhs)}
          </div>
          <table class="kvtable"><tbody>
            ${compounds.map((c,i) => `<tr><td>${c}</td><td><b>coefficient = ${coeffs[i]}</b></td></tr>`).join('')}
          </tbody></table>
        </div>`;
    } catch(e) { $('#cb-out',root).innerHTML = errBox(e.message); }
  };
});

/* ── IUPAC Name Helper ── */
T('student', 'iupac-helper', 'IUPAC Name Helper', 'Generate IUPAC names for straight-chain and branched alkanes, alkenes, alkynes, alcohols and haloalkanes.', root => {
  const prefixes = ['','meth','eth','prop','but','pent','hex','hept','oct','non','dec','undec','dodec','tridec','tetradec','pentadec','hexadec','heptadec','octadec','nonadec','icos'];
  const multipliers = ['','di','tri','tetra','penta','hexa','hepta','octa','nona','deca'];

  root.innerHTML = `<div class="tool-body">
    <div class="field-row">
      <div class="field"><label>Type</label>
        <select class="fld" id="iu-type">
          <option value="alkane">Alkane (CₙH₂ₙ₊₂)</option>
          <option value="alkene">Alkene (CₙH₂ₙ)</option>
          <option value="alkyne">Alkyne (CₙH₂ₙ₋₂)</option>
          <option value="alcohol">Alcohol (–OH)</option>
          <option value="halo">Haloalkane</option>
          <option value="cyclo">Cycloalkane</option>
        </select></div>
      <div class="field"><label>Chain length (C atoms)</label>
        <input class="fld" id="iu-n" type="number" min="1" max="20" value="6"></div>
    </div>
    <div id="iu-extra" class="field-row"></div>
    <div class="row"><button class="btn primary" id="iu-go">Generate IUPAC Name</button></div>
    <div id="iu-out"></div>
    <div style="margin-top:20px;border-top:1px solid var(--line);padding-top:16px">
      <div class="io-label" style="margin-bottom:8px">Quick reference — functional group suffixes</div>
      <table class="kvtable"><tbody>
        <tr><td>Alkane</td><td><b>–ane</b></td><td>Single bonds only</td></tr>
        <tr><td>Alkene</td><td><b>–ene</b></td><td>C=C double bond</td></tr>
        <tr><td>Alkyne</td><td><b>–yne</b></td><td>C≡C triple bond</td></tr>
        <tr><td>Alcohol</td><td><b>–ol</b></td><td>–OH group</td></tr>
        <tr><td>Aldehyde</td><td><b>–al</b></td><td>–CHO at C1</td></tr>
        <tr><td>Ketone</td><td><b>–one</b></td><td>C=O in chain</td></tr>
        <tr><td>Carboxylic acid</td><td><b>–oic acid</b></td><td>–COOH at C1</td></tr>
        <tr><td>Ester</td><td><b>–yl …oate</b></td><td>–COO–</td></tr>
        <tr><td>Amine</td><td><b>–amine</b></td><td>–NH₂</td></tr>
        <tr><td>Amide</td><td><b>–amide</b></td><td>–CONH₂</td></tr>
        <tr><td>Fluoro–</td><td><b>fluoro–</b></td><td>F substituent</td></tr>
        <tr><td>Chloro–</td><td><b>chloro–</b></td><td>Cl substituent</td></tr>
        <tr><td>Bromo–</td><td><b>bromo–</b></td><td>Br substituent</td></tr>
        <tr><td>Iodo–</td><td><b>iodo–</b></td><td>I substituent</td></tr>
      </tbody></table>
    </div>
  </div>`;

  const extraFields = {
    alkene: `<div class="field"><label>Double bond position</label><input class="fld" id="iu-pos" type="number" min="1" value="1"></div>`,
    alkyne: `<div class="field"><label>Triple bond position</label><input class="fld" id="iu-pos" type="number" min="1" value="1"></div>`,
    alcohol: `<div class="field"><label>–OH position</label><input class="fld" id="iu-pos" type="number" min="1" value="1"></div>`,
    halo: `<div class="field"><label>Halogen</label>
      <select class="fld" id="iu-hal"><option>fluoro</option><option>chloro</option><option>bromo</option><option>iodo</option></select></div>
      <div class="field"><label>Position</label><input class="fld" id="iu-pos" type="number" min="1" value="1"></div>`,
  };

  $('#iu-type',root).onchange = () => { $('#iu-extra',root).innerHTML = extraFields[$('#iu-type',root).value] || ''; };

  $('#iu-go',root).onclick = () => {
    const type = $('#iu-type',root).value;
    const n = parseInt($('#iu-n',root).value);
    const pos = parseInt($('#iu-pos',root)?.value || '1');
    if (n < 1 || n > 20) { $('#iu-out',root).innerHTML = errBox('Chain length 1–20'); return; }
    const base = prefixes[n];
    let name = '', formula = '', rules = '';

    if (type==='alkane') {
      name = base + 'ane';
      formula = `C${n}H${2*n+2}`;
      rules = 'Suffix: -ane. No functional groups.';
    } else if (type==='alkene') {
      const p = Math.min(pos, Math.floor(n/2));
      const suffix = n >= 4 ? `${p}-` : '';
      name = base + suffix.replace(/^1-/,'') + (n>=4?'':'' ) + 'ene';
      // Actually proper: hex-1-ene
      name = n>=4 ? `${base}-${p}-ene` : `${base}ene`;
      if (n===2) name='ethene'; if(n===3&&p===1)name='propene';
      formula = `C${n}H${2*n}`;
      rules = `Suffix: -ene. Number gives lowest locant to C=C. Double bond at C${p}–C${p+1}.`;
    } else if (type==='alkyne') {
      const p = Math.min(pos, Math.floor(n/2));
      name = n>=4 ? `${base}-${p}-yne` : `${base}yne`;
      if (n===2) name='ethyne'; if(n===3&&p===1)name='propyne';
      formula = `C${n}H${2*n-2}`;
      rules = `Suffix: -yne. Triple bond at C${p}–C${p+1}.`;
    } else if (type==='alcohol') {
      const p = Math.min(pos, n);
      name = n>=4 ? `${base}-${p}-ol` : `${base}anol`.replace('methan-1-ol','methanol').replace('ethan-1-ol','ethanol');
      if (n===1) name='methanol'; if(n===2)name='ethanol'; if(n===3&&p===1)name='propan-1-ol'; if(n===3&&p===2)name='propan-2-ol';
      if (n>=4) name = `${base}an-${p}-ol`;
      formula = `C${n}H${2*n+2}O`;
      rules = `Suffix: -ol. –OH group at C${p}. Parent chain = longest C chain containing –OH.`;
    } else if (type==='halo') {
      const hal = $('#iu-hal',root).value;
      const p = Math.min(pos, n);
      name = n===1 ? `${hal}methane` : n===2 ? `${hal}ethane` : `${p}-${hal}${base}ane`;
      formula = `C${n}H${2*n+1}X (X=${hal[0].toUpperCase()}${hal.slice(1,2)})`;
      rules = `Prefix: ${hal}-. Halogen at C${p}. Give lowest possible locant.`;
    } else if (type==='cyclo') {
      name = `cyclo${base}ane`;
      formula = `C${n}H${2*n}`;
      rules = 'Prefix: cyclo-. Ring structure, suffix: -ane.';
    }

    $('#iu-out',root).innerHTML = `
      <div class="result">
        ${bigResult(stat(name,'IUPAC Name',true),stat(formula,'Molecular Formula'))}
        <div class="note-box" style="margin-top:12px"><b>Naming rule:</b> ${rules}</div>
      </div>`;
  };
});

/* ── Periodic Table ── */
T('student', 'periodic-table', 'Interactive Periodic Table', 'Click any element for full properties — atomic mass, config, electronegativity, state and more.', root => {
  const EL = [
    {n:1,s:'H',name:'Hydrogen',m:1.008,g:1,p:1,cat:'nonmetal',en:2.20,st:'Gas',config:'1s¹'},
    {n:2,s:'He',name:'Helium',m:4.003,g:18,p:1,cat:'noble',en:null,st:'Gas',config:'1s²'},
    {n:3,s:'Li',name:'Lithium',m:6.941,g:1,p:2,cat:'alkali',en:0.98,st:'Solid',config:'[He]2s¹'},
    {n:4,s:'Be',name:'Beryllium',m:9.012,g:2,p:2,cat:'alkaline',en:1.57,st:'Solid',config:'[He]2s²'},
    {n:5,s:'B',name:'Boron',m:10.811,g:13,p:2,cat:'metalloid',en:2.04,st:'Solid',config:'[He]2s²2p¹'},
    {n:6,s:'C',name:'Carbon',m:12.011,g:14,p:2,cat:'nonmetal',en:2.55,st:'Solid',config:'[He]2s²2p²'},
    {n:7,s:'N',name:'Nitrogen',m:14.007,g:15,p:2,cat:'nonmetal',en:3.04,st:'Gas',config:'[He]2s²2p³'},
    {n:8,s:'O',name:'Oxygen',m:15.999,g:16,p:2,cat:'nonmetal',en:3.44,st:'Gas',config:'[He]2s²2p⁴'},
    {n:9,s:'F',name:'Fluorine',m:18.998,g:17,p:2,cat:'halogen',en:3.98,st:'Gas',config:'[He]2s²2p⁵'},
    {n:10,s:'Ne',name:'Neon',m:20.180,g:18,p:2,cat:'noble',en:null,st:'Gas',config:'[He]2s²2p⁶'},
    {n:11,s:'Na',name:'Sodium',m:22.990,g:1,p:3,cat:'alkali',en:0.93,st:'Solid',config:'[Ne]3s¹'},
    {n:12,s:'Mg',name:'Magnesium',m:24.305,g:2,p:3,cat:'alkaline',en:1.31,st:'Solid',config:'[Ne]3s²'},
    {n:13,s:'Al',name:'Aluminium',m:26.982,g:13,p:3,cat:'post-transition',en:1.61,st:'Solid',config:'[Ne]3s²3p¹'},
    {n:14,s:'Si',name:'Silicon',m:28.086,g:14,p:3,cat:'metalloid',en:1.90,st:'Solid',config:'[Ne]3s²3p²'},
    {n:15,s:'P',name:'Phosphorus',m:30.974,g:15,p:3,cat:'nonmetal',en:2.19,st:'Solid',config:'[Ne]3s²3p³'},
    {n:16,s:'S',name:'Sulfur',m:32.065,g:16,p:3,cat:'nonmetal',en:2.58,st:'Solid',config:'[Ne]3s²3p⁴'},
    {n:17,s:'Cl',name:'Chlorine',m:35.453,g:17,p:3,cat:'halogen',en:3.16,st:'Gas',config:'[Ne]3s²3p⁵'},
    {n:18,s:'Ar',name:'Argon',m:39.948,g:18,p:3,cat:'noble',en:null,st:'Gas',config:'[Ne]3s²3p⁶'},
    {n:19,s:'K',name:'Potassium',m:39.098,g:1,p:4,cat:'alkali',en:0.82,st:'Solid',config:'[Ar]4s¹'},
    {n:20,s:'Ca',name:'Calcium',m:40.078,g:2,p:4,cat:'alkaline',en:1.00,st:'Solid',config:'[Ar]4s²'},
    {n:26,s:'Fe',name:'Iron',m:55.845,g:8,p:4,cat:'transition',en:1.83,st:'Solid',config:'[Ar]3d⁶4s²'},
    {n:29,s:'Cu',name:'Copper',m:63.546,g:11,p:4,cat:'transition',en:1.90,st:'Solid',config:'[Ar]3d¹⁰4s¹'},
    {n:30,s:'Zn',name:'Zinc',m:65.38,g:12,p:4,cat:'transition',en:1.65,st:'Solid',config:'[Ar]3d¹⁰4s²'},
    {n:35,s:'Br',name:'Bromine',m:79.904,g:17,p:4,cat:'halogen',en:2.96,st:'Liquid',config:'[Ar]3d¹⁰4s²4p⁵'},
    {n:36,s:'Kr',name:'Krypton',m:83.798,g:18,p:4,cat:'noble',en:3.00,st:'Gas',config:'[Ar]3d¹⁰4s²4p⁶'},
    {n:47,s:'Ag',name:'Silver',m:107.87,g:11,p:5,cat:'transition',en:1.93,st:'Solid',config:'[Kr]4d¹⁰5s¹'},
    {n:53,s:'I',name:'Iodine',m:126.90,g:17,p:5,cat:'halogen',en:2.66,st:'Solid',config:'[Kr]4d¹⁰5s²5p⁵'},
    {n:79,s:'Au',name:'Gold',m:196.97,g:11,p:6,cat:'transition',en:2.54,st:'Solid',config:'[Xe]4f¹⁴5d¹⁰6s¹'},
    {n:80,s:'Hg',name:'Mercury',m:200.59,g:12,p:6,cat:'transition',en:2.00,st:'Liquid',config:'[Xe]4f¹⁴5d¹⁰6s²'},
    {n:82,s:'Pb',name:'Lead',m:207.20,g:14,p:6,cat:'post-transition',en:2.33,st:'Solid',config:'[Xe]4f¹⁴5d¹⁰6s²6p²'},
    {n:92,s:'U',name:'Uranium',m:238.03,g:3,p:7,cat:'actinide',en:1.38,st:'Solid',config:'[Rn]5f³6d¹7s²'},
  ];

  const catColors = {
    alkali:'#ff6b6b',alkaline:'#ffa94d',transition:'#74c0fc',
    'post-transition':'#a9e34b',metalloid:'#63e6be',nonmetal:'#ffe066',
    halogen:'#da77f2',noble:'#66d9e8',actinide:'#f783ac',lanthanide:'#e599f7'
  };

  root.innerHTML = `<div class="tool-body">
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;font-size:11px">
      ${Object.entries(catColors).map(([cat,col])=>`<span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:12px;border-radius:2px;background:${col};display:inline-block"></span>${cat}</span>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(18,minmax(0,1fr));gap:2px;margin-bottom:16px" id="pt-grid"></div>
    <div id="pt-detail" style="display:none"></div>
    <div class="note-box">Showing common elements. Click any element for full details.</div>
  </div>`;

  const grid = $('#pt-grid',root);
  // Build 18×7 grid
  const cells = Array.from({length:7*18}, () => null);
  EL.forEach(el => { const idx=(el.p-1)*18+(el.g-1); cells[idx]=el; });

  grid.innerHTML = cells.map((el,i) => el
    ? `<div title="${el.name}" data-z="${el.n}" style="background:${catColors[el.cat]||'#ddd'};border-radius:3px;padding:2px;cursor:pointer;text-align:center;min-height:36px;display:flex;flex-direction:column;justify-content:center;align-items:center" class="pt-cell">
        <div style="font-size:8px;color:rgba(0,0,0,0.6)">${el.n}</div>
        <div style="font-size:11px;font-weight:600;color:#000">${el.s}</div>
       </div>`
    : `<div style="min-height:36px"></div>`
  ).join('');

  grid.querySelectorAll('.pt-cell').forEach(cell => cell.onclick = () => {
    const z = parseInt(cell.dataset.z);
    const el = EL.find(e => e.n===z);
    if (!el) return;
    const detail = $('#pt-detail',root);
    detail.style.display = '';
    detail.innerHTML = `<div class="result" style="border-left:4px solid ${catColors[el.cat]||'#ddd'}">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">
        <div style="width:60px;height:60px;background:${catColors[el.cat]};border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center">
          <div style="font-size:10px;color:rgba(0,0,0,0.6)">${el.n}</div>
          <div style="font-size:22px;font-weight:700;color:#000">${el.s}</div>
        </div>
        <div>
          <div style="font-size:18px;font-weight:500">${el.name}</div>
          <div class="subtle">${el.cat}</div>
        </div>
      </div>
      <table class="kvtable"><tbody>
        <tr><td>Atomic number</td><td><b>${el.n}</b></td></tr>
        <tr><td>Atomic mass</td><td><b>${el.m} u</b></td></tr>
        <tr><td>Period</td><td><b>${el.p}</b></td></tr>
        <tr><td>Group</td><td><b>${el.g}</b></td></tr>
        <tr><td>Electron config</td><td><b>${el.config}</b></td></tr>
        <tr><td>Electronegativity</td><td><b>${el.en ?? '—'} (Pauling)</b></td></tr>
        <tr><td>State at STP</td><td><b>${el.st}</b></td></tr>
        <tr><td>Category</td><td><b>${el.cat}</b></td></tr>
      </tbody></table>
    </div>`;
    detail.scrollIntoView({behavior:'smooth', block:'nearest'});
  });
});

/* ── Physics Formula Reference ── */
T('student', 'physics-formulas', 'Physics Formula Reference', 'Searchable reference of 100+ physics formulas — mechanics, optics, thermodynamics, electrostatics, waves.', root => {
  const FORMULAS = [
    // Mechanics
    {topic:'Mechanics',name:'Newton\'s 2nd Law',f:'F = ma',vars:'F=force(N), m=mass(kg), a=acceleration(m/s²)'},
    {topic:'Mechanics',name:'Kinematic — velocity',f:'v = u + at',vars:'v=final vel, u=initial vel, a=accel, t=time'},
    {topic:'Mechanics',name:'Kinematic — displacement',f:'s = ut + ½at²',vars:'s=displacement(m)'},
    {topic:'Mechanics',name:'Kinematic — v²',f:'v² = u² + 2as',vars:'time-independent'},
    {topic:'Mechanics',name:'Kinematic — avg displacement',f:'s = (u+v)t/2',vars:''},
    {topic:'Mechanics',name:'Weight',f:'W = mg',vars:'g=9.8 m/s²'},
    {topic:'Mechanics',name:'Momentum',f:'p = mv',vars:'p=momentum(kg·m/s)'},
    {topic:'Mechanics',name:'Impulse',f:'J = FΔt = Δp',vars:'J=impulse(N·s)'},
    {topic:'Mechanics',name:'Work',f:'W = Fd cosθ',vars:'W=work(J), θ=angle with displacement'},
    {topic:'Mechanics',name:'Kinetic Energy',f:'KE = ½mv²',vars:'KE in Joules'},
    {topic:'Mechanics',name:'Potential Energy (gravitational)',f:'PE = mgh',vars:'h=height(m)'},
    {topic:'Mechanics',name:'Power',f:'P = W/t = Fv',vars:'P=power(W)'},
    {topic:'Mechanics',name:'Efficiency',f:'η = (P_out/P_in) × 100%',vars:''},
    {topic:'Mechanics',name:'Centripetal acceleration',f:'a_c = v²/r = ω²r',vars:'r=radius, ω=angular velocity'},
    {topic:'Mechanics',name:'Centripetal force',f:'F_c = mv²/r',vars:''},
    {topic:'Mechanics',name:'Angular velocity',f:'ω = 2πf = 2π/T',vars:'f=frequency, T=period'},
    {topic:'Mechanics',name:'Torque',f:'τ = rF sinθ',vars:'τ=torque(N·m)'},
    {topic:'Mechanics',name:'Moment of inertia (point)',f:'I = mr²',vars:''},
    {topic:'Mechanics',name:'Angular momentum',f:'L = Iω',vars:'L=angular momentum'},
    {topic:'Mechanics',name:'Universal Gravitation',f:'F = Gm₁m₂/r²',vars:'G=6.674×10⁻¹¹ N·m²/kg²'},
    {topic:'Mechanics',name:'Gravitational PE',f:'U = -Gm₁m₂/r',vars:''},
    {topic:'Mechanics',name:'Escape velocity',f:'v_e = √(2GM/R)',vars:'M=planet mass, R=radius'},
    // Waves & Oscillations
    {topic:'Waves',name:'Wave speed',f:'v = fλ',vars:'f=frequency(Hz), λ=wavelength(m)'},
    {topic:'Waves',name:'Period & frequency',f:'T = 1/f',vars:'T=period(s)'},
    {topic:'Waves',name:'Simple pendulum period',f:'T = 2π√(L/g)',vars:'L=length(m)'},
    {topic:'Waves',name:'Spring-mass period',f:'T = 2π√(m/k)',vars:'k=spring constant(N/m)'},
    {topic:'Waves',name:'Hooke\'s Law',f:'F = -kx',vars:'x=extension(m)'},
    {topic:'Waves',name:'Elastic PE (spring)',f:'U = ½kx²',vars:''},
    {topic:'Waves',name:'Doppler effect (source moving)',f:'f\' = f(v ± v_o)/(v ∓ v_s)',vars:'v=sound speed, v_o=observer speed, v_s=source speed'},
    {topic:'Waves',name:'Intensity',f:'I = P/A',vars:'I=intensity(W/m²), A=area'},
    {topic:'Waves',name:'Decibel',f:'β = 10 log(I/I₀)',vars:'I₀=10⁻¹² W/m²'},
    // Thermodynamics
    {topic:'Thermodynamics',name:'Ideal Gas Law',f:'PV = nRT',vars:'P=pressure(Pa), V=volume(m³), n=moles, R=8.314 J/mol·K, T=temp(K)'},
    {topic:'Thermodynamics',name:'Combined Gas Law',f:'P₁V₁/T₁ = P₂V₂/T₂',vars:''},
    {topic:'Thermodynamics',name:'First Law of Thermodynamics',f:'ΔU = Q - W',vars:'ΔU=internal energy, Q=heat added, W=work done by system'},
    {topic:'Thermodynamics',name:'Heat capacity',f:'Q = mcΔT',vars:'c=specific heat capacity(J/kg·K)'},
    {topic:'Thermodynamics',name:'Latent heat',f:'Q = mL',vars:'L=latent heat(J/kg)'},
    {topic:'Thermodynamics',name:'Efficiency (heat engine)',f:'η = 1 - T_C/T_H',vars:'T_C=cold reservoir, T_H=hot reservoir (K)'},
    {topic:'Thermodynamics',name:'Entropy change',f:'ΔS = Q_rev/T',vars:'S=entropy(J/K)'},
    {topic:'Thermodynamics',name:'Kinetic theory avg KE',f:'KE_avg = (3/2)k_BT',vars:'k_B=1.38×10⁻²³ J/K'},
    {topic:'Thermodynamics',name:'Stefan-Boltzmann',f:'P = εσAT⁴',vars:'σ=5.67×10⁻⁸ W/m²K⁴, ε=emissivity'},
    // Electrostatics & Current
    {topic:'Electrostatics',name:'Coulomb\'s Law',f:'F = kq₁q₂/r²',vars:'k=8.99×10⁹ N·m²/C²'},
    {topic:'Electrostatics',name:'Electric field',f:'E = F/q = kQ/r²',vars:'E in N/C or V/m'},
    {topic:'Electrostatics',name:'Electric potential',f:'V = kQ/r',vars:'V=volts'},
    {topic:'Electrostatics',name:'Potential energy',f:'U = qV = kq₁q₂/r',vars:''},
    {topic:'Electrostatics',name:'Capacitance',f:'C = Q/V',vars:'C=capacitance(F)'},
    {topic:'Electrostatics',name:'Parallel plate capacitor',f:'C = ε₀A/d',vars:'ε₀=8.85×10⁻¹² F/m'},
    {topic:'Electrostatics',name:'Energy stored in capacitor',f:'U = ½CV² = Q²/2C',vars:''},
    {topic:'Electrostatics',name:'Ohm\'s Law',f:'V = IR',vars:'V=voltage(V), I=current(A), R=resistance(Ω)'},
    {topic:'Electrostatics',name:'Electric power',f:'P = IV = I²R = V²/R',vars:''},
    {topic:'Electrostatics',name:'Resistors in series',f:'R_eq = R₁+R₂+…',vars:''},
    {topic:'Electrostatics',name:'Resistors in parallel',f:'1/R_eq = 1/R₁+1/R₂+…',vars:''},
    {topic:'Electrostatics',name:'Kirchhoff\'s Voltage Law',f:'ΣV = 0 (closed loop)',vars:''},
    {topic:'Electrostatics',name:'Kirchhoff\'s Current Law',f:'ΣI_in = ΣI_out',vars:''},
    // Magnetism
    {topic:'Magnetism',name:'Lorentz force',f:'F = q(v × B)',vars:'B=magnetic field(T)'},
    {topic:'Magnetism',name:'Force on current',f:'F = BIL sinθ',vars:'L=wire length(m)'},
    {topic:'Magnetism',name:'Magnetic field (long wire)',f:'B = μ₀I/2πr',vars:'μ₀=4π×10⁻⁷ T·m/A'},
    {topic:'Magnetism',name:'Faraday\'s Law',f:'EMF = -dΦ/dt',vars:'Φ=magnetic flux(Wb)'},
    {topic:'Magnetism',name:'Magnetic flux',f:'Φ = BA cosθ',vars:''},
    {topic:'Magnetism',name:'Inductance EMF',f:'EMF = -L(dI/dt)',vars:'L=inductance(H)'},
    // Optics
    {topic:'Optics',name:'Snell\'s Law',f:'n₁sinθ₁ = n₂sinθ₂',vars:'n=refractive index'},
    {topic:'Optics',name:'Critical angle',f:'sinθ_c = n₂/n₁',vars:'For total internal reflection'},
    {topic:'Optics',name:'Lens formula',f:'1/f = 1/v - 1/u',vars:'f=focal length, v=image dist, u=object dist'},
    {topic:'Optics',name:'Magnification',f:'m = v/u = h_i/h_o',vars:'h=height'},
    {topic:'Optics',name:'Mirror formula',f:'1/f = 1/v + 1/u',vars:''},
    {topic:'Optics',name:'Power of lens',f:'P = 1/f',vars:'P in diopters(D), f in metres'},
    {topic:'Optics',name:'Diffraction grating',f:'d sinθ = mλ',vars:'d=grating spacing, m=order'},
    {topic:'Optics',name:'de Broglie wavelength',f:'λ = h/mv',vars:'h=6.626×10⁻³⁴ J·s'},
    // Modern Physics
    {topic:'Modern Physics',name:'Photoelectric effect',f:'KE_max = hf - φ',vars:'h=Planck const, f=frequency, φ=work function'},
    {topic:'Modern Physics',name:'Energy of photon',f:'E = hf = hc/λ',vars:'c=3×10⁸ m/s'},
    {topic:'Modern Physics',name:'Bohr radius (H)',f:'r_n = n²a₀',vars:'a₀=0.529 Å'},
    {topic:'Modern Physics',name:'Mass-energy equivalence',f:'E = mc²',vars:'c=3×10⁸ m/s'},
    {topic:'Modern Physics',name:'Radioactive decay',f:'N = N₀e^(-λt)',vars:'λ=decay constant'},
    {topic:'Modern Physics',name:'Half-life',f:'t₁/₂ = ln2/λ = 0.693/λ',vars:''},
    {topic:'Modern Physics',name:'Heisenberg uncertainty',f:'ΔxΔp ≥ ℏ/2',vars:'ℏ=h/2π=1.055×10⁻³⁴ J·s'},
  ];

  const topics = [...new Set(FORMULAS.map(f=>f.topic))];
  const topicColors = {Mechanics:'#74c0fc',Waves:'#63e6be',Thermodynamics:'#ffa94d',Electrostatics:'#da77f2',Magnetism:'#ff6b6b',Optics:'#ffe066','Modern Physics':'#a9e34b'};

  root.innerHTML = `<div class="tool-body">
    <div class="field"><input class="fld" id="pf-search" placeholder="Search formulas… e.g. kinetic energy, Snell, ideal gas" spellcheck="false"></div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0">
      <button class="btn sm ghost pf-cat active" data-cat="">All</button>
      ${topics.map(t=>`<button class="btn sm ghost pf-cat" data-cat="${t}" style="border-color:${topicColors[t]||'var(--line)'}">${t}</button>`).join('')}
    </div>
    <div id="pf-out"></div>
  </div>`;

  let activeCat = '';
  const render = (q='') => {
    const lower = q.toLowerCase();
    const filtered = FORMULAS.filter(f =>
      (!activeCat || f.topic===activeCat) &&
      (!q || f.name.toLowerCase().includes(lower) || f.f.toLowerCase().includes(lower) || f.topic.toLowerCase().includes(lower) || f.vars.toLowerCase().includes(lower))
    );
    const byTopic = {};
    filtered.forEach(f => { (byTopic[f.topic]=byTopic[f.topic]||[]).push(f); });
    $('#pf-out',root).innerHTML = Object.entries(byTopic).map(([topic,fmls])=>`
      <div style="margin-bottom:16px">
        <div style="font-weight:500;font-size:13px;color:${topicColors[topic]||'var(--accent)'};margin-bottom:6px;display:flex;align-items:center;gap:6px">
          <span style="width:10px;height:10px;border-radius:2px;background:${topicColors[topic]||'#ddd'};display:inline-block"></span>${topic}
        </div>
        <table style="width:100%;font-size:13px;border-collapse:collapse">${fmls.map(f=>`
          <tr style="border-bottom:1px solid var(--line)">
            <td style="padding:8px 6px;color:var(--text-secondary);width:30%">${f.name}</td>
            <td style="padding:8px 6px;font-family:var(--mono);font-size:12px;font-weight:500;color:var(--accent)">${esc(f.f)}</td>
            <td style="padding:8px 6px;font-size:11px;color:var(--muted)">${esc(f.vars)}</td>
          </tr>`).join('')}
        </table>
      </div>`).join('') || '<div class="empty-note">No formulas match your search.</div>';
  };

  $('#pf-search',root).addEventListener('input', e => render(e.target.value));
  root.querySelectorAll('.pf-cat').forEach(b => b.onclick = () => {
    root.querySelectorAll('.pf-cat').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); activeCat = b.dataset.cat;
    render($('#pf-search',root).value);
  });
  render();
});


/* ---------------- SEO & WEB ---------------- */
T('seo', 'meta-tags', 'Meta Tag Generator', 'Title, description & viewport tags.', root => calcTool(root, {
  button: 'Generate', auto: true,
  fields: [{ id: 'title', label: 'Page title', type: 'text', value: 'My Awesome Page' }, { id: 'desc', label: 'Description', type: 'text', value: 'A short, compelling description under 160 chars.' }, { id: 'kw', label: 'Keywords (comma)', type: 'text', value: 'tools, free, online' }, { id: 'author', label: 'Author', type: 'text', value: '' }],
  compute: v => { const t = [`<title>${esc(v.title)}</title>`, `<meta name="description" content="${esc(v.desc)}">`]; if (v.kw) t.push(`<meta name="keywords" content="${esc(v.kw)}">`); if (v.author) t.push(`<meta name="author" content="${esc(v.author)}">`); t.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">', '<meta charset="UTF-8">'); return outBlock(t.join('\n'), 'metaout', 'meta.html', false); },
}));
T('seo', 'open-graph', 'Open Graph Generator', 'Facebook / LinkedIn og: tags.', root => calcTool(root, {
  button: 'Generate', auto: true,
  fields: [{ id: 'title', label: 'og:title', type: 'text', value: 'My Awesome Page' }, { id: 'desc', label: 'og:description', type: 'text', value: 'Short description for social shares.' }, { id: 'url', label: 'og:url', type: 'text', value: 'https://example.com' }, { id: 'img', label: 'og:image', type: 'text', value: 'https://example.com/cover.jpg' }, { id: 'type', label: 'og:type', type: 'select', options: ['website', 'article', 'product'] }],
  compute: v => outBlock([`<meta property="og:title" content="${esc(v.title)}">`, `<meta property="og:description" content="${esc(v.desc)}">`, `<meta property="og:type" content="${v.type}">`, `<meta property="og:url" content="${esc(v.url)}">`, `<meta property="og:image" content="${esc(v.img)}">`].join('\n'), 'ogout', 'og.html', false),
}));
T('seo', 'twitter-card', 'Twitter Card Generator', 'twitter: meta tags.', root => calcTool(root, {
  button: 'Generate', auto: true,
  fields: [{ id: 'card', label: 'Card type', type: 'select', options: ['summary_large_image', 'summary'] }, { id: 'title', label: 'Title', type: 'text', value: 'My Awesome Page' }, { id: 'desc', label: 'Description', type: 'text', value: 'Short description.' }, { id: 'img', label: 'Image URL', type: 'text', value: 'https://example.com/cover.jpg' }, { id: 'site', label: '@site', type: 'text', value: '@mysite' }],
  compute: v => outBlock([`<meta name="twitter:card" content="${v.card}">`, `<meta name="twitter:title" content="${esc(v.title)}">`, `<meta name="twitter:description" content="${esc(v.desc)}">`, `<meta name="twitter:image" content="${esc(v.img)}">`, `<meta name="twitter:site" content="${esc(v.site)}">`].join('\n'), 'twout', 'twitter.html', false),
}));
T('seo', 'robots-txt', 'Robots.txt Generator', 'Build a robots.txt file.', root => calcTool(root, {
  button: 'Generate', auto: true,
  fields: [{ id: 'agent', label: 'User-agent', type: 'text', value: '*' }, { id: 'allow', label: 'Allow (one per line)', type: 'textarea', value: '/' }, { id: 'disallow', label: 'Disallow (one per line)', type: 'textarea', value: '/admin\n/private' }, { id: 'sitemap', label: 'Sitemap URL', type: 'text', value: 'https://example.com/sitemap.xml' }],
  compute: v => { let o = `User-agent: ${v.agent || '*'}\n`; v.allow.split('\n').filter(x => x.trim()).forEach(p => o += `Allow: ${p.trim()}\n`); v.disallow.split('\n').filter(x => x.trim()).forEach(p => o += `Disallow: ${p.trim()}\n`); if (v.sitemap) o += `\nSitemap: ${v.sitemap}\n`; return outBlock(o, 'robout', 'robots.txt', false); },
}));
T('seo', 'slug', 'Slug Generator', 'URL-friendly slugs.', root => ioTool(root, {
  placeholder: 'My Great Blog Post! (2024)', wrapIn: true, wrapOut: true, auto: true,
  actions: [{ name: 'Make slug', primary: true, run: t => t.split('\n').map(l => l.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')).join('\n') }],
}));
T('seo', 'utm-builder', 'UTM Builder', 'Tag campaign URLs.', root => calcTool(root, {
  button: 'Build URL', auto: true,
  fields: [{ id: 'url', label: 'Website URL', type: 'text', value: 'https://example.com' }, { id: 'source', label: 'utm_source', type: 'text', value: 'newsletter' }, { id: 'medium', label: 'utm_medium', type: 'text', value: 'email' }, { id: 'campaign', label: 'utm_campaign', type: 'text', value: 'spring_sale' }, { id: 'term', label: 'utm_term', type: 'text', value: '' }, { id: 'content', label: 'utm_content', type: 'text', value: '' }],
  compute: v => { if (!v.url) return errBox('Enter a URL'); const p = new URLSearchParams(); [['utm_source', v.source], ['utm_medium', v.medium], ['utm_campaign', v.campaign], ['utm_term', v.term], ['utm_content', v.content]].forEach(([k, val]) => { if (val) p.set(k, val); }); return outBlock(v.url + (v.url.includes('?') ? '&' : '?') + p.toString(), 'utmout', 'utm.txt', false); },
}));
T('seo', 'keyword-density', 'Keyword Density', 'Top words & their density.', root => ioTool(root, {
  placeholder: 'Paste your content…', wrapIn: true, wrapOut: true,
  actions: [{ name: 'Analyze', primary: true, run: t => { const words = t.toLowerCase().match(/[a-z0-9']+/g) || []; const total = words.length; if (!total) return '(no words)'; const m = {}; words.forEach(w => m[w] = (m[w] || 0) + 1); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([w, c]) => `${(c / total * 100).toFixed(2)}%\t${c}\t${w}`).join('\n'); } }],
  note: 'Columns: density · count · word (top 25).',
}));
T('seo', 'faq-schema', 'FAQ Schema', 'FAQPage JSON-LD structured data.', root => calcTool(root, {
  button: 'Generate', auto: true,
  fields: [{ id: 'rows', label: 'One Q&A per block. Line 1 = question, line 2 = answer, blank line between', type: 'textarea', value: 'What is your return policy?\nReturns accepted within 30 days.\n\nDo you ship internationally?\nYes, we ship worldwide.' }],
  compute: v => { const blocks = v.rows.split(/\n\s*\n/).map(b => b.split('\n')).filter(b => b[0] && b[0].trim()); const data = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: blocks.map(b => ({ '@type': 'Question', name: b[0].trim(), acceptedAnswer: { '@type': 'Answer', text: (b.slice(1).join(' ')).trim() } })) }; return outBlock('<script type="application/ld+json">\n' + JSON.stringify(data, null, 2) + '\n</' + 'script>', 'faqout', 'faq-schema.html', false); },
}));
T('seo', 'article-schema', 'Article Schema', 'Article JSON-LD structured data.', root => calcTool(root, {
  button: 'Generate', auto: true,
  fields: [{ id: 'headline', label: 'Headline', type: 'text', value: 'How to use FreeToolHub' }, { id: 'author', label: 'Author', type: 'text', value: 'Jane Doe' }, { id: 'date', label: 'Published date', type: 'date' }, { id: 'img', label: 'Image URL', type: 'text', value: 'https://example.com/cover.jpg' }],
  compute: v => { const data = { '@context': 'https://schema.org', '@type': 'Article', headline: v.headline, image: [v.img], author: { '@type': 'Person', name: v.author }, datePublished: v.date || new Date().toISOString().slice(0, 10) }; return outBlock('<script type="application/ld+json">\n' + JSON.stringify(data, null, 2) + '\n</' + 'script>', 'artout', 'article-schema.html', false); },
}));
T('seo', 'product-schema', 'Product Schema', 'Product JSON-LD with offer.', root => calcTool(root, {
  button: 'Generate', auto: true,
  fields: [{ id: 'name', label: 'Product name', type: 'text', value: 'Wireless Headphones' }, { id: 'desc', label: 'Description', type: 'text', value: 'Noise-cancelling over-ear headphones.' }, { id: 'price', label: 'Price', type: 'text', value: '4999' }, { id: 'cur', label: 'Currency', type: 'text', value: 'INR' }, { id: 'img', label: 'Image URL', type: 'text', value: 'https://example.com/p.jpg' }],
  compute: v => { const data = { '@context': 'https://schema.org', '@type': 'Product', name: v.name, description: v.desc, image: v.img, offers: { '@type': 'Offer', price: v.price, priceCurrency: v.cur, availability: 'https://schema.org/InStock' } }; return outBlock('<script type="application/ld+json">\n' + JSON.stringify(data, null, 2) + '\n</' + 'script>', 'prodout', 'product-schema.html', false); },
}));
T('seo', 'serp-preview', 'SERP Snippet Preview', 'See how your page looks in Google search results — with live pixel-width and character checks.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="field-row">
      <div class="field"><label>Page Title <span class="hint" id="sp-title-count">0 / 60</span></label>
        <input class="fld" id="sp-title" placeholder="e.g. Free Online Tools — No Login Required | FreeToolHub" spellcheck="false" value="Free Online Tools — No Login Required | FreeToolHub"></div>
      <div class="field"><label>URL</label>
        <input class="fld" id="sp-url" placeholder="e.g. https://freetoolhub.app/tools/json-formatter" spellcheck="false" value="https://freetoolhub.app/tools/json-formatter"></div>
      <div class="field" style="grid-column:1/-1"><label>Meta Description <span class="hint" id="sp-desc-count">0 / 160</span></label>
        <textarea class="ta wrap" id="sp-desc" style="min-height:80px" placeholder="A short, compelling summary of the page…" spellcheck="false">Beautify JSON, convert to CSV/XML, validate and minify — free online, no login, nothing ever leaves your browser.</textarea></div>
    </div>

    <div class="row" style="margin:4px 0 16px">
      <button class="btn sm ghost active" id="sp-mode-desktop" data-mode="desktop">🖥 Desktop</button>
      <button class="btn sm ghost" id="sp-mode-mobile" data-mode="mobile">📱 Mobile</button>
    </div>

    <div class="io-label" style="margin-bottom:8px">Google Preview</div>
    <div id="sp-preview" style="background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px 24px;font-family:arial,sans-serif;max-width:600px"></div>

    <div id="sp-warnings" style="margin-top:16px"></div>
    <div class="note-box" style="margin-top:12px">Google typically shows ~55–60 characters of title (~580px) and ~150–160 characters of description (~920px) on desktop before truncating with "…". Actual cutoff varies by device, font rendering and query — treat this as a close estimate, not a guarantee.</div>
  </div>`;

  let mode = 'desktop';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const pxWidth = (text, px, weight = '400') => {
    ctx.font = `${weight} ${px}px arial`;
    return ctx.measureText(text).width;
  };

  const truncateToWidth = (text, maxPx, px, weight) => {
    if (pxWidth(text, px, weight) <= maxPx) return text;
    let lo = 0, hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (pxWidth(text.slice(0, mid) + '…', px, weight) <= maxPx) lo = mid; else hi = mid - 1;
    }
    return text.slice(0, lo).trim() + '…';
  };

  const setMode = m => {
    mode = m;
    $('#sp-mode-desktop', root).classList.toggle('active', m === 'desktop');
    $('#sp-mode-mobile', root).classList.toggle('active', m === 'mobile');
    render();
  };
  $('#sp-mode-desktop', root).onclick = () => setMode('desktop');
  $('#sp-mode-mobile', root).onclick = () => setMode('mobile');

  const render = () => {
    const rawTitle = $('#sp-title', root).value || '(untitled page)';
    const rawDesc = $('#sp-desc', root).value || '';
    let rawUrl = $('#sp-url', root).value || 'https://example.com';
    if (!/^https?:\/\//i.test(rawUrl)) rawUrl = 'https://' + rawUrl;

    let host = '', path = '';
    try {
      const u = new URL(rawUrl);
      host = u.hostname.replace(/^www\./, '');
      path = u.pathname.split('/').filter(Boolean).join(' › ');
    } catch { host = rawUrl; }

    $('#sp-title-count', root).textContent = `${rawTitle.length} / 60`;
    $('#sp-title-count', root).style.color = rawTitle.length > 60 ? 'var(--err,#e5484d)' : rawTitle.length < 30 ? 'var(--muted,#888)' : 'var(--ok,#2ba84a)';
    $('#sp-desc-count', root).textContent = `${rawDesc.length} / 160`;
    $('#sp-desc-count', root).style.color = rawDesc.length > 160 ? 'var(--err,#e5484d)' : rawDesc.length < 70 ? 'var(--muted,#888)' : 'var(--ok,#2ba84a)';

    const isMobile = mode === 'mobile';
    const titlePx = isMobile ? 20 : 20;
    const titleMaxWidth = isMobile ? 340 : 600;
    const descPx = isMobile ? 14 : 14;
    const descMaxWidth = isMobile ? 340 : 600;

    const shownTitle = truncateToWidth(esc(rawTitle), titleMaxWidth, titlePx, '400');
    const shownDesc = truncateToWidth(esc(rawDesc), descMaxWidth * 2, descPx, '400'); // desc wraps to ~2 lines

    const previewWidth = isMobile ? '360px' : '600px';
    $('#sp-preview', root).style.maxWidth = previewWidth;
    $('#sp-preview', root).innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <div style="width:28px;height:28px;border-radius:50%;background:#f1f3f4;display:flex;align-items:center;justify-content:center;font-size:14px;color:#5f6368;flex-shrink:0">🌐</div>
        <div style="overflow:hidden">
          <div style="color:#202124;font-size:14px;line-height:1.3">${esc(host)}</div>
          <div style="color:#4d5156;font-size:12px;line-height:1.3">${esc(rawUrl.replace(/^https?:\/\//, ''))}</div>
        </div>
      </div>
      <div style="color:#1a0dab;font-size:${isMobile ? 18 : 20}px;line-height:1.3;margin-bottom:3px;font-family:arial,sans-serif;${isMobile ? '' : 'max-width:600px'}">${shownTitle}</div>
      <div style="color:#4d5156;font-size:${isMobile ? 13 : 14}px;line-height:1.5;font-family:arial,sans-serif">${shownDesc}</div>
    `;

    const warnings = [];
    if (rawTitle.length > 60) warnings.push('Title may get truncated in search results — try trimming it under ~60 characters.');
    if (rawTitle.length < 15) warnings.push('Title looks quite short — consider making it more descriptive.');
    if (rawDesc.length > 160) warnings.push('Meta description may get truncated — aim for under ~160 characters.');
    if (rawDesc.length < 50 && rawDesc.length > 0) warnings.push('Meta description is short — Google may replace it with auto-generated text from the page.');
    if (!rawDesc) warnings.push('No meta description set — Google will auto-generate a snippet from page content.');

    $('#sp-warnings', root).innerHTML = warnings.length
      ? warnings.map(w => `<div class="status err" style="margin-top:6px">⚠ ${esc(w)}</div>`).join('')
      : `<div class="status ok">✓ Title and description are within Google's typical display limits</div>`;
  };

  ['sp-title', 'sp-url', 'sp-desc'].forEach(id => $('#' + id, root).addEventListener('input', render));
  render();
});

/* ---------------- IMAGE (canvas) ---------------- */
function imagePicker(root, onImg) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="dropzone" id="dz">⬆ Click or drop an image here<br><span class="subtle">PNG · JPG · WEBP · GIF — never leaves your browser</span></div><input type="file" id="fi" accept="image/*" hidden>`;
  root.appendChild(wrap);
  const dz = $('#dz', wrap), fi = $('#fi', wrap);
  const load = file => { if (!file || !file.type.startsWith('image')) { toast('Please choose an image'); return; } const img = new Image(); img.onload = () => onImg(img, file); img.onerror = () => toast('Could not load image'); img.src = URL.createObjectURL(file); };
  dz.onclick = () => fi.click();
  fi.onchange = e => load(e.target.files[0]);
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('drag'); };
  dz.ondragleave = () => dz.classList.remove('drag');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('drag'); load(e.dataTransfer.files[0]); };
}
function imageTool(root, cfg) {
  root.innerHTML = `<div class="tool-body"><div id="pick"></div><div id="ed" style="display:none">
    <div class="field-row" id="ctrls"></div>
    <div class="row" style="margin:6px 0 16px"><button class="btn primary" id="proc">${cfg.button || 'Process'}</button><button class="btn" id="dl">Download</button><button class="btn ghost" id="again">Choose another</button></div>
    <div class="io-grid"><div class="io-col"><span class="io-label">Original</span><div id="orig"></div></div>
    <div class="io-col"><span class="io-label">Result <span id="rinfo" class="subtle"></span></span><div id="res"></div></div></div>
    ${cfg.extra ? `<div id="extra"></div>` : ''}</div></div>`;
  let curImg = null, curFile = null, lastBlob = null, lastName = 'image.png';
  const ed = $('#ed', root);
  $('#ctrls', root).innerHTML = cfg.controls || '';
  imagePicker($('#pick', root), (img, file) => { curImg = img; curFile = file; $('#pick', root).style.display = 'none'; ed.style.display = 'block'; $('#orig', root).innerHTML = `<img class="preview-img" src="${img.src}"><div class="subtle" style="margin-top:6px">${img.naturalWidth}×${img.naturalHeight} · ${(file.size / 1024).toFixed(0)} KB</div>`; if (cfg.onLoad) cfg.onLoad(root, img); process(); });
  const process = () => {
    if (!curImg) return;
    const canvas = document.createElement('canvas');
    const opts = cfg.read ? cfg.read(root) : {};
    cfg.draw(curImg, canvas, opts);
    const type = opts.mime || 'image/png';
    const q = opts.quality != null ? opts.quality : 0.92;
    canvas.toBlob(blob => {
      lastBlob = blob; lastName = (cfg.name ? cfg.name(curFile, opts) : 'image.png');
      $('#res', root).innerHTML = `<img class="preview-img" src="${URL.createObjectURL(blob)}">`;
      $('#rinfo', root).textContent = `· ${canvas.width}×${canvas.height} · ${(blob.size / 1024).toFixed(0)} KB`;
      if (cfg.afterBlob) cfg.afterBlob(root, blob, canvas);
    }, type, q);
  };
  $('#proc', root).onclick = process;
  $('#dl', root).onclick = () => lastBlob ? download(lastBlob, lastName) : toast('Process first');
  $('#again', root).onclick = () => { $('#pick', root).style.display = 'block'; ed.style.display = 'none'; curImg = null; };
}
T('image', 'image-resize', 'Image Resizer', 'Resize to exact pixels.', root => imageTool(root, {
  button: 'Resize',
  controls: `<div class="field"><label>Width (px)</label><input class="fld" id="iw" type="number"></div>
    <div class="field"><label>Height (px)</label><input class="fld" id="ih" type="number"></div>
    <div class="field"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ilock" checked style="width:17px;height:17px;accent-color:var(--accent)"> Lock aspect ratio</label></div>`,
  onLoad: (root, img) => { $('#iw', root).value = img.naturalWidth; $('#ih', root).value = img.naturalHeight; const ar = img.naturalWidth / img.naturalHeight; $('#iw', root).oninput = () => { if ($('#ilock', root).checked) $('#ih', root).value = Math.round(num($('#iw', root).value) / ar); }; $('#ih', root).oninput = () => { if ($('#ilock', root).checked) $('#iw', root).value = Math.round(num($('#ih', root).value) * ar); }; },
  read: root => ({ w: parseInt($('#iw', root).value), h: parseInt($('#ih', root).value) }),
  draw: (img, c, o) => { c.width = o.w || img.naturalWidth; c.height = o.h || img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); },
  name: f => 'resized-' + f.name.replace(/\.\w+$/, '') + '.png',
}));
T('image', 'image-compress', 'Image Compressor', 'Shrink JPG/WEBP file size.', root => imageTool(root, {
  button: 'Compress',
  controls: `<div class="field"><label>Quality <span class="hint" id="qv">80%</span></label><input type="range" id="iq" min="10" max="100" value="80" style="width:100%;accent-color:var(--accent)"></div>
    <div class="field"><label>Format</label><select class="fld" id="ifmt"><option value="image/jpeg">JPEG</option><option value="image/webp">WEBP</option></select></div>`,
  onLoad: root => { $('#iq', root).oninput = e => $('#qv', root).textContent = e.target.value + '%'; },
  read: root => ({ quality: num($('#iq', root).value) / 100, mime: $('#ifmt', root).value }),
  draw: (img, c) => { c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0); },
  name: (f, o) => 'compressed-' + f.name.replace(/\.\w+$/, '') + (o.mime === 'image/webp' ? '.webp' : '.jpg'),
}));
T('image', 'image-convert', 'Image Format Converter', 'PNG ⇄ JPG ⇄ WEBP.', root => imageTool(root, {
  button: 'Convert',
  controls: `<div class="field"><label>Convert to</label><select class="fld" id="cfmt"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WEBP</option></select></div>`,
  read: root => ({ mime: $('#cfmt', root).value, quality: 0.92 }),
  draw: (img, c, o) => { c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); if (o.mime === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); } x.drawImage(img, 0, 0); },
  name: (f, o) => f.name.replace(/\.\w+$/, '') + (o.mime === 'image/png' ? '.png' : o.mime === 'image/webp' ? '.webp' : '.jpg'),
}));
T('image', 'image-rotate-flip', 'Rotate & Flip', 'Rotate 90° steps and mirror.', root => imageTool(root, {
  button: 'Apply',
  controls: `<div class="field"><label>Rotate</label><select class="fld" id="rdeg"><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></div>
    <div class="field"><label>Flip</label><select class="fld" id="rflip"><option value="none">None</option><option value="h">Horizontal</option><option value="v">Vertical</option></select></div>`,
  read: root => ({ deg: parseInt($('#rdeg', root).value), flip: $('#rflip', root).value }),
  draw: (img, c, o) => { const w = img.naturalWidth, h = img.naturalHeight, r = o.deg % 180 !== 0; c.width = r ? h : w; c.height = r ? w : h; const x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2); x.rotate(o.deg * Math.PI / 180); x.scale(o.flip === 'h' ? -1 : 1, o.flip === 'v' ? -1 : 1); x.drawImage(img, -w / 2, -h / 2); },
  name: f => 'edited-' + f.name.replace(/\.\w+$/, '') + '.png',
}));
T('image', 'image-grayscale', 'Grayscale & Filters', 'Grayscale, sepia, invert, blur.', root => imageTool(root, {
  button: 'Apply',
  controls: `<div class="field"><label>Filter</label><select class="fld" id="gfx"><option value="grayscale(1)">Grayscale</option><option value="sepia(1)">Sepia</option><option value="invert(1)">Invert</option><option value="blur(4px)">Blur</option><option value="contrast(1.4)">High contrast</option><option value="brightness(1.3)">Brighten</option></select></div>`,
  read: root => ({ fx: $('#gfx', root).value }),
  draw: (img, c, o) => { c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.filter = o.fx; x.drawImage(img, 0, 0); },
  name: f => 'filtered-' + f.name.replace(/\.\w+$/, '') + '.png',
}));
T('image', 'image-base64', 'Image → Base64', 'Encode an image as a data URI.', root => imageTool(root, {
  button: 'Encode', extra: true,
  draw: (img, c) => { c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); },
  afterBlob: (root, blob, canvas) => { const url = canvas.toDataURL('image/png'); $('#extra', root).innerHTML = `<div style="margin-top:16px">${outBlock(url, 'b64out', 'image-base64.txt', false)}</div>`; },
  name: () => 'image.png',
}));


/* ---------------- PDF ---------------- */
/* pdf-lib loaded per-tool via CDN; we just register the T() entries here */

T('pdf', 'pdf-merge', 'PDF Merger', 'Combine multiple PDFs into one file.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="dropzone" id="pdf-dz">⬆ Click or drop PDF files here<br><span class="subtle">Multiple files supported · Never leaves your browser</span></div>
    <input type="file" id="pdf-fi" accept="application/pdf" multiple hidden>
    <div id="pdf-list" style="margin-top:14px;display:flex;flex-direction:column;gap:8px"></div>
    <div class="row" style="margin-top:14px">
      <button class="btn primary" id="pdf-go">Merge PDFs</button>
      <button class="btn ghost" id="pdf-clear">Clear all</button>
    </div>
    <div class="status muted" id="pdf-st"></div>
  </div>`;

  let files = [];
  const dz = $('#pdf-dz', root), fi = $('#pdf-fi', root), list = $('#pdf-list', root), st = $('#pdf-st', root);

  const renderList = () => {
    list.innerHTML = files.map((f, i) => `
      <div style="display:flex;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:10px 14px">
        <span style="font-size:18px">📄</span>
        <span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</span>
        <span class="subtle" style="font-size:12px">${(f.size/1024).toFixed(0)} KB</span>
        <button class="btn sm ghost" data-rm="${i}">✕</button>
      </div>`).join('');
    list.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { files.splice(+b.dataset.rm, 1); renderList(); });
  };

  const addFiles = newFiles => { files.push(...[...newFiles].filter(f => f.type === 'application/pdf')); renderList(); };
  dz.onclick = () => fi.click();
  fi.onchange = e => addFiles(e.target.files);
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('drag'); };
  dz.ondragleave = () => dz.classList.remove('drag');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('drag'); addFiles(e.dataTransfer.files); };
  $('#pdf-clear', root).onclick = () => { files = []; renderList(); st.textContent = ''; };

  $('#pdf-go', root).onclick = async () => {
    if (files.length < 2) { st.className = 'status err'; st.textContent = '✕ Add at least 2 PDF files'; return; }
    st.className = 'status muted'; st.textContent = 'Merging…';
    try {
      const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
      const merged = await PDFDocument.create();
      for (const file of files) {
        const buf = await file.arrayBuffer();
        const doc = await PDFDocument.load(buf);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
      const bytes = await merged.save();
      download(new Blob([bytes], { type: 'application/pdf' }), 'merged.pdf');
      st.className = 'status ok'; st.textContent = `✓ Merged ${files.length} files`;
    } catch (e) { st.className = 'status err'; st.textContent = '✕ ' + e.message; }
  };
});

T('pdf', 'pdf-split', 'PDF Splitter', 'Extract specific pages from a PDF.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="dropzone" id="sp-dz">⬆ Click or drop a PDF file here<br><span class="subtle">Never leaves your browser</span></div>
    <input type="file" id="sp-fi" accept="application/pdf" hidden>
    <div id="sp-info" style="margin-top:14px"></div>
    <div id="sp-controls" style="display:none;margin-top:14px">
      <div class="field-row">
        <div class="field"><label>Pages to extract <span class="hint">e.g. 1,3,5-8,10</span></label>
          <input class="fld" id="sp-pages" placeholder="1-3,5,7-9"></div>
        <div class="field"><label>Or split every N pages</label>
          <input class="fld" type="number" id="sp-n" min="1" placeholder="e.g. 2"></div>
      </div>
      <div class="row"><button class="btn primary" id="sp-go">Extract / Split</button></div>
      <div class="status muted" id="sp-st"></div>
    </div>
  </div>`;

  let pdfFile = null, totalPages = 0;
  const dz = $('#sp-dz', root), fi = $('#sp-fi', root);

  const loadFile = async file => {
    if (file.type !== 'application/pdf') { toast('Please choose a PDF'); return; }
    pdfFile = file;
    try {
      const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
      const doc = await PDFDocument.load(await file.arrayBuffer());
      totalPages = doc.getPageCount();
      $('#sp-info', root).innerHTML = `<div class="note-box">📄 ${esc(file.name)} · <b>${totalPages} pages</b> · ${(file.size/1024).toFixed(0)} KB</div>`;
      $('#sp-controls', root).style.display = '';
    } catch(e) { toast('Could not read PDF: ' + e.message); }
  };

  dz.onclick = () => fi.click();
  fi.onchange = e => e.target.files[0] && loadFile(e.target.files[0]);
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('drag'); };
  dz.ondragleave = () => dz.classList.remove('drag');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('drag'); e.dataTransfer.files[0] && loadFile(e.dataTransfer.files[0]); };

  $('#sp-go', root).onclick = async () => {
    const st = $('#sp-st', root);
    const pageStr = $('#sp-pages', root).value.trim();
    const nStr = $('#sp-n', root).value.trim();
    if (!pageStr && !nStr) { st.className = 'status err'; st.textContent = '✕ Enter pages or split size'; return; }
    st.className = 'status muted'; st.textContent = 'Processing…';
    try {
      const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
      const srcDoc = await PDFDocument.load(await pdfFile.arrayBuffer());

      if (pageStr) {
        const indices = [];
        pageStr.split(',').forEach(part => {
          part = part.trim();
          if (part.includes('-')) { const [a,b] = part.split('-').map(Number); for(let i=a;i<=b;i++) if(i>=1&&i<=totalPages) indices.push(i-1); }
          else { const n = parseInt(part); if(n>=1&&n<=totalPages) indices.push(n-1); }
        });
        if (!indices.length) { st.className='status err'; st.textContent='✕ No valid pages'; return; }
        const newDoc = await PDFDocument.create();
        const pages = await newDoc.copyPages(srcDoc, indices);
        pages.forEach(p => newDoc.addPage(p));
        const bytes = await newDoc.save();
        download(new Blob([bytes],{type:'application/pdf'}), 'extracted.pdf');
        st.className='status ok'; st.textContent=`✓ Extracted ${indices.length} pages`;
      } else {
        const n = parseInt(nStr);
        let chunk = 0;
        for (let start = 0; start < totalPages; start += n) {
          chunk++;
          const indices = Array.from({length: Math.min(n, totalPages-start)}, (_,i) => start+i);
          const newDoc = await PDFDocument.create();
          const pages = await newDoc.copyPages(srcDoc, indices);
          pages.forEach(p => newDoc.addPage(p));
          const bytes = await newDoc.save();
          download(new Blob([bytes],{type:'application/pdf'}), `split-part${chunk}.pdf`);
        }
        st.className='status ok'; st.textContent=`✓ Created ${chunk} files`;
      }
    } catch(e) { st.className='status err'; st.textContent='✕ '+e.message; }
  };
});

T('pdf', 'pdf-rotate', 'PDF Page Rotator', 'Rotate all or specific pages in a PDF.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="dropzone" id="rot-dz">⬆ Click or drop a PDF here</div>
    <input type="file" id="rot-fi" accept="application/pdf" hidden>
    <div id="rot-info"></div>
    <div id="rot-ctrl" style="display:none;margin-top:14px">
      <div class="field-row">
        <div class="field"><label>Rotate</label>
          <select class="fld" id="rot-deg">
            <option value="90">90° clockwise</option>
            <option value="180">180°</option>
            <option value="270">90° counter-clockwise</option>
          </select></div>
        <div class="field"><label>Pages <span class="hint">blank = all pages</span></label>
          <input class="fld" id="rot-pages" placeholder="e.g. 1,3,5-8"></div>
      </div>
      <div class="row"><button class="btn primary" id="rot-go">Rotate & Download</button></div>
      <div class="status muted" id="rot-st"></div>
    </div>
  </div>`;

  let pdfFile = null, totalPages = 0;
  const dz = $('#rot-dz', root), fi = $('#rot-fi', root);

  const loadFile = async file => {
    pdfFile = file;
    const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
    const doc = await PDFDocument.load(await file.arrayBuffer());
    totalPages = doc.getPageCount();
    $('#rot-info', root).innerHTML = `<div class="note-box" style="margin-top:12px">📄 ${esc(file.name)} · <b>${totalPages} pages</b></div>`;
    $('#rot-ctrl', root).style.display = '';
  };

  dz.onclick = () => fi.click();
  fi.onchange = e => e.target.files[0] && loadFile(e.target.files[0]);
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('drag'); };
  dz.ondragleave = () => dz.classList.remove('drag');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('drag'); e.dataTransfer.files[0] && loadFile(e.dataTransfer.files[0]); };

  $('#rot-go', root).onclick = async () => {
    const st = $('#rot-st', root);
    const deg = parseInt($('#rot-deg', root).value);
    const pageStr = $('#rot-pages', root).value.trim();
    st.className = 'status muted'; st.textContent = 'Rotating…';
    try {
      const { PDFDocument, degrees } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
      const doc = await PDFDocument.load(await pdfFile.arrayBuffer());
      const pages = doc.getPages();

      let indices = [];
      if (pageStr) {
        pageStr.split(',').forEach(part => {
          part = part.trim();
          if (part.includes('-')) { const [a,b]=part.split('-').map(Number); for(let i=a;i<=b;i++) if(i>=1&&i<=totalPages) indices.push(i-1); }
          else { const n=parseInt(part); if(n>=1&&n<=totalPages) indices.push(n-1); }
        });
      } else {
        indices = pages.map((_,i) => i);
      }

      indices.forEach(i => {
        const page = pages[i];
        page.setRotation(degrees((page.getRotation().angle + deg) % 360));
      });

      const bytes = await doc.save();
      download(new Blob([bytes],{type:'application/pdf'}), 'rotated.pdf');
      st.className='status ok'; st.textContent=`✓ Rotated ${indices.length} pages`;
    } catch(e) { st.className='status err'; st.textContent='✕ '+e.message; }
  };
});

T('pdf', 'pdf-watermark', 'PDF Watermark', 'Add a text watermark to every page.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="dropzone" id="wm-dz">⬆ Click or drop a PDF here</div>
    <input type="file" id="wm-fi" accept="application/pdf" hidden>
    <div id="wm-info"></div>
    <div id="wm-ctrl" style="display:none;margin-top:14px">
      <div class="field-row">
        <div class="field" style="grid-column:1/-1"><label>Watermark text</label>
          <input class="fld" id="wm-text" value="CONFIDENTIAL" placeholder="e.g. DRAFT"></div>
        <div class="field"><label>Opacity <span class="hint" id="wm-opv">30%</span></label>
          <input type="range" id="wm-op" min="5" max="80" value="30" style="width:100%"></div>
        <div class="field"><label>Font size</label>
          <input class="fld" type="number" id="wm-fs" value="48" min="12" max="120"></div>
        <div class="field"><label>Color</label>
          <select class="fld" id="wm-col">
            <option value="gray">Gray</option>
            <option value="red">Red</option>
            <option value="blue">Blue</option>
            <option value="black">Black</option>
          </select></div>
      </div>
      <div class="row"><button class="btn primary" id="wm-go">Add Watermark & Download</button></div>
      <div class="status muted" id="wm-st"></div>
    </div>
  </div>`;

  let pdfFile = null;
  const dz = $('#wm-dz', root), fi = $('#wm-fi', root);
  $('#wm-op', root).oninput = e => { $('#wm-opv', root).textContent = e.target.value + '%'; };

  const loadFile = async file => {
    pdfFile = file;
    const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
    const doc = await PDFDocument.load(await file.arrayBuffer());
    $('#wm-info', root).innerHTML = `<div class="note-box" style="margin-top:12px">📄 ${esc(file.name)} · <b>${doc.getPageCount()} pages</b></div>`;
    $('#wm-ctrl', root).style.display = '';
  };

  dz.onclick = () => fi.click();
  fi.onchange = e => e.target.files[0] && loadFile(e.target.files[0]);
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('drag'); };
  dz.ondragleave = () => dz.classList.remove('drag');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('drag'); e.dataTransfer.files[0] && loadFile(e.dataTransfer.files[0]); };

  $('#wm-go', root).onclick = async () => {
    const st = $('#wm-st', root);
    const text = $('#wm-text', root).value || 'WATERMARK';
    const opacity = parseInt($('#wm-op', root).value) / 100;
    const fontSize = parseInt($('#wm-fs', root).value) || 48;
    const colorMap = { gray: [0.5,0.5,0.5], red: [0.8,0.1,0.1], blue: [0.1,0.1,0.8], black: [0,0,0] };
    const [r,g,b] = colorMap[$('#wm-col', root).value];
    st.className = 'status muted'; st.textContent = 'Adding watermark…';
    try {
      const { PDFDocument, rgb, degrees } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
      const doc = await PDFDocument.load(await pdfFile.arrayBuffer());
      const pages = doc.getPages();
      for (const page of pages) {
        const { width, height } = page.getSize();
        page.drawText(text, {
          x: width / 2 - (fontSize * text.length * 0.3),
          y: height / 2,
          size: fontSize,
          color: rgb(r, g, b),
          opacity,
          rotate: degrees(45),
        });
      }
      const bytes = await doc.save();
      download(new Blob([bytes],{type:'application/pdf'}), 'watermarked.pdf');
      st.className='status ok'; st.textContent=`✓ Watermark added to ${pages.length} pages`;
    } catch(e) { st.className='status err'; st.textContent='✕ '+e.message; }
  };
});

T('pdf', 'pdf-page-numbers', 'PDF Page Numbers', 'Add page numbers to a PDF.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="dropzone" id="pn-dz">⬆ Click or drop a PDF here</div>
    <input type="file" id="pn-fi" accept="application/pdf" hidden>
    <div id="pn-info"></div>
    <div id="pn-ctrl" style="display:none;margin-top:14px">
      <div class="field-row">
        <div class="field"><label>Position</label>
          <select class="fld" id="pn-pos">
            <option value="bottom-center">Bottom Center</option>
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="top-center">Top Center</option>
          </select></div>
        <div class="field"><label>Start from page #</label>
          <input class="fld" type="number" id="pn-start" value="1" min="1"></div>
        <div class="field"><label>Format</label>
          <select class="fld" id="pn-fmt">
            <option value="n">1, 2, 3</option>
            <option value="page-n">Page 1, Page 2</option>
            <option value="n-of-t">1 of 10</option>
          </select></div>
      </div>
      <div class="row"><button class="btn primary" id="pn-go">Add Page Numbers</button></div>
      <div class="status muted" id="pn-st"></div>
    </div>
  </div>`;

  let pdfFile = null, totalPages = 0;
  const dz = $('#pn-dz', root), fi = $('#pn-fi', root);

  const loadFile = async file => {
    pdfFile = file;
    const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
    const doc = await PDFDocument.load(await file.arrayBuffer());
    totalPages = doc.getPageCount();
    $('#pn-info', root).innerHTML = `<div class="note-box" style="margin-top:12px">📄 ${esc(file.name)} · <b>${totalPages} pages</b></div>`;
    $('#pn-ctrl', root).style.display = '';
  };

  dz.onclick = () => fi.click();
  fi.onchange = e => e.target.files[0] && loadFile(e.target.files[0]);
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('drag'); };
  dz.ondragleave = () => dz.classList.remove('drag');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('drag'); e.dataTransfer.files[0] && loadFile(e.dataTransfer.files[0]); };

  $('#pn-go', root).onclick = async () => {
    const st = $('#pn-st', root);
    const pos = $('#pn-pos', root).value;
    const startN = parseInt($('#pn-start', root).value) || 1;
    const fmt = $('#pn-fmt', root).value;
    st.className = 'status muted'; st.textContent = 'Adding page numbers…';
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
      const doc = await PDFDocument.load(await pdfFile.arrayBuffer());
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const fontSize = 11;
      pages.forEach((page, i) => {
        const { width, height } = page.getSize();
        const n = i + startN;
        const label = fmt === 'n' ? String(n) : fmt === 'page-n' ? 'Page ' + n : n + ' of ' + totalPages;
        const tw = font.widthOfTextAtSize(label, fontSize);
        let x = width / 2 - tw / 2, y = 20;
        if (pos === 'bottom-right') { x = width - tw - 20; y = 20; }
        if (pos === 'bottom-left') { x = 20; y = 20; }
        if (pos === 'top-center') { x = width / 2 - tw / 2; y = height - 28; }
        page.drawText(label, { x, y, size: fontSize, font, color: rgb(0.3,0.3,0.3) });
      });
      const bytes = await doc.save();
      download(new Blob([bytes],{type:'application/pdf'}), 'numbered.pdf');
      st.className='status ok'; st.textContent=`✓ Page numbers added`;
    } catch(e) { st.className='status err'; st.textContent='✕ '+e.message; }
  };
});

T('pdf', 'pdf-metadata', 'PDF Metadata Viewer', 'View page count, title, author and properties.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="dropzone" id="meta-dz">⬆ Click or drop a PDF here<br><span class="subtle">File is never uploaded — reads locally</span></div>
    <input type="file" id="meta-fi" accept="application/pdf" hidden>
    <div id="meta-out" style="margin-top:14px"></div>
  </div>`;

  const dz = $('#meta-dz', root), fi = $('#meta-fi', root);

  const loadFile = async file => {
    const out = $('#meta-out', root);
    out.innerHTML = '<div class="status muted">Reading…</div>';
    try {
      const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const rows = [
        ['File name', file.name],
        ['File size', (file.size/1024).toFixed(1) + ' KB (' + (file.size/1024/1024).toFixed(2) + ' MB)'],
        ['Page count', doc.getPageCount()],
        ['Title', doc.getTitle() || '—'],
        ['Author', doc.getAuthor() || '—'],
        ['Subject', doc.getSubject() || '—'],
        ['Creator', doc.getCreator() || '—'],
        ['Producer', doc.getProducer() || '—'],
        ['Keywords', doc.getKeywords() || '—'],
        ['Created', doc.getCreationDate()?.toLocaleString() || '—'],
        ['Modified', doc.getModificationDate()?.toLocaleString() || '—'],
        ['PDF version', '1.' + (doc.context?.header?.minor ?? '?')],
      ];
      out.innerHTML = `<div class="result"><table class="kvtable"><tbody>${rows.map(([k,v]) => `<tr><td>${k}</td><td><b>${esc(String(v))}</b></td></tr>`).join('')}</tbody></table></div>`;
      // Page sizes
      const pages = doc.getPages();
      const sizeRows = pages.slice(0,5).map((p,i) => {
        const {width,height} = p.getSize();
        return `<tr><td>Page ${i+1}</td><td><b>${Math.round(width)} × ${Math.round(height)} pt</b></td></tr>`;
      });
      if (pages.length > 5) sizeRows.push(`<tr><td colspan="2" style="color:var(--muted)">…and ${pages.length-5} more pages</td></tr>`);
      out.innerHTML += `<div class="result" style="margin-top:12px"><div class="io-label" style="margin-bottom:8px">Page sizes</div><table class="kvtable"><tbody>${sizeRows.join('')}</tbody></table></div>`;
    } catch(e) { out.innerHTML = '<div class="status err">✕ ' + esc(e.message) + '</div>'; }
  };

  dz.onclick = () => fi.click();
  fi.onchange = e => e.target.files[0] && loadFile(e.target.files[0]);
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('drag'); };
  dz.ondragleave = () => dz.classList.remove('drag');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('drag'); e.dataTransfer.files[0] && loadFile(e.dataTransfer.files[0]); };
});

T('pdf', 'images-to-pdf', 'Images to PDF', 'Convert JPG/PNG images into a single PDF.', root => {
  root.innerHTML = `<div class="tool-body">
    <div class="dropzone" id="i2p-dz">⬆ Click or drop images here<br><span class="subtle">JPG · PNG · WEBP · Multiple files OK</span></div>
    <input type="file" id="i2p-fi" accept="image/*" multiple hidden>
    <div id="i2p-list" style="margin-top:14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px"></div>
    <div id="i2p-ctrl" style="display:none;margin-top:14px">
      <div class="field-row">
        <div class="field"><label>Page size</label>
          <select class="fld" id="i2p-size">
            <option value="auto">Auto (fit image)</option>
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
          </select></div>
        <div class="field"><label>Margin (pt)</label>
          <input class="fld" type="number" id="i2p-margin" value="20" min="0" max="100"></div>
      </div>
      <div class="row"><button class="btn primary" id="i2p-go">Convert to PDF</button><button class="btn ghost" id="i2p-clear">Clear</button></div>
      <div class="status muted" id="i2p-st"></div>
    </div>
  </div>`;

  let images = [];
  const dz = $('#i2p-dz', root), fi = $('#i2p-fi', root), list = $('#i2p-list', root);

  const renderList = () => {
    list.innerHTML = images.map((f, i) => {
      const url = URL.createObjectURL(f);
      return `<div style="position:relative;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;aspect-ratio:1">
        <img src="${url}" style="width:100%;height:100%;object-fit:cover">
        <span style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.5);color:#fff;font-size:10px;padding:2px 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</span>
        <button data-rm="${i}" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:11px">✕</button>
      </div>`;
    }).join('');
    list.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { images.splice(+b.dataset.rm, 1); renderList(); if(!images.length) $('#i2p-ctrl',root).style.display='none'; });
    if (images.length) $('#i2p-ctrl', root).style.display = '';
  };

  const addFiles = files => { images.push(...[...files].filter(f => f.type.startsWith('image/'))); renderList(); };
  dz.onclick = () => fi.click();
  fi.onchange = e => addFiles(e.target.files);
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('drag'); };
  dz.ondragleave = () => dz.classList.remove('drag');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('drag'); addFiles(e.dataTransfer.files); };
  $('#i2p-clear', root).onclick = () => { images = []; renderList(); $('#i2p-ctrl',root).style.display='none'; };

  $('#i2p-go', root).onclick = async () => {
    const st = $('#i2p-st', root);
    if (!images.length) { st.className='status err'; st.textContent='✕ Add at least one image'; return; }
    st.className='status muted'; st.textContent='Converting…';
    try {
      const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
      const doc = await PDFDocument.create();
      const margin = parseInt($('#i2p-margin', root).value) || 0;
      const sizeMode = $('#i2p-size', root).value;
      const A4 = [595, 842], LETTER = [612, 792];

      for (const file of images) {
        const buf = await file.arrayBuffer();
        let img;
        if (file.type === 'image/png') img = await doc.embedPng(buf);
        else img = await doc.embedJpg(buf);
        const { width: iw, height: ih } = img;
        let pw, ph;
        if (sizeMode === 'a4') { [pw, ph] = A4; }
        else if (sizeMode === 'letter') { [pw, ph] = LETTER; }
        else { pw = iw + margin * 2; ph = ih + margin * 2; }
        const page = doc.addPage([pw, ph]);
        const maxW = pw - margin * 2, maxH = ph - margin * 2;
        const scale = Math.min(maxW / iw, maxH / ih, 1);
        const dw = iw * scale, dh = ih * scale;
        page.drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
      }
      const bytes = await doc.save();
      download(new Blob([bytes],{type:'application/pdf'}), 'images.pdf');
      st.className='status ok'; st.textContent=`✓ ${images.length} image(s) converted`;
    } catch(e) { st.className='status err'; st.textContent='✕ '+e.message; }
  };
});

/* ================================================================
   App shell: nav, router, search, theme
   ================================================================ */
/* ================================================================
   App shell — MULTI-PAGE.
   index.html  →  <body data-home>      (homepage)
   tools/x.html →  <body data-tool="x">  (one tool per file)
   Both load this same shared js/main.js, which builds the chrome.
   ================================================================ */
const byId = id => TOOLS.find(t => t.id === id);
const IN_TOOLS = !!document.body.dataset.tool || /\/tools\//.test(location.pathname);
const CURRENT  = document.body.dataset.tool || '';
const toolHref = id => '/tools/' + id;
const homeHref = () => '/';

/* expose registry so other scripts/pages can introspect */
window.Toolbox = { TOOLS, CATS, byId };

/* build the shared chrome into #root (or <body> fallback) */
const host = document.getElementById('root') || document.body;
host.innerHTML = `
  <div id="app">
    <header id="topbar">
      <div class="topbar-inner">
        <a class="brand" href="${homeHref()}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="30" height="30"><rect width="100" height="100" rx="18" fill="#1b1a17"/><polygon points="50,8 82,26 82,62 50,80 18,62 18,26" fill="none" stroke="#ec5a13" stroke-width="5"/><polygon points="50,24 68,34 68,54 50,64 32,54 32,34" fill="#ec5a13"/><text x="50" y="56" font-size="22" text-anchor="middle" fill="white" font-family="system-ui" font-weight="700">FT</text></svg>
          <span class="brand-name">FreeToolHub</span>
        </a>
        <div class="topbar-links">
          <a class="ghost-link" href="/about">About</a>
          <a class="ghost-link" href="/privacy">Privacy</a>
          <a class="ghost-link" href="/terms">Terms</a>
          <span class="topbar-divider"></span>
          <a class="ghost-link" id="random-tool">Surprise me ↗</a>
          <button id="theme-toggle" title="Toggle theme" aria-label="Toggle theme">◐</button>
        </div>
      </div>
    </header>
    <main id="main">
      <div id="view"></div>
    </main>
  </div>
  <div id="scrim"></div>
  <div id="toast"></div>`;

const view = $('#view');

function renderNav() {}

const cardGrid = items => `<div class="card-grid">${items.map(t => `<a class="tool-card" href="${toolHref(t.id)}" onclick="saveScroll()"><div class="tc-name">${t.name}</div><div class="tc-desc">${t.desc}</div></a>`).join('')}</div>`;

function saveScroll() {
  sessionStorage.setItem('ftHub_scroll', window.scrollY);
  sessionStorage.setItem('ftHub_cat', document.querySelector('.cat-pill.active')?.dataset.cat || 'all');
}

function restoreScroll() {
  const y = sessionStorage.getItem('ftHub_scroll');
  const cat = sessionStorage.getItem('ftHub_cat');
  if (cat && cat !== 'all') {
    filterCat(cat);
  }
  if (y) {
    requestAnimationFrame(() => {
      window.scrollTo({ top: parseInt(y), behavior: 'instant' });
      sessionStorage.removeItem('ftHub_scroll');
    });
  }
}

function filterCat(cat) {
  document.querySelectorAll('.cat-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.cat === cat);
  });
  document.querySelectorAll('.home-cat').forEach(s => {
    s.style.display = (cat === 'all' || s.dataset.cat === cat) ? '' : 'none';
  });
}

function buildHome() {
  document.title = 'FreeToolHub — 81 Free Online Tools. No Login.';
  view.innerHTML = `
    <div class="home-wrap"><div class="home-hero anim-fade">
      <canvas id="hero-canvas"></canvas>
      <div class="hero-content">
        <div class="hero-badge"><span class="hero-dot"></span> 100% Free &nbsp;·&nbsp; No Login &nbsp;·&nbsp; Works Offline</div>
        <h1>Every tool you need,<br><span class="hl">always free.</span></h1>
        <p>A fast, private collection of <strong>${TOOLS.length} tools</strong> — developer, text, finance, SEO &amp; image. Nothing is uploaded. Everything runs locally in your browser.</p>
        <div class="home-search-wrap">
          <span class="home-search-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
          <input id="home-search" type="search" placeholder="Search 81 tools..." autocomplete="off" spellcheck="false">
          <span class="home-search-kbd">⌘K</span><span id="search-count" style="position:absolute;right:60px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--muted);font-weight:600;"></span>
        </div>
        <div class="hero-stats">
          <div class="hstat"><span class="hstat-n">${TOOLS.length}+</span><span class="hstat-l">Free Tools</span></div>
          <div class="hstat"><span class="hstat-n">0</span><span class="hstat-l">Login Required</span></div>
          <div class="hstat"><span class="hstat-n">100%</span><span class="hstat-l">Browser-Based</span></div>
          <div class="hstat"><span class="hstat-n">0₹</span><span class="hstat-l">Forever Free</span></div>
        </div>
      </div>
    </div>
    </div>
    <div id="tools-grid">
    <div class="home-cat-grid">
    <div class="cat-pills">
      <button class="cat-pill active" data-cat="all" onclick="filterCat('all')">All</button>
      ${CATS.map(c => `<button class="cat-pill" data-cat="${c.id}" onclick="filterCat('${c.id}')">${c.ic} ${c.name}</button>`).join('')}
    </div>
    ${CATS.map((c, ci) => {
      const items = TOOLS.filter(t => t.cat === c.id);
      return `<section class="home-cat anim-slide" data-cat="${c.id}" style="animation-delay:${ci * 0.05}s">
        <div class="home-cat-head">
          <span class="cat-ic">${c.ic}</span>
          <h2>${c.name}</h2>
          <span>${items.length} tools</span>
        </div>
        ${cardGrid(items)}
      </section>`;
    }).join('')}
    </div>
    </div>
    <footer class="home-footer">
      <div class="home-footer-inner">
        <div class="home-footer-brand">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="24" height="24">
            <rect width="100" height="100" rx="18" fill="#1b1a17"/>
            <polygon points="50,8 82,26 82,62 50,80 18,62 18,26" fill="none" stroke="#ec5a13" stroke-width="5"/>
            <polygon points="50,24 68,34 68,54 50,64 32,54 32,34" fill="#ec5a13"/>
            <text x="50" y="56" font-size="22" text-anchor="middle" fill="white" font-family="system-ui" font-weight="700">FT</text>
          </svg>
          <span>FreeToolHub</span>
        </div>
        <p class="home-footer-desc">100+ free browser-based tools. No login, no data collection, works offline.</p>
        <div class="home-footer-links">
          <a href="/about">About</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="mailto:hello@freetoolhub.app">Contact</a>
        </div>
        <div class="home-footer-copy">© 2025 FreeToolHub.app · All tools free forever</div>
      </div>
    </footer>`;
}

function renderSearch(q) {
  const items = TOOLS.filter(t => (t.name + t.desc + t.cat).toLowerCase().includes(q.toLowerCase()));
  const grid = document.getElementById('tools-grid');
  if (grid) {
    grid.innerHTML = items.length
      ? `<div class="home-cat-grid" style="padding-top:8px">${cardGrid(items)}</div>`
      : `<div class="empty-note">Nothing found for "${esc(q)}".</div>`;
  } else {
    view.innerHTML = items.length ? cardGrid(items) : `<div class="empty-note">Nothing found for "${esc(q)}".</div>`;
  }
}

function restoreToolsGrid() {
  const grid = document.getElementById('tools-grid');
  if (!grid) return;
  grid.innerHTML = `<div class="home-cat-grid">
    <div class="cat-pills">
      <button class="cat-pill active" data-cat="all" onclick="filterCat('all')">All</button>
      ${CATS.map(c => `<button class="cat-pill" data-cat="${c.id}" onclick="filterCat('${c.id}')">${c.ic} ${c.name}</button>`).join('')}
    </div>
    ${CATS.map(c => {
      const items = TOOLS.filter(t => t.cat === c.id);
      return `<section class="home-cat" data-cat="${c.id}">
        <div class="home-cat-head"><span class="cat-ic">${c.ic}</span><h2>${c.name}</h2><span>${items.length} tools</span></div>
        ${cardGrid(items)}
      </section>`;
    }).join('')}
    </div>`;
}

function attachSearchListener() {
  const searchInput = document.getElementById('home-search');
  if (!searchInput || searchInput._searchBound) return;
  searchInput._searchBound = true;
  searchInput.addEventListener('input', e => {
    const q = e.target.value.trim();
    if (q) renderSearch(q);
    else restoreToolsGrid();
  });
  initTypewriter();
}

function buildTool(id) {
  const tool = byId(id);
  if (!tool) { view.innerHTML = `<div class="home-cat-grid"><div class="empty-note">Tool not found. <a href="${homeHref()}">Go home</a>.</div></div>`; return; }
  const cat = CATS.find(c => c.id === tool.cat);
  document.title = tool.name + ' — Free Online Tool | FreeToolHub';
  view.innerHTML = `<div class="tool-view-wrap"><div class="tool-head"><h1>${tool.name}</h1><p>${tool.desc}</p></div><div id="tool-mount"></div></div>`;
  tool.render($('#tool-mount', view));
  const seo = document.getElementById('tool-seo');
  if (seo) {
    seo.removeAttribute('hidden');
    seo.style.display = '';
    const wrap = view.querySelector('.tool-view-wrap');
    if (wrap) wrap.appendChild(seo); else view.appendChild(seo);
  }
}

/* search — home page big search bar */
/* search handled in boot */
/* keydown handled in boot */

/* theme */
const themeBtn = $('#theme-toggle');
function setTheme(t) { document.documentElement.dataset.theme = t; localStorage.setItem('tb-theme', t); }
themeBtn.onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
setTheme(localStorage.getItem('tb-theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'));

/* scrim */
const scrim = $('#scrim');
scrim.onclick = () => scrim.classList.remove('show');

/* misc */
$('#random-tool').onclick = () => { location.href = toolHref(TOOLS[Math.floor(Math.random() * TOOLS.length)].id); };


/* boot */
renderNav();
initDotGrid();
if (IN_TOOLS) {
  buildTool(CURRENT);
} else {
  buildHome();
  initHeroCanvas();
  restoreScroll();

  /* attach search listener after DOM is ready — setTimeout ensures #home-search exists */
  setTimeout(() => attachSearchListener(), 100);

  /* Cmd/Ctrl+K → focus search */
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const s = document.getElementById('home-search');
      if (s) s.focus();
    }
    if (e.key === 'Escape') {
      const s = document.getElementById('home-search');
      if (s && document.activeElement === s) {
        s.value = '';
        restoreToolsGrid();
        s.blur();
      }
    }
  });
}

/* ── Global Dot Grid — full page, theme-aware ── */
function initDotGrid() {
  // Create a fixed canvas behind everything
  const canvas = document.createElement('canvas');
  canvas.id = 'dot-grid-canvas';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let W, H, dots = [], mouse = { x: -999, y: -999 };

  function isDark() {
    return document.documentElement.dataset.theme === 'dark';
  }

  function dotColor(alpha) {
    return isDark()
      ? `rgba(236,90,19,${alpha})`
      : `rgba(180,60,0,${alpha})`;
  }

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    buildDots();
  }

  function buildDots() {
    dots = [];
    const gap = 38;
    for (let x = gap / 2; x < W; x += gap)
      for (let y = gap / 2; y < H; y += gap)
        dots.push({ x, y, r: 1.4, phase: Math.random() * Math.PI * 2 });
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    dots.forEach(d => {
      const dx = d.x - mouse.x;
      const dy = d.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const glow = dist < 100 ? (1 - dist / 100) * 0.65 : 0;
      const pulse = 0.05 + Math.sin(t * 0.0006 + d.phase) * 0.02;
      const alpha = Math.min(0.85, pulse + glow);
      const r = glow > 0.05 ? d.r + glow * 2.5 : d.r;
      ctx.beginPath();
      ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      ctx.fillStyle = dotColor(alpha.toFixed(3));
      ctx.fill();
    });
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', () => { mouse.x = -999; mouse.y = -999; });

  // Watch theme changes
  const observer = new MutationObserver(() => {});
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  resize();
  (function loop(t) { draw(t); requestAnimationFrame(loop); })(0);
}

/* ── Hero Pills — floating tool names, RIGHT side only ── */
function initHeroCanvas() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, pills = [];
  const tool_names = TOOLS.map(t => t.name).sort(() => Math.random() - 0.5).slice(0, 20);

  function isDark() { return document.documentElement.dataset.theme === 'dark'; }

  function getColors() {
    return isDark()
      ? { pill: 'rgba(255,255,255,0.05)', border: 'rgba(236,90,19,0.25)', text: 'rgba(255,150,90,0.75)' }
      : { pill: 'rgba(236,90,19,0.06)', border: 'rgba(180,60,0,0.2)', text: 'rgba(150,45,0,0.7)' };
  }

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    buildPills();
  }

  function buildPills() {
    // Pills in right 50% of screen — left side has hero text
    const leftBound = W * 0.52;
    pills = tool_names.map(name => ({
      name,
      x: leftBound + Math.random() * (W - leftBound),
      y: Math.random() * H * 0.9,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.15,
      fontSize: 11 + Math.floor(Math.random() * 3),
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    const C = getColors();
    const leftBound = W * 0.52;
    // Fade pills when user scrolls down
    const view = document.getElementById('view');
    const scrollY = view ? view.scrollTop : 0;
    const scrollFade = Math.max(0, 1 - scrollY / 300);
    if (scrollFade <= 0) return;

    pills.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < leftBound) { p.x = leftBound; p.vx = Math.abs(p.vx); }
      if (p.x > W + 120)   { p.x = leftBound + Math.random() * 100; }
      if (p.y < -30)        { p.y = H * 0.9; }
      if (p.y > H * 0.95)  { p.y = -15; }

      const alpha = (0.55 + Math.sin(t * 0.0007 + p.phase) * 0.2) * scrollFade;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `500 ${p.fontSize}px "Space Grotesk",system-ui,sans-serif`;
      const tw = ctx.measureText(p.name).width;
      const ph = p.fontSize + 10, pw = tw + 18;
      const px = p.x - pw / 2, py = p.y - ph / 2;

      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, ph / 2);
      ctx.fillStyle = C.pill;
      ctx.fill();
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.fillStyle = C.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.name, p.x, p.y);
      ctx.restore();
    });
  }

  window.addEventListener('resize', resize);
  resize();
  (function loop(t) { draw(t); requestAnimationFrame(loop); })(0);
}

/* ── Typewriter placeholder ── */
function initTypewriter() {
  const input = document.getElementById('home-search');
  if (!input) return;
  const phrases = [
    'JSON Formatter', 'EMI Calculator', 'QR Code Generator',
    'Password Generator', 'GST Calculator', 'Regex Tester',
    'Base64 Encoder', 'Unit Converter', 'Age Calculator',
    'JWT Decoder', 'Word Counter', 'UUID Generator'
  ];
  let pi = 0, ci = 0, deleting = false;
  const prefix = 'Search — ';
  function type() {
    if (document.activeElement === input) { setTimeout(type, 200); return; }
    const phrase = phrases[pi];
    if (!deleting) {
      input.placeholder = prefix + phrase.slice(0, ci + 1);
      ci++;
      if (ci === phrase.length) { deleting = true; setTimeout(type, 1800); return; }
      setTimeout(type, 80);
    } else {
      input.placeholder = prefix + phrase.slice(0, ci - 1);
      ci--;
      if (ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; setTimeout(type, 400); return; }
      setTimeout(type, 40);
    }
  }
  setTimeout(type, 1000);
}