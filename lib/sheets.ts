import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY
        ?.replace(/^["']|["']$/g, '')   // strip surrounding quotes if pasted with them
        ?.replace(/\\n/g, '\n'),         // convert literal \n to real newlines
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

export async function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

export async function getDrive() {
  const auth = getAuth();
  return google.drive({ version: 'v3', auth });
}

export async function readSheet(range: string): Promise<string[][]> {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });
  return (res.data.values || []) as string[][];
}

export async function appendRow(range: string, values: (string | number | null)[]): Promise<void> {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

// Deterministic row write.
// Even `values.append` with INSERT_ROWS and an A1 anchor mis-places rows when
// the sheet has stray data far to the right from older broken writes — Google
// detects a wider "table" and shifts new rows accordingly. So we bypass
// auto-detect entirely:
//   1. Read the sheet to find the next empty row.
//   2. Expand the sheet's row grid if our target row is beyond it.
//   3. `values.update` at exactly `SheetName!A{row}` — no auto-detect possible.
export async function writeNewRow(sheetName: string, values: (string | number | null)[]): Promise<number> {
  const sheets = await getSheets();
  const existing = await readSheet(sheetName);
  const nextRow = existing.length + 1;

  // Make sure the grid is large enough before writing.
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: 'sheets(properties(sheetId,title,gridProperties(rowCount)))',
  });
  const sheet = meta.data.sheets?.find(s => s.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId;
  const currentRows = sheet?.properties?.gridProperties?.rowCount || 0;
  if (sheetId !== undefined && sheetId !== null && currentRows < nextRow) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: { rowCount: nextRow + 500 },
            },
            fields: 'gridProperties.rowCount',
          },
        }],
      },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
  return nextRow;
}

export async function updateRow(range: string, values: (string | number | null)[]): Promise<void> {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

export async function batchRead(ranges: string[]): Promise<Record<string, string[][]>> {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SHEET_ID,
    ranges,
  });
  const result: Record<string, string[][]> = {};
  res.data.valueRanges?.forEach((r, i) => {
    result[ranges[i]] = (r.values || []) as string[][];
  });
  return result;
}

// Convert sheet rows to objects using header row
export function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

// Find row index by key column value (1-indexed, includes header)
export function findRowIndex(rows: string[][], colIndex: number, value: string): number {
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][colIndex] === value) return i + 1; // +1 for 1-indexed sheets
  }
  return -1;
}

// Get next counter value for ID generation.
// COUNTERS sheet layout: Key | LastSerial | UpdatedAt
// Key format: `${entity}:${site}:${month}` (e.g. "PR:Taloja:May2026")
export async function getNextId(entity: string, site: string, month: string): Promise<string> {
  const rows = await readSheet('COUNTERS');
  const headers = rows[0] || [];
  const keyCol = headers.indexOf('Key');
  const serialCol = headers.indexOf('LastSerial');
  const updatedAtCol = headers.indexOf('UpdatedAt');

  if (keyCol === -1 || serialCol === -1) {
    throw new Error('COUNTERS sheet missing Key or LastSerial column');
  }

  const key = `${entity}:${site}:${month}`;
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const colLetter = (idx: number) => String.fromCharCode(65 + idx);

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][keyCol] === key) {
      const current = parseInt(rows[i][serialCol] || '0', 10);
      const next = current + 1;
      const sheets = await getSheets();
      const startCol = Math.min(serialCol, updatedAtCol === -1 ? serialCol : updatedAtCol);
      const endCol = Math.max(serialCol, updatedAtCol === -1 ? serialCol : updatedAtCol);
      const rowValues: (string | number)[] = [];
      for (let c = startCol; c <= endCol; c++) {
        if (c === serialCol) rowValues.push(next);
        else if (c === updatedAtCol) rowValues.push(now);
        else rowValues.push(rows[i][c] || '');
      }
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `COUNTERS!${colLetter(startCol)}${i + 1}:${colLetter(endCol)}${i + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowValues] },
      });
      return String(next).padStart(4, '0');
    }
  }

  // Create new counter row matching the existing column order.
  const newRow: (string | number)[] = new Array(headers.length).fill('');
  newRow[keyCol] = key;
  newRow[serialCol] = 1;
  if (updatedAtCol !== -1) newRow[updatedAtCol] = now;
  await appendRow('COUNTERS', newRow);
  return '0001';
}
