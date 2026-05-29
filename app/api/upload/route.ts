import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { getDrive } from '@/lib/sheets';

// Crystal Procurement → PR Documents folder (default)
const FOLDER_ID = '1sW3_RPzRUNSCODlyQkPRFVIAsD3LcnDG';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const folder = (formData.get('folder') as string | null) || FOLDER_ID;
    const explicitName = (formData.get('filename') as string | null) || '';
    const prefix = (formData.get('prefix') as string | null) || '';
    const safeName = explicitName
      ? explicitName
      : prefix
        ? `${prefix}__${Date.now()}__${file.name}`
        : `${Date.now()}__${file.name}`;

    const drive = await getDrive();
    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);

    const created = await drive.files.create({
      requestBody: {
        name: safeName,
        parents: [folder],
      },
      media: {
        mimeType: file.type || 'application/octet-stream',
        body: stream,
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });

    const fileId = created.data.id;
    if (!fileId) {
      return NextResponse.json({ error: 'Drive did not return a file id' }, { status: 500 });
    }

    // Anyone with the link can view (needed for the sheet link to be openable)
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });

    return NextResponse.json({
      url: created.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
      id: fileId,
      name: file.name,
    });
  } catch (e: any) {
    console.error('Upload failed:', e);
    return NextResponse.json({ error: e.message || 'Upload failed' }, { status: 500 });
  }
}
