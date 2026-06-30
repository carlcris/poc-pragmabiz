export type XlsxCellValue = string | number | boolean | null | undefined;

const textEncoder = new TextEncoder();

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index: number) {
  let result = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function createWorksheetXml(rows: XlsxCellValue[][]) {
  const rowXml = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((cell, columnIndex) => {
          const ref = `${columnName(columnIndex)}${rowNumber}`;
          if (cell === null || cell === undefined) {
            return `<c r="${ref}"/>`;
          }
          if (typeof cell === "number") {
            return `<c r="${ref}"><v>${Number.isFinite(cell) ? cell : 0}</v></c>`;
          }
          if (typeof cell === "boolean") {
            return `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  const lastColumn = columnName(Math.max(rows[0]?.length ?? 1, 1) - 1);
  const lastRow = Math.max(rows.length, 1);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

function concatBytes(chunks: Uint8Array[]) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function createLocalFileHeader(fileName: Uint8Array, data: Uint8Array, crc: number) {
  const header = new Uint8Array(30 + fileName.length);
  const view = new DataView(header.buffer);
  writeUint32(view, 0, 0x04034b50);
  writeUint16(view, 4, 20);
  writeUint16(view, 6, 0x0800);
  writeUint16(view, 8, 0);
  writeUint16(view, 10, 0);
  writeUint16(view, 12, 0);
  writeUint32(view, 14, crc);
  writeUint32(view, 18, data.length);
  writeUint32(view, 22, data.length);
  writeUint16(view, 26, fileName.length);
  writeUint16(view, 28, 0);
  header.set(fileName, 30);
  return header;
}

function createCentralDirectoryHeader(
  fileName: Uint8Array,
  data: Uint8Array,
  crc: number,
  localHeaderOffset: number
) {
  const header = new Uint8Array(46 + fileName.length);
  const view = new DataView(header.buffer);
  writeUint32(view, 0, 0x02014b50);
  writeUint16(view, 4, 20);
  writeUint16(view, 6, 20);
  writeUint16(view, 8, 0x0800);
  writeUint16(view, 10, 0);
  writeUint16(view, 12, 0);
  writeUint16(view, 14, 0);
  writeUint32(view, 16, crc);
  writeUint32(view, 20, data.length);
  writeUint32(view, 24, data.length);
  writeUint16(view, 28, fileName.length);
  writeUint16(view, 30, 0);
  writeUint16(view, 32, 0);
  writeUint16(view, 34, 0);
  writeUint16(view, 36, 0);
  writeUint32(view, 38, 0);
  writeUint32(view, 42, localHeaderOffset);
  header.set(fileName, 46);
  return header;
}

function createEndOfCentralDirectory(fileCount: number, centralDirectorySize: number, offset: number) {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  writeUint32(view, 0, 0x06054b50);
  writeUint16(view, 4, 0);
  writeUint16(view, 6, 0);
  writeUint16(view, 8, fileCount);
  writeUint16(view, 10, fileCount);
  writeUint32(view, 12, centralDirectorySize);
  writeUint32(view, 16, offset);
  writeUint16(view, 20, 0);
  return header;
}

export function createXlsxWorkbookBlob(sheetName: string, rows: XlsxCellValue[][]) {
  const safeSheetName = xmlEscape(sheetName.slice(0, 31) || "Sheet1");
  const files = [
    {
      path: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    },
    {
      path: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      path: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    },
    {
      path: "xl/worksheets/sheet1.xml",
      content: createWorksheetXml(rows),
    },
  ];

  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const fileName = textEncoder.encode(file.path);
    const data = textEncoder.encode(file.content);
    const crc = crc32(data);
    const localHeader = createLocalFileHeader(fileName, data, crc);
    localChunks.push(localHeader, data);
    centralChunks.push(createCentralDirectoryHeader(fileName, data, crc, offset));
    offset += localHeader.length + data.length;
  }

  const centralDirectory = concatBytes(centralChunks);
  const endOfCentralDirectory = createEndOfCentralDirectory(files.length, centralDirectory.length, offset);
  const workbook = concatBytes([...localChunks, centralDirectory, endOfCentralDirectory]);

  return new Blob([workbook], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
