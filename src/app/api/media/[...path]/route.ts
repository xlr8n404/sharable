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

  try {
    // Download the file from Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(filePath);

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const contentType = data.type || 'application/octet-stream';
    const buffer = Buffer.from(await data.arrayBuffer());
    const fileSize = buffer.length;

    // Check for Range header
    const range = request.headers.get('range');

    if (range) {
      // Parse range header: "bytes=start-end"
      const parts = range.replace(/bytes=/, '').split('-');
      let start = parseInt(parts[0], 10);
      let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Validate range
      if (isNaN(start)) start = 0;
      if (isNaN(end)) end = fileSize - 1;
      if (start >= fileSize || end >= fileSize || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        });
      }

      const chunksize = end - start + 1;
      const chunk = buffer.slice(start, end + 1);

      return new NextResponse(chunk, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=604800',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // Full file response
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileSize.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=604800, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'X-Frame-Options': 'DENY',
      },
    });
  } catch (err) {
    console.error('Media proxy error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
