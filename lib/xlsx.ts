// Tiny dependency-free .xlsx (OOXML) writer. Enough to export a single sheet
// of strings/numbers with an optional bold header and total row — no external
// library, same spirit as the canvas PNG export. Produces a real .xlsx that
// Excel / Google Sheets / LibreOffice open natively (STORE-only zip, so no
// compression code is needed; the files are tiny anyway).

export type Cell = string | number | null | undefined;

interface BuildOpts {
  colWidths?: number[]; // in Excel "characters", one per column
  boldFirstRow?: boolean;
  boldLastRow?: boolean;
}

function xmlEsc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // strip C0 control chars Excel rejects (keep tab/newline)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function colName(n: number): string {
  // 1-based column index → A, B, … Z, AA, …
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellXml(ref: string, value: Cell, styleId: number): string {
  const s = styleId ? ` s="${styleId}"` : "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"${s}><v>${value}</v></c>`;
  }
  const t = xmlEsc(value == null ? "" : String(value));
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${t}</t></is></c>`;
}

function sheetXml(rows: Cell[][], opts: BuildOpts): string {
  const last = rows.length - 1;
  const body = rows
    .map((row, ri) => {
      const bold =
        (ri === 0 && opts.boldFirstRow) || (ri === last && opts.boldLastRow) ? 1 : 0;
      const cells = row
        .map((v, ci) => cellXml(`${colName(ci + 1)}${ri + 1}`, v, bold))
        .join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");

  const cols = opts.colWidths?.length
    ? `<cols>${opts.colWidths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join("")}</cols>`
    : "";

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    cols +
    `<sheetData>${body}</sheetData></worksheet>`
  );
}

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border/></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>` +
  `</styleSheet>`;

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`;

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const WORKBOOK_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`;

function workbookXml(sheetName: string): string {
  const name = xmlEsc(sheetName.replace(/[\\/?*[\]:]/g, " ").slice(0, 31)) || "Sheet1";
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`
  );
}

// --- minimal STORE-only zip ---------------------------------------------

let CRC_TABLE: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!CRC_TABLE) {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    CRC_TABLE = t;
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

class Writer {
  private parts: Uint8Array[] = [];
  len = 0;
  push(a: Uint8Array) {
    this.parts.push(a);
    this.len += a.length;
  }
  u16(n: number) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n & 0xffff, true);
    this.push(b);
  }
  u32(n: number) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n >>> 0, true);
    this.push(b);
  }
  bytes(): Uint8Array {
    const out = new Uint8Array(this.len);
    let o = 0;
    for (const p of this.parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  }
}

function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const central = new Writer();
  const local = new Writer();
  const offsets: number[] = [];

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    offsets.push(local.len);
    // local file header
    local.u32(0x04034b50);
    local.u16(20); // version needed
    local.u16(0x0800); // UTF-8 names
    local.u16(0); // method: store
    local.u16(0); // mod time
    local.u16(0x21); // mod date (1980-01-01)
    local.u32(crc);
    local.u32(f.data.length);
    local.u32(f.data.length);
    local.u16(nameBytes.length);
    local.u16(0);
    local.push(nameBytes);
    local.push(f.data);
  }

  files.forEach((f, i) => {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    central.u32(0x02014b50);
    central.u16(20); // version made by
    central.u16(20); // version needed
    central.u16(0x0800);
    central.u16(0);
    central.u16(0);
    central.u16(0x21);
    central.u32(crc);
    central.u32(f.data.length);
    central.u32(f.data.length);
    central.u16(nameBytes.length);
    central.u16(0); // extra
    central.u16(0); // comment
    central.u16(0); // disk
    central.u16(0); // internal attrs
    central.u32(0); // external attrs
    central.u32(offsets[i]);
    central.push(nameBytes);
  });

  const localBytes = local.bytes();
  const centralBytes = central.bytes();
  const end = new Writer();
  end.u32(0x06054b50);
  end.u16(0);
  end.u16(0);
  end.u16(files.length);
  end.u16(files.length);
  end.u32(centralBytes.length);
  end.u32(localBytes.length);
  end.u16(0);

  const out = new Uint8Array(localBytes.length + centralBytes.length + end.len);
  out.set(localBytes, 0);
  out.set(centralBytes, localBytes.length);
  out.set(end.bytes(), localBytes.length + centralBytes.length);
  return out;
}

/** Build a one-sheet .xlsx from an array of rows. Returns the raw bytes. */
export function buildXlsxBytes(sheetName: string, rows: Cell[][], opts: BuildOpts = {}): Uint8Array {
  const enc = new TextEncoder();
  const files = [
    { name: "[Content_Types].xml", data: enc.encode(CONTENT_TYPES) },
    { name: "_rels/.rels", data: enc.encode(ROOT_RELS) },
    { name: "xl/workbook.xml", data: enc.encode(workbookXml(sheetName)) },
    { name: "xl/_rels/workbook.xml.rels", data: enc.encode(WORKBOOK_RELS) },
    { name: "xl/styles.xml", data: enc.encode(STYLES_XML) },
    { name: "xl/worksheets/sheet1.xml", data: enc.encode(sheetXml(rows, opts)) },
  ];
  return zip(files);
}

/** Same as buildXlsxBytes but wrapped in a Blob ready for download/share. */
export function buildXlsxBlob(sheetName: string, rows: Cell[][], opts: BuildOpts = {}): Blob {
  const bytes = buildXlsxBytes(sheetName, rows, opts) as unknown as BlobPart;
  return new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
