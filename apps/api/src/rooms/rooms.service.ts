import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LeaguesService } from '../leagues/leagues.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { ChallengesService } from '../challenges/challenges.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leaguesService: LeaguesService,
    private readonly challengesService: ChallengesService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * A sala nasce **com** o desafio, quando o cliente diz como ela funciona.
   *
   * O par `1970-01-01`/`1970-01-02` não é lixo: é uma janela morta deliberada,
   * e é ela que faz `activeChallenge` ser `null`. O efeito colateral era o
   * defeito — sala recém-criada não mostrava timer nem faixa de "estudando
   * agora", porque as duas coisas dependem de um desafio em modo `study`, e
   * criar esse desafio era um segundo passo que nada na tela pedia.
   *
   * Com `participation_mode` e `duration_days` a janela nasce viva e o modo
   * vale desde o primeiro segundo. Sem eles, a janela morta continua — é o que
   * a build 1.2.1 em campo manda, e ela deve seguir funcionando como sempre.
   */
  async create(userId: string, dto: CreateRoomDto) {
    const agora = new Date();
    const nasceComDesafio = dto.duration_days != null;

    // `@db.Date` guarda só a data; as strings vão no mesmo formato que
    // `leagues.service` espera, e o cálculo é em UTC para não escorregar um dia
    // para quem cria a sala perto da meia-noite.
    const inicio = agora.toISOString().split('T')[0];
    const fim = nasceComDesafio
      ? new Date(
          Date.UTC(
            agora.getUTCFullYear(),
            agora.getUTCMonth(),
            agora.getUTCDate() + dto.duration_days!,
          ),
        )
          .toISOString()
          .split('T')[0]
      : '1970-01-02';

    const league = await this.leaguesService.create(userId, {
      name: dto.name,
      display_name: dto.display_name,
      start_date: nasceComDesafio ? inicio : '1970-01-01',
      end_date: fim,
      privacy: 'private',
      mode: 'competitive',
    });

    // O modo não passa por `leagues.service`: `CreateLeagueDto` não o conhece —
    // `League.mode` de lá é outro eixo (rigor de prova), e sobrecarregá-lo era
    // exatamente o que `DIRECAO-PRODUTO` proíbe.
    const comModo =
      nasceComDesafio && dto.participation_mode
        ? await this.prisma.league.update({
            where: { id: league.id },
            data: { participationMode: dto.participation_mode },
          })
        : league;

    return {
      id: league.id,
      name: league.name,
      inviteCode: league.inviteCode,
      maxMembers: league.maxMembers,
      createdAt: league.createdAt,
      // O título do desafio é o nome da sala, e não um segundo nome a inventar:
      // quem cria deu um nome só, e pedir outro seria pedir duas vezes a mesma
      // coisa. `challenges.service` já resolve `description ?? name`.
      activeChallenge: nasceComDesafio
        ? {
            id: league.id,
            roomId: league.id,
            title: league.name,
            metric: 'minutes',
            metricUnit: 'min',
            participationMode: comModo.participationMode,
            status: 'active',
            startsAt: league.startDate,
            endsAt: league.endDate,
            serverTime: agora,
            participantCount: 1,
            leader: null,
            me: { rank: null, metricValue: 0 },
          }
        : null,
      myMembership: { role: 'owner', displayName: dto.display_name },
    };
  }

  async createPost(
    roomId: string,
    userId: string,
    rawCaption?: string,
    photo?: Express.Multer.File,
  ) {
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId: roomId, userId } },
    });
    if (!membership) throw new ForbiddenException('You are not a room member');

    const caption = rawCaption?.trim() || null;
    if (!photo && !caption) {
      throw new BadRequestException('A photo or caption is required');
    }
    if (photo && !photo.mimetype.startsWith('image/')) {
      throw new BadRequestException('Photo must be an image');
    }

    const postId = randomUUID();
    const photoUrl = photo
      ? await this.storageService.uploadPublic(
          `room-posts/${roomId}/${userId}/${postId}`,
          photo.buffer,
          photo.mimetype,
        )
      : null;
    const post = await this.prisma.feedPost.create({
      data: {
        id: postId,
        leagueId: roomId,
        userId,
        sessionId: null,
        caption,
        photoUrl,
      },
    });

    return {
      id: post.id,
      roomId: post.leagueId,
      kind: 'standalone',
      caption: post.caption,
      photoUrl: post.photoUrl,
      createdAt: post.createdAt,
    };
  }

  async listForUser(userId: string) {
    const now = new Date();
    const memberships = await this.prisma.leagueMember.findMany({
      where: { userId },
      include: {
        league: {
          include: {
            members: {
              select: { userId: true, totalSp: true },
              orderBy: { totalSp: 'desc' },
            },
            feedPosts: {
              select: { createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return Promise.all(memberships.map(async (membership) => {
      const { league } = membership;
      const challengeIsActive =
        league.startDate.getTime() <= now.getTime() &&
        league.endDate.getTime() > now.getTime();
      const leaderboard = challengeIsActive
        ? await this.challengesService.leaderboard(league.id, userId, 1, 1)
        : null;

      return {
        id: league.id,
        name: league.name,
        memberCount: league.members.length,
        totalSp: membership.totalSp,
        lastPostAt: league.feedPosts[0]?.createdAt ?? null,
        myMembership: {
          role: membership.role,
          displayName: membership.displayName,
        },
        activeChallenge: challengeIsActive
          ? {
              id: league.id,
              roomId: league.id,
              title: league.description ?? league.name,
              metric: 'minutes',
              metricUnit: 'min',
              participationMode: league.participationMode,
              status: 'active',
              startsAt: league.startDate,
              endsAt: league.endDate,
              serverTime: now,
              remainingSeconds: Math.max(
                0,
                Math.floor((league.endDate.getTime() - now.getTime()) / 1000),
              ),
              participantCount: league.members.length,
              me: {
                rank: leaderboard?.me?.rank ?? null,
                metricValue: leaderboard?.me?.metricValue ?? 0,
              },
            }
          : null,
      };
    }));
  }
}
