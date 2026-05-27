import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env manually
const envPath = join(__dirname, '../.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);

const SHEET_ID = env.GOOGLE_SHEET_ID;
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const RENAMES = {
  'Copy of PR_Items':           'PR_Items',
  'Copy of PO_Master':          'PO_Master',
  'Copy of PO_Items':           'PO_Items',
  'Copy of Vendor_Master':      'Vendor_Master',
  'Copy of Master_Data':        'Master_Data',
  'Copy of COUNTERS':           'COUNTERS',
  'Copy of GRN_Master':         'GRN_Master',
  'Copy of GRN_Items':          'GRN_Items',
  'Copy of Bill Verification':  'Bill_Verification',
  'Copy of Access-Matrix':      'Access_Matrix',
};

const DELETES = ['Copy of Bill Verification 1'];

const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
const sheetsList = meta.data.sheets || [];

const requests = [];

for (const sheet of sheetsList) {
  const title = sheet.properties?.title;
  const sheetId = sheet.properties?.sheetId;

  if (DELETES.includes(title)) {
    requests.push({ deleteSheet: { sheetId } });
    console.log(`🗑  Deleting: "${title}"`);
  } else if (RENAMES[title]) {
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, title: RENAMES[title] },
        fields: 'title',
      },
    });
    console.log(`✏️  Renaming: "${title}" → "${RENAMES[title]}"`);
  } else {
    console.log(`✓  Keeping:  "${title}"`);
  }
}

if (requests.length > 0) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests },
  });
  console.log('\n✅ Done. All tabs renamed.');
} else {
  console.log('\nNothing to rename.');
}
