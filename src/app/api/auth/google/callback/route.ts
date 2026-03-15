import { google } from 'googleapis';
import { initializeFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID || "144251106401-7asi8iiqruhe8jq52drha3ct6pgkn4rq.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET || "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";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/dashboard/settings?tab=automation&error=no_code', request.url));
  }

  try {
    // Dynamically determine the Redirect URI based on the incoming request to match the one sent during authorization
    const host = request.headers.get('host') || 'localhost:9002';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const redirectUri = `${protocol}://${host}/api/auth/google/callback`;

    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    const { firestore } = initializeFirebase();
    const tokenRef = doc(firestore, 'settings', 'drive_tokens');
    
    // Save tokens to Firestore for the background flows to use
    await setDoc(tokenRef, {
      ...tokens,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.redirect(new URL('/dashboard/settings?tab=automation&success=connected', request.url));
  } catch (error) {
    console.error('OAuth Callback Error:', error);
    return NextResponse.redirect(new URL('/dashboard/settings?tab=automation&error=auth_failed', request.url));
  }
}
