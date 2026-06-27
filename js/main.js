'use strict';

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

const stat = (v, k, accent) => `<div class="stat"><div class="v ${accent ? 'accent' : ''}">${v}</div><div class="k">${k}</div></div>`;
const bigResult = (...stats) => `<div class="result big">${stats.join('')}</div>`;
const kv = rows => `<div class="result"><table class="kvtable"><tbody>${rows.map(([k, v]) => `<tr><td>${k}</td><td><b>${v}</b></td></tr>`).join('')}</tbody></table></div>`;
const errBox = m => `<div class="status err" style="margin-top:14px">⚠ ${esc(m)}</div>`;

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

const outBlock = (text, id = 'gx', name = 'output.txt', mono = true) =>
  `<div class="result"><div class="row" style="justify-content:flex-end;margin-bottom:8px">
      <button class="btn sm js-copy" data-target="${id}">Copy</button>
      <button class="btn sm js-dl" data-target="${id}" data-name="${name}">Download</button>
    </div>
    <textarea class="ta ${mono ? '' : 'wrap'} out" id="${id}" readonly style="min-height:${mono ? 200 : 140}px">${esc(text)}</textarea></div>`;

document.addEventListener('click', e => {
  const c = e.target.closest('.js-copy');
  if (c) { const t = document.getElementById(c.dataset.target); if (t) copy(t.value != null ? t.value : t.textContent); }
  const d = e.target.closest('.js-dl');
  if (d) { const t = document.getElementById(d.dataset.target); if (t) download(t.value != null ? t.value : t.textContent, d.dataset.name || 'output.txt'); }
});

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
    else if (c === '\r') {  }
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
    if (/\u0000\d+\u0000/.test(raw) === false && raw.includes('\u0000')) {  }
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

const CATS = [
  { id: 'dev',      name: 'Developer',  ic: '{}' },
  { id: 'text',     name: 'Text',       ic: '¶' },
  { id: 'everyday', name: 'Everyday',   ic: '◎' },
  { id: 'finance',  name: 'Finance',    ic: '₹' },
  { id: 'student',  name: 'Student',    ic: '✎' },
  { id: 'seo',      name: 'SEO & Web',  ic: '⌁' },
  { id: 'image',    name: 'Image',      ic: '▣' },
];

const TOOLS = [];
const T = (cat, id, name, desc, render) => TOOLS.push({ cat, id, name, desc, render });

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
T('finance', 'salary', 'Salary Converter', 'Hourly ⇄ daily ⇄ monthly ⇄ yearly.', root => calcTool(root, {
  button: 'Convert', auto: true,
  fields: [{ id: 'rate', label: 'Hourly rate (₹)', value: 500 }, { id: 'hpd', label: 'Hours / day', value: 8 }, { id: 'dpw', label: 'Days / week', value: 5 }],
  compute: v => { const r = num(v.rate), h = num(v.hpd), d = num(v.dpw); const wk = r * h * d, yr = wk * 52; return bigResult(stat(money(r * h), 'Daily', true), stat(money(wk), 'Weekly'), stat(money(yr / 12), 'Monthly'), stat(money(yr), 'Yearly')); },
}));

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

function imagePicker(root, onImg) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="dropzone" id="dz">⬆ Click or drop an image here<br><span class="subtle">PNG · JPG · WEBP · GIF — never leaves your browser</span></div><input type="file" id="fi" accept="image

const byId = id => TOOLS.find(t => t.id === id);
const IN_TOOLS = !!document.body.dataset.tool || /\/tools\
const CURRENT  = document.body.dataset.tool || '';
const toolHref = id => (IN_TOOLS ? '' : 'tools/') + id + '.html';
const homeHref = () => IN_TOOLS ? '../index.html' : 'index.html';

window.Toolbox = { TOOLS, CATS, byId };

const host = document.getElementById('root') || document.body;
host.innerHTML = `
  <div id="app">
    <aside id="sidebar">
      <div class="brand">
        <a class="brand-mark" href="${homeHref()}">FT</a>
        <a class="brand-name" href="${homeHref()}" style="color:var(--ink)">FreeToolHub</a>
        <button id="theme-toggle" title="Toggle theme" aria-label="Toggle theme">◐</button>
      </div>
      <div class="search-wrap"><input id="search" type="search" placeholder="Search tools…  ( / )" autocomplete="off" spellcheck="false"></div>
      <nav id="nav"></nav>
      <div class="side-foot"><span id="tool-count"></span> tools · Free · No Login · 100% in-browser</div>
    </aside>
    <main id="main">
      <header id="topbar">
        <button id="menu-btn" aria-label="Menu">☰</button>
        <div id="crumb"></div>
        <a class="ghost-link" id="random-tool">Surprise me ↗</a>
      </header>
      <div id="view"></div>
    </main>
  </div>
  <div id="scrim"></div>
  <div id="toast"></div>`;

const view = $('#view'), nav = $('#nav');

