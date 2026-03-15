import { google } from 'googleapis';
import { initializeFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID || "144251106401-7asi8iiqruhe8jq52drha3ct6pgkn4rq.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET || "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";
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback` : "https://studio--studio-6224335835-298c7.us-central1.hosted.app/api/auth/google/callback";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/dashboard/settings?tab=automation&error=no_code', request.url));
  }

  try {
    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
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
