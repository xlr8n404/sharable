import { createClient } from '@supabase/supabase-js';
import { refreshAccessToken } from './auth-utils';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getGoogleDriveClient(userId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('google_refresh_token, google_drive_folder_id')
    .eq('id', userId)
    .single();

  if (error || !profile?.google_refresh_token) {
    throw new Error('User not connected to Google Drive or refresh token missing');
  }

  const accessToken = await refreshAccessToken(profile.google_refresh_token);

  return {
    accessToken,
    folderId: profile.google_drive_folder_id,
  };
}

export async function ensureRootFolder(userId: string) {
  const { accessToken, folderId } = await getGoogleDriveClient(userId);

  if (folderId) return folderId;

  // Search for existing "Sharable" folder
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='Sharable' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    const existingId = searchData.files[0].id;
    await supabaseAdmin
      .from('profiles')
      .update({ google_drive_folder_id: existingId })
      .eq('id', userId);
    return existingId;
  }

  // Create new folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Sharable',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  const createData = await createRes.json();
  const newFolderId = createData.id;

  await supabaseAdmin
    .from('profiles')
    .update({ google_drive_folder_id: newFolderId })
    .eq('id', userId);

  // Create subfolders
  await createSubFolder(accessToken, newFolderId, 'posts');
  await createSubFolder(accessToken, newFolderId, 'messages');
  await createSubFolder(accessToken, newFolderId, 'interactions');

  return newFolderId;
}

async function createSubFolder(accessToken: string, parentId: string, name: string) {
  await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
}

export async function uploadToDrive(userId: string, folderName: 'posts' | 'messages' | 'interactions', fileName: string, content: any, mimeType = 'application/json') {
  const { accessToken, folderId } = await getGoogleDriveClient(userId);
  let rootId = folderId;
  if (!rootId) {
    rootId = await ensureRootFolder(userId);
  }

  // Get subfolder ID
  const subFolderRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and '${rootId}' in parents and trashed=false`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const subFolderData = await subFolderRes.json();
  const subFolderId = subFolderData.files?.[0]?.id;

  if (!subFolderId) throw new Error(`Subfolder ${folderName} not found`);

  const metadata = {
    name: fileName,
    parents: [subFolderId],
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', new Blob([typeof content === 'string' ? content : JSON.stringify(content)], { type: mimeType }));

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Drive upload failed');

  // Set permissions so everyone can see it
  await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone',
    }),
  });

  return data;
}

export async function getFileContent(userId: string, fileId: string) {
  const { accessToken } = await getGoogleDriveClient(userId);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return await res.json();
}
