import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth-utils';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Allowed buckets — only serve files from these
const ALLOWED_BUCKETS = ['posts', 'avatars', 'covers', 'stories'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Verify authentication
  const sessionToken = request.cookies.get('sb-auth-token')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyToken(sessionToken);
  if (!payload || !payload.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { path } = await params;
  if (!path || path.length < 2) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const bucket = path[0];
  const filePath = path.slice(1).join('/');

  // Only allow whitelisted buckets
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Prevent path traversal
  const normalised = filePath.replace(/\.\./g, '');
  if (normalised !== filePath) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  // Check for Range header
  const range = request.headers.get('range');

  if (range) {
    // For range requests, we need to get the file size and then stream the range
    const { data: fileInfo, error: infoError } = await supabaseAdmin.storage
      .from(bucket)
      .list(filePath.substring(0, filePath.lastIndexOf('/')), {
        search: filePath.substring(filePath.lastIndexOf('/') + 1),
      });

    const file = fileInfo?.find(f => f.name === filePath.substring(filePath.lastIndexOf('/') + 1));
    
    if (infoError || !file) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const fileSize = file.metadata.size;
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(filePath, {
        transform: {
          // Supabase download options don't support range directly in the download method easily with the standard client
          // but we can pass it through the headers if needed or just download the whole thing if it's small.
          // However, for better video support, we should use the range.
        },
        // Using the standard download for now but serving it as a partial response if requested
      });

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const chunk = buffer.slice(start, end + 1);

    return new NextResponse(chunk, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': data.type || 'application/octet-stream',
        'Cache-Control': 'private, max-age=604800',
      },
    });
  }

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .download(filePath);

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const contentType = data.type || 'application/octet-stream';

  return new NextResponse(data, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      // Cache media in the browser for 7 days
      'Cache-Control': 'private, max-age=604800, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
    },
  });
}
