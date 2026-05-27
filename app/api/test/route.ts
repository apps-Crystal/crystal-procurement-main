import { readSheet, rowsToObjects } from '@/lib/sheets';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const rows = await readSheet('PR_Master!A1:E5');
    return NextResponse.json({ ok: true, sample: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
