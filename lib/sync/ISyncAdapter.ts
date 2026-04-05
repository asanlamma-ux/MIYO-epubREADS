export interface BackupData {
  timestamp: string;
  keys: Record<string, string>;
  version: string;
}

export interface ISyncAdapter {
  id: string; // e.g., 'gdrive', 'webdav'
  name: string; // e.g., 'Google Drive', 'WebDAV'
  icon: string; // e.g., 'folder', 'cloud'
  
  // Authentication
  authenticate: () => Promise<boolean>;
  isAuthenticated: () => Promise<boolean>;
  logout: () => Promise<void>;
  
  // Settings (used for WebDAV, FTP, etc where host is required)
  configure?: (config: Record<string, string>) => Promise<void>;
  getConfig?: () => Promise<Record<string, string> | null>;
  
  // Sync Operations
  uploadBackup: (data: BackupData) => Promise<boolean>;
  downloadBackup: () => Promise<BackupData | null>;
  getLastSyncTime: () => Promise<string | null>;
}
