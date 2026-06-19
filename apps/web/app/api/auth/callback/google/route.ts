import { NextRequest, NextResponse } from 'next/server';

/**
 * Google OAuth callback for zkLogin flow.
 * 
 * This endpoint receives the id_token from Google after the user authenticates.
 * In a full zkLogin implementation, this would:
 * 1. Verify the JWT signature and nonce
 * 2. Extract the user's email/sub from the token
 * 3. Generate a zkLogin proof using the Mysten prover service
 * 4. Create a Sui address from the user's salt + sub
 * 5. Return the proof + address to the frontend
 * 
 * For the demo, we implement a simplified version that shows the UX flow.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const idToken = searchParams.get('id_token');
  const error = searchParams.get('error');
  
  if (error) {
    return NextResponse.redirect(new URL(`/?error=${error}`, request.url));
  }
  
  if (!idToken) {
    return NextResponse.redirect(new URL('/?error=no_token', request.url));
  }
  
  try {
    // Decode the JWT (without verification for demo)
    // In production, verify signature with Google's public keys
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    // Extract user info
    const email = payload.email;
    const sub = payload.sub; // Google user ID
    const name = payload.name;
    
    // Verify nonce (should match what we sent)
    const storedNonce = 'zklogin_nonce'; // In production, get from session/cookie
    // const expectedNonce = sessionStorage.getItem(storedNonce);
    // if (payload.nonce !== expectedNonce) {
    //   throw new Error('Nonce mismatch');
    // }
    
    // In full zkLogin, we would:
    // 1. Generate salt from user's email (or fetch from salt service)
    // 2. Create Sui address: hash(salt + sub)
    // 3. Call prover service to generate zkLogin proof
    // 4. Return proof + address to frontend
    
    // For demo, we show the user info and redirect with a token
    const userToken = Buffer.from(JSON.stringify({ email, sub, name, iat: Date.now() })).toString('base64');
    
    // Redirect to claim page with user info
    // The frontend would use this to show "Signed in as [email]"
    return NextResponse.redirect(new URL(`/?zklogin=${userToken}`, request.url));
    
  } catch (err: any) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(new URL(`/?error=callback_failed`, request.url));
  }
}

/**
 * POST handler for form-encoded responses (some OAuth flows use POST)
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const idToken = formData.get('id_token');
  
  if (!idToken || typeof idToken !== 'string') {
    return NextResponse.redirect(new URL('/?error=no_token', request.url));
  }
  
  // Reuse GET logic
  const url = new URL(request.url);
  url.searchParams.set('id_token', idToken);
  return GET(new NextRequest(url));
}
