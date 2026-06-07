export interface LoginDto {
  emailOrUsername: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  username: string;
}

export interface PasswordResetRequestDto {
  email: string;
}

export interface PasswordResetConfirmDto {
  token: string;
  newPassword: string;
}
