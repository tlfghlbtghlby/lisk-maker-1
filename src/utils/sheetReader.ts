// قراءة ملفات Excel (.xlsx / .xlsm) و CSV دون أي مكتبة خارجية.
// ملف xlsx هو أرشيف ZIP يحوي ملفات XML؛ نفك الضغط بـ DecompressionStream المتوفر في المتصفحات الحديثة.

export interface SheetData {
  name: string;
  rows: string[][];
}

const MAX_ROWS = 20000;

const colToIndex = (letters: string): number => {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as any).DecompressionStream;
  if (!DS) throw new Error('المتصفح لا يدعم فك ضغط ملفات Excel. استخدم ملف CSV أو حدّث المتصفح.');
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(new DS('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

interface ZipEntry { name: string; method: number; csize: number; offset: number; }

function readZipEntries(buf: Uint8Array): ZipEntry[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('الملف ليس بصيغة xlsx صحيحة');
  const total = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder('utf-8');
  const out: ZipEntry[] = [];
  for (let i = 0; i < total; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    out.push({ name, method, csize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function readEntry(buf: Uint8Array, e: ZipEntry): Promise<string> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const nameLen = dv.getUint16(e.offset + 26, true);
  const extraLen = dv.getUint16(e.offset + 28, true);
  const start = e.offset + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + e.csize);
  const bytes = e.method === 0 ? raw : await inflateRaw(raw);
  return new TextDecoder('utf-8').decode(bytes);
}

const parseXml = (xml: string): Document => new DOMParser().parseFromString(xml, 'application/xml');
const byLocal = (root: ParentNode, name: string): Element[] =>
  Array.from((root as Element | Document).getElementsByTagNameNS('*', name));

async function readXlsx(buf: Uint8Array): Promise<SheetData[]> {
  const entries = readZipEntries(buf);
  const get = async (name: string): Promise<string | null> => {
    const e = entries.find(x => x.name.toLowerCase() === name.toLowerCase());
    return e ? readEntry(buf, e) : null;
  };

  // النصوص المشتركة
  const shared: string[] = [];
  const ssXml = await get('xl/sharedStrings.xml');
  if (ssXml) {
    for (const si of byLocal(parseXml(ssXml), 'si')) {
      let text = '';
      const walk = (node: Element) => {
        for (const ch of Array.from(node.children)) {
          if (ch.localName === 't') text += ch.textContent || '';
          else if (ch.localName !== 'rPh') walk(ch);
        }
      };
      walk(si);
      shared.push(text);
    }
  }

  // أسماء الأوراق ومساراتها
  const wbXml = await get('xl/workbook.xml');
  const relsXml = await get('xl/_rels/workbook.xml.rels');
  const targets: Record<string, string> = {};
  if (relsXml) {
    for (const r of byLocal(parseXml(relsXml), 'Relationship')) {
      const id = r.getAttribute('Id') || '';
      let t = r.getAttribute('Target') || '';
      t = t.replace(/^\/+/, '');
      targets[id] = t.startsWith('xl/') ? t : 'xl/' + t;
    }
  }
  const sheetsMeta: { name: string; path: string }[] = [];
  if (wbXml) {
    for (const s of byLocal(parseXml(wbXml), 'sheet')) {
      const rid = s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || s.getAttribute('r:id') || '';
      if (targets[rid]) sheetsMeta.push({ name: s.getAttribute('name') || 'ورقة', path: targets[rid] });
    }
  }
  if (!sheetsMeta.length) {
    entries
      .filter(e => /^xl\/worksheets\/sheet\d+\.xml$/i.test(e.name))
      .forEach((e, i) => sheetsMeta.push({ name: `ورقة ${i + 1}`, path: e.name }));
  }

  const result: SheetData[] = [];
  for (const meta of sheetsMeta) {
    const xml = await get(meta.path);
    if (!xml) continue;
    const rows: string[][] = [];
    for (const row of byLocal(parseXml(xml), 'row')) {
      const rIdx = (parseInt(row.getAttribute('r') || '0', 10) || rows.length + 1) - 1;
      if (rIdx >= MAX_ROWS) break;
      const arr: string[] = [];
      let nextCol = 0;
      for (const c of Array.from(row.children)) {
        if (c.localName !== 'c') continue;
        const ref = c.getAttribute('r') || '';
        const m = /^([A-Za-z]+)/.exec(ref);
        const ci = m ? colToIndex(m[1]) : nextCol;
        nextCol = ci + 1;
        const t = c.getAttribute('t');
        let val = '';
        const v = Array.from(c.children).find(x => x.localName === 'v');
        if (t === 's') val = shared[parseInt(v?.textContent || '', 10)] ?? '';
        else if (t === 'inlineStr') val = byLocal(c, 't').map(x => x.textContent || '').join('');
        else if (t === 'b') val = v?.textContent === '1' ? 'TRUE' : 'FALSE';
        else val = v?.textContent ?? '';
        arr[ci] = val;
      }
      while (rows.length < rIdx) rows.push([]);
      rows[rIdx] = Array.from(arr, x => (x === undefined ? '' : String(x)));
    }
    result.push({ name: meta.name, rows: rows.map(r => Array.from(r, x => (x === undefined ? '' : x))) });
  }
  return result.filter(s => s.rows.some(r => r.some(c => String(c).trim() !== '')));
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function readCsv(text: string): SheetData[] {
  const clean = text.replace(/^﻿/, '');
  const lines = clean.split(/\r?\n/).filter(l => l.trim() !== '').slice(0, MAX_ROWS);
  if (!lines.length) return [];
  const sample = lines.slice(0, 10).join('\n');
  const cand = [',', ';', '\t', '|', '،'];
  const delim = cand.map(d => ({ d, n: (sample.match(new RegExp(d === '|' ? '\\|' : d, 'g')) || []).length })).sort((a, b) => b.n - a.n)[0].d;
  return [{ name: 'CSV', rows: lines.map(l => splitCsvLine(l, delim)) }];
}

export async function readSpreadsheet(file: File): Promise<SheetData[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;
  if (isZip) return readXlsx(buf);
  const isOldXls = buf.length > 4 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;
  if (isOldXls) throw new Error('صيغة xls القديمة غير مدعومة. افتح الملف في Excel واحفظه بصيغة xlsx أو CSV ثم أعد المحاولة.');
  return readCsv(new TextDecoder('utf-8').decode(buf));
}