function renderNav(filter = '') {
  const q = filter.trim().toLowerCase();
  nav.innerHTML = CATS.map(c => {
    const items = TOOLS.filter(t => t.cat === c.id && (!q || (t.name + t.desc).toLowerCase().includes(q)));
    if (!items.length) return '';
    return `<div class="cat-group">
      <div class="cat-head"><span class="dot"></span>${c.name}</div>
      ${items.map(t => `<a class="nav-item ${t.id === CURRENT ? 'active' : ''}" href="${toolHref(t.id)}"><span class="ic">${c.ic}</span>${t.name}</a>`).join('')}
    </div>`;
  }).join('') || `<div class="empty-note">No tools match “${esc(filter)}”.</div>`;
}

const cardGrid = items => `<div class="card-grid">${items.map(t => `<a class="tool-card" href="${toolHref(t.id)}"><div class="tc-name">${t.name}</div><div class="tc-desc">${t.desc}</div></a>`).join('')}</div>`;

function buildHome() {
  $('#crumb').innerHTML = `<b>Home</b>`;
  document.title = 'FreeToolHub — 81 Free Online Tools. No Login.';
  view.innerHTML = `
    <div class="home-hero anim-fade">
      <div class="hero-badge"><span class="hero-dot"></span> 100% Free &nbsp;·&nbsp; No Login &nbsp;·&nbsp; Works Offline</div>
      <h1>Every tool you need,<br><span class="hl">always free.</span></h1>
      <p>A fast, private collection of <strong>${TOOLS.length} tools</strong> — developer, text, finance, SEO &amp; image. Nothing is uploaded. Everything runs locally in your browser.</p>
      <div class="hero-stats">
        <div class="hstat"><span class="hstat-n">${TOOLS.length}+</span><span class="hstat-l">Free Tools</span></div>
        <div class="hstat"><span class="hstat-n">0</span><span class="hstat-l">Login Required</span></div>
        <div class="hstat"><span class="hstat-n">100%</span><span class="hstat-l">Browser-Based</span></div>
        <div class="hstat"><span class="hstat-n">0₹</span><span class="hstat-l">Forever Free</span></div>
      </div>
    </div>
    ${CATS.map((c, ci) => {
      const items = TOOLS.filter(t => t.cat === c.id);
      return `<section class="home-cat anim-slide" style="animation-delay:${ci * 0.05}s">
        <div class="home-cat-head">
          <span class="cat-ic">${c.ic}</span>
          <h2>${c.name}</h2>
          <span>${items.length} tools</span>
        </div>
        ${cardGrid(items)}
      </section>`;
    }).join('')}`;
}

function renderSearch(q) {
  const items = TOOLS.filter(t => (t.name + t.desc + t.cat).toLowerCase().includes(q.toLowerCase()));
  $('#crumb').innerHTML = `<b>Search</b> · ${items.length} result${items.length === 1 ? '' : 's'} for “${esc(q)}”`;
  view.innerHTML = items.length ? cardGrid(items) : `<div class="empty-note">Nothing found for “${esc(q)}”.</div>`;
}

function buildTool(id) {
  const tool = byId(id);
  if (!tool) { $('#crumb').innerHTML = '<b>Not found</b>'; view.innerHTML = `<div class="empty-note">Tool “${esc(id)}” not found. <a href="${homeHref()}">Go home</a>.</div>`; return; }
  const cat = CATS.find(c => c.id === tool.cat);
  document.title = tool.name + ' — Free Online Tool | FreeToolHub';
  $('#crumb').innerHTML = `<a href="${homeHref()}" style="color:var(--muted)">Home</a> · ${cat.name} · <b>${tool.name}</b>`;
  view.innerHTML = `<div class="tool-head"><h1>${tool.name}</h1><p>${tool.desc}</p></div><div id="tool-mount"></div>`;
  tool.render($('#tool-mount', view));

  const seo = document.getElementById('tool-seo');
  if (seo) { seo.removeAttribute('hidden'); seo.style.display = ''; view.appendChild(seo); }
}

const search = $('#search');
search.addEventListener('input', () => {
  const q = search.value.trim();
  renderNav(q);
  if (!IN_TOOLS) { if (q) renderSearch(q); else buildHome(); }
});
document.addEventListener('keydown', e => { if (e.key === '/' && document.activeElement !== search && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); search.focus(); } });

const themeBtn = $('#theme-toggle');
function setTheme(t) { document.documentElement.dataset.theme = t; localStorage.setItem('tb-theme', t); }
themeBtn.onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
setTheme(localStorage.getItem('tb-theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'));

const sidebar = $('#sidebar'), scrim = $('#scrim');
$('#menu-btn').onclick = () => { sidebar.classList.add('open'); scrim.classList.add('show'); };
scrim.onclick = () => { sidebar.classList.remove('open'); scrim.classList.remove('show'); };

$('#random-tool').onclick = () => { location.href = toolHref(TOOLS[Math.floor(Math.random() * TOOLS.length)].id); };
$('#tool-count').textContent = TOOLS.length;

renderNav();
if (IN_TOOLS) buildTool(CURRENT); else buildHome();