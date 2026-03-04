import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  response.cookies.delete('sb-auth-token');
  
  return response;
}
