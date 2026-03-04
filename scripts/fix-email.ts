import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function fixUserEmail() {
  const userId = '187429d7-b203-4410-9f9b-a2964ea3ad2f';
  const newEmail = 'najemislam@shareit.com';
  
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { email: newEmail }
  );

  if (error) {
    console.error('Error updating email:', error);
  } else {
    console.log('Email updated successfully for user:', userId);
  }
}

fixUserEmail();
