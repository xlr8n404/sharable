import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-utils';
import { uploadToDrive, ensureRootFolder } from '@/lib/google-drive';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const token = req.cookies.get('sb-auth-token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyToken(token);
  if (!payload || !payload.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = payload.userId as string;

  try {
    const formData = await req.formData();
    const type = formData.get('type') as 'posts' | 'messages' | 'interactions';
    const metadata = JSON.parse(formData.get('metadata') as string);
    const files = formData.getAll('files') as File[];

    await ensureRootFolder(userId);

    const uploadedFiles = [];
    for (const file of files) {
      const res = await uploadToDrive(userId, type, file.name, file, file.type);
      uploadedFiles.push({
        id: res.id,
        name: res.name,
        webViewLink: res.webViewLink,
        webContentLink: res.webContentLink,
      });
    }

    // Also upload a metadata JSON
    const metadataFileName = `${type}_${Date.now()}.json`;
    const metadataRes = await uploadToDrive(userId, type, metadataFileName, {
      ...metadata,
      syncedAt: new Date().toISOString(),
      files: uploadedFiles,
    });

    return NextResponse.json({
      success: true,
      metadataId: metadataRes.id,
      files: uploadedFiles,
    });
  } catch (error: any) {
    console.error('Drive sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
