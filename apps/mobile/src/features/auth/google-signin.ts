import { env } from '@/lib/env';
import {
    GoogleSignin,
    isSuccessResponse,
    statusCodes,
} from '@react-native-google-signin/google-signin';

let configured = false;

export function configureGoogleSignIn(): void {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: env.googleWebClientId,
    iosClientId: env.googleIosClientId,
    offlineAccess: false,
  });
  configured = true;
}

export type GoogleSignInResult =
  | { kind: 'success'; idToken: string }
  | { kind: 'cancelled' }
  | { kind: 'in_progress' }
  | { kind: 'play_services_unavailable' }
  | { kind: 'no_id_token' }
  | { kind: 'error'; message: string };

export async function googleSignIn(): Promise<GoogleSignInResult> {
  configureGoogleSignIn();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      return { kind: 'cancelled' };
    }

    const idToken = response.data.idToken;
    if (!idToken) return { kind: 'no_id_token' };

    return { kind: 'success', idToken };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e.code === statusCodes.SIGN_IN_CANCELLED) return { kind: 'cancelled' };
    if (e.code === statusCodes.IN_PROGRESS) return { kind: 'in_progress' };
    if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { kind: 'play_services_unavailable' };
    }
    return { kind: 'error', message: e.message ?? 'Unknown error' };
  }
}

export async function googleSignOut(): Promise<void> {
  configureGoogleSignIn();
  try {
    await GoogleSignin.signOut();
  } catch {
    // ignore — safe to fail silently
  }
}
