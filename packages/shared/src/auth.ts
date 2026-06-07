export interface SafeUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  createdAt: Date;
}

export interface AuthResponse {
  user: SafeUser;
  sessionExpiresAt: string;
}
