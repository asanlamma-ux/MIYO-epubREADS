import { ISyncAdapter, BackupData } from './ISyncAdapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import { makeRedirectUri } from 'expo-auth-session';

const GDRIVE_TOKEN_KEY = '@miyo/sync/gdrive_token';
const CLIENT_ID = 'YOUR_GOOGLE_DRIVE_CLIENT_ID.apps.googleusercontent.com'; // TODO: Replace with real client ID

export class GoogleDriveAdapter implements ISyncAdapter {
  id = 'gdrive';
  name = 'Google Drive';
  icon = 'google-drive';

  private accessToken: string | null = null;
  private readonly discovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  };

  async authenticate(): Promise<boolean> {
    try {
      const redirectUri = makeRedirectUri({
        scheme: 'miyo'
      });

      const request = new AuthSession.AuthRequest({
        clientId: CLIENT_ID,
        // We request drive.file scope so the user is prompted to let this app save files into their personal Google Drive
        scopes: ['https://www.googleapis.com/auth/drive.file'],
        redirectUri,
        responseType: AuthSession.ResponseType.Token,
      });

      const result = await request.promptAsync(this.discovery);

      if (result.type === 'success' && result.authentication?.accessToken) {
        this.accessToken = result.authentication.accessToken;
        await AsyncStorage.setItem(GDRIVE_TOKEN_KEY, this.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    if (this.accessToken) return true;
    const storedToken = await AsyncStorage.getItem(GDRIVE_TOKEN_KEY);
    if (storedToken) {
      this.accessToken = storedToken;
      return true;
    }
    return false;
  }

  async logout(): Promise<void> {
    this.accessToken = null;
    await AsyncStorage.removeItem(GDRIVE_TOKEN_KEY);
  }

  private async getFileId(): Promise<string | null> {
    if (!this.accessToken) return null;
    try {
      const response = await fetch(
        'https://www.googleapis.com/drive/v3/files?spaces=drive&q=name="miyo_backup.json" and trashed=false',
        {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        }
      );
      const data = await response.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
      return null;
    } catch {
      return null;
    }
  }

  async uploadBackup(data: BackupData): Promise<boolean> {
    if (!this.accessToken) return false;

    try {
      const fileId = await this.getFileId();
      const metadata: any = {
        name: 'miyo_backup.json',
      };
      // Omitting 'parents' defaults to saving the file in the root of the user's visible Google Drive

      const boundary = 'foo_bar_baz';
      const body = `
--${boundary}
Content-Type: application/json; charset=UTF-8

${JSON.stringify(metadata)}
--${boundary}
Content-Type: application/json

${JSON.stringify(data)}
--${boundary}--`;

      const method = fileId ? 'PATCH' : 'POST';
      const url = fileId 
        ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async downloadBackup(): Promise<BackupData | null> {
    if (!this.accessToken) return null;

    try {
      const fileId = await this.getFileId();
      if (!fileId) return null;

      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });

      if (response.ok) {
        return await response.json() as BackupData;
      }
      return null;
    } catch {
      return null;
    }
  }

  async getLastSyncTime(): Promise<string | null> {
    if (!this.accessToken) return null;
    try {
      const fileId = await this.getFileId();
      if (!fileId) return null;
      
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      const data = await response.json();
      return data.modifiedTime || null;
    } catch {
      return null;
    }
  }
}
