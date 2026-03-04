import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function updatePassword() {
  const userId = '187429d7-b203-4410-9f9b-a2964ea3ad2f';
  const newPassword = '123456';
  
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { password: newPassword }
  );

  if (error) {
    console.error('Error updating password:', error);
  } else {
    console.log('Password updated successfully for user:', userId);
  }
}

updatePassword();
