import {
  Injectable,
  NotFoundException,
  GoneException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../database/prisma.service";
import { CreateInviteDto } from "./dto/create-invite.dto";
import { InviteGateway } from "./invite-gateway";
import { PosthogService } from "../analytics/posthog.service";

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export type InviteColor = "white" | "black" | "random";

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: InviteGateway,
    private readonly posthog: PosthogService,
  ) {}

  async createInvite(
    userId: string,
    dto: CreateInviteDto,
    color: InviteColor,
    appUrl: string,
  ) {
    const token = randomBytes(16).toString("base64url");
    const creatorIsBlack = color === "black";

    const game = await this.prisma.game.create({
      data: {
        whiteUserId: creatorIsBlack ? null : userId,
        blackUserId: creatorIsBlack ? userId : null,
        timeControlSeconds: dto.timeControlSeconds,
        incrementSeconds: dto.incrementSeconds,
        category: dto.category,
        isRated: dto.rated ?? false,
        status: "invite_pending",
        inviteToken: token,
        inviteColorChoice: color,
      },
    });

    const inviteUrl = `${appUrl}/invite/${token}`;
    this.gateway.emitInviteCreated(userId, { gameId: game.id, inviteUrl });

    this.posthog.captureEvent(userId, "invite_created", {
      game_id: game.id,
      time_control_seconds: dto.timeControlSeconds,
      increment_seconds: dto.incrementSeconds,
      category: dto.category,
      color,
    });

    return { gameId: game.id, inviteToken: token, inviteUrl };
  }

  async getInviteByToken(token: string) {
    const game = await this.prisma.game.findUnique({
      where: { inviteToken: token },
      include: {
        whitePlayer: { select: { id: true, username: true, avatarUrl: true } },
        blackPlayer: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    if (!game) throw new NotFoundException("Invite not found");

    if (game.status === "aborted")
      throw new GoneException("Invite has been cancelled");

    if (game.status !== "invite_pending") {
      return {
        gameId: game.id,
        timeControlSeconds: game.timeControlSeconds,
        incrementSeconds: game.incrementSeconds,
        category: game.category,
        creator: game.whitePlayer ?? game.blackPlayer,
        creatorColor: game.whitePlayer ? "white" : "black",
        rated: game.isRated,
        status: game.status,
      };
    }

    if (Date.now() - game.createdAt.getTime() > INVITE_TTL_MS) {
      await this.prisma.game.update({
        where: { id: game.id },
        data: { status: "aborted" },
      });
      throw new GoneException("Invite has expired");
    }

    const creator = game.whitePlayer ?? game.blackPlayer;
    const creatorColor = game.whitePlayer ? "white" : "black";
    // Legacy rows (NULL inviteColorChoice) fall back to the concrete slot,
    // which is what the preview showed before the column existed.
    const colorChoice = (game.inviteColorChoice ?? creatorColor) as InviteColor;

    return {
      gameId: game.id,
      timeControlSeconds: game.timeControlSeconds,
      incrementSeconds: game.incrementSeconds,
      category: game.category,
      creator,
      creatorColor,
      colorChoice,
      rated: game.isRated,
      status: game.status,
    };
  }

  async acceptInvite(token: string, acceptorId: string) {
    const game = await this.prisma.game.findUnique({
      where: { inviteToken: token },
    });

    if (!game) throw new NotFoundException("Invite not found");

    if (game.status === "aborted")
      throw new GoneException("Invite has been cancelled");

    if (game.status !== "invite_pending") {
      throw new ConflictException("Invite is no longer pending");
    }

    if (Date.now() - game.createdAt.getTime() > INVITE_TTL_MS) {
      await this.prisma.game.update({
        where: { id: game.id },
        data: { status: "aborted" },
      });
      throw new GoneException("Invite has expired");
    }

    const creatorId = game.whiteUserId ?? game.blackUserId;
    if (creatorId === acceptorId) {
      throw new ForbiddenException("Cannot accept your own invite");
    }

    const creatorIsBlack =
      game.blackUserId === creatorId && game.whiteUserId === null;

    let newWhiteUserId: string;
    let newBlackUserId: string;

    if (creatorIsBlack) {
      newWhiteUserId = acceptorId;
      newBlackUserId = creatorId!;
    } else {
      // Prefer the explicit stored choice; legacy rows (NULL column) keep the
      // old null-slot heuristic: creator-in-white-slot + empty black = random.
      const isRandom = game.inviteColorChoice
        ? game.inviteColorChoice === "random"
        : game.whiteUserId === creatorId && game.blackUserId === null;
      if (isRandom && Math.random() < 0.5) {
        newWhiteUserId = acceptorId;
        newBlackUserId = creatorId!;
      } else {
        newWhiteUserId = creatorId!;
        newBlackUserId = acceptorId;
      }
    }

    const result = await this.prisma.game.updateMany({
      where: { id: game.id, status: "invite_pending" },
      data: {
        whiteUserId: newWhiteUserId,
        blackUserId: newBlackUserId,
        status: "active",
        startedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new ConflictException("Invite was already accepted");
    }

    this.gateway.emitInviteAccepted(creatorId!, acceptorId, {
      gameId: game.id,
    });

    this.posthog.captureEvent(acceptorId, "invite_accepted", {
      game_id: game.id,
      time_control_seconds: game.timeControlSeconds,
      increment_seconds: game.incrementSeconds,
      category: game.category,
    });

    return { gameId: game.id };
  }

  async cancelInvite(token: string, userId: string) {
    const game = await this.prisma.game.findUnique({
      where: { inviteToken: token },
    });

    if (!game) throw new NotFoundException("Invite not found");

    if (game.status !== "invite_pending") {
      throw new ConflictException("Invite is no longer pending");
    }

    const creatorId = game.whiteUserId ?? game.blackUserId;
    if (creatorId !== userId) {
      throw new ForbiddenException("Only the creator can cancel this invite");
    }

    await this.prisma.game.update({
      where: { id: game.id },
      data: { status: "aborted" },
    });

    this.posthog.captureEvent(userId, "invite_cancelled", {
      game_id: game.id,
      time_control_seconds: game.timeControlSeconds,
      increment_seconds: game.incrementSeconds,
      category: game.category,
    });

    return { success: true };
  }
}
