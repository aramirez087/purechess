import type { User } from '@prisma/client';
import type { SafeUser } from '@purechess/shared';

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
    emailVerified: user.emailVerifiedAt != null,
    createdAt: user.createdAt,
  };
}