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

// Get next counter value for ID generation
export async function getNextId(entity: string, site: string, month: string): Promise<string> {
  const rows = await readSheet('COUNTERS');
  const headers = rows[0];
  const entityCol = headers.indexOf('Entity');
  const siteCol = headers.indexOf('Site');
  const monthCol = headers.indexOf('Month');
  const counterCol = headers.indexOf('Counter');

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][entityCol] === entity && rows[i][siteCol] === site && rows[i][monthCol] === month) {
      const current = parseInt(rows[i][counterCol] || '0');
      const next = current + 1;
      // Update counter
      const sheets = await getSheets();
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `COUNTERS!${String.fromCharCode(65 + counterCol)}${i + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[next]] },
      });
      return String(next).padStart(4, '0');
    }
  }

  // Create new counter row
  await appendRow('COUNTERS', [entity, site, month, 1]);
  return '0001';
}
