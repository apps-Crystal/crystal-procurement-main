import { getSheets } from '@/lib/sheets';
import { NextResponse } from 'next/server';

export async function GET() {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID! });
  const tabs = res.data.sheets?.map(s => s.properties?.title) || [];
  return NextResponse.json({ tabs });
}
