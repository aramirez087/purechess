import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    adminUserId: string,
    action: string,
    targetType: string,
    targetId: string,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.adminAuditLog.create({
      data: { adminUserId, action, targetType, targetId, payload },
    });
  }
}
