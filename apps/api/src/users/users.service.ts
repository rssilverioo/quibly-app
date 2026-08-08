import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { FirebaseService } from '../firebase/firebase.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

function serializeProfile<T extends { verifiedHours: any }>(profile: T) {
  return { ...profile, verifiedHours: Number(profile.verifiedHours) };
}

/**
 * O que uma pessoa pode ver de **outra**.
 *
 * ## O vazamento que isto fecha
 *
 * `getProfileByHandle` devolvia `{ ...profile }` — a linha inteira. Como a
 * rota é `GET /users/:handle` e o handle é público por natureza (aparece no
 * feed, no ranking e no chat), qualquer pessoa logada conseguia o **e-mail**
 * de qualquer outra, mais o status da assinatura e a data de renovação.
 *
 * Ninguém tinha reparado porque o app nunca chamou essa rota: ela existia à
 * espera da tela de perfil de outra pessoa. Ou seja, o vazamento estava
 * armado e ia disparar junto com a funcionalidade.
 *
 * ## A regra
 *
 * Lista fechada, nunca `omit`. Com `{ ...profile, email: undefined }` toda
 * coluna nova nasce pública, e quem a acrescenta seis meses depois não tem
 * como saber disso. Aqui, o padrão de uma coluna nova é não vazar.
 *
 * O selo sai daqui de propósito: ele existe **para** ser visto, e um selo que
 * o perfil público não carrega não serve para nada.
 *
 * O que fica de fora e por quê: `email` é contato e não identidade pública;
 * `plan`, `subscriptionStatus`, `currentPeriodEnd` e `subscriptionPlatform`
 * são a vida financeira da pessoa; `educationLevel`, `studyGoal` e
 * `dailyGoalMinutes` são o que ela respondeu no onboarding, para o produto e
 * não para a plateia.
 */
export function serializePublicProfile(profile: {
  id: string;
  username: string;
  handle: string;
  avatarUrl: string | null;
  bio: string | null;
  verification: 'BLUE' | 'GOLD' | null;
  level: number;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  totalStudyMinutes: number;
  verifiedHours: any;
  createdAt: Date;
}) {
  return {
    id: profile.id,
    username: profile.username,
    handle: profile.handle,
    avatar_url: profile.avatarUrl,
    bio: profile.bio,
    verification: profile.verification,
    level: profile.level,
    total_xp: profile.totalXp,
    current_streak: profile.currentStreak,
    longest_streak: profile.longestStreak,
    total_study_minutes: profile.totalStudyMinutes,
    verified_hours: Number(profile.verifiedHours),
    member_since: profile.createdAt,
  };
}

/** As colunas que `serializePublicProfile` precisa, e só elas. */
const CAMPOS_PUBLICOS = {
  id: true,
  username: true,
  handle: true,
  avatarUrl: true,
  bio: true,
  verification: true,
  level: true,
  totalXp: true,
  currentStreak: true,
  longestStreak: true,
  totalStudyMinutes: true,
  verifiedHours: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly firebaseService: FirebaseService,
  ) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return serializeProfile(profile);
  }

  /**
   * O perfil de outra pessoa, pelo @.
   *
   * Devolve só o que é público — ver `serializePublicProfile`. O `select`
   * também evita trazer do banco o que não vai sair daqui: filtrar depois
   * funcionaria igual, e deixaria o e-mail passar pela memória do processo
   * para ser descartado no fim.
   */
  async getProfileByHandle(handle: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { handle },
      select: CAMPOS_PUBLICOS,
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return serializePublicProfile(profile);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    try {
      const profile = await this.prisma.profile.update({
        where: { id: userId },
        data: dto,
      });
      return serializeProfile(profile);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('This handle is already taken.');
      }
      throw new NotFoundException('Profile not found');
    }
  }

  async updateAvatar(userId: string, file: Express.Multer.File) {
    const fileExtension = file.originalname.split('.').pop();
    const filePath = `avatars/${userId}/avatar.${fileExtension}`;

    const avatarUrl = await this.storageService.uploadPublic(
      filePath,
      file.buffer,
      file.mimetype,
    );

    const profile = await this.prisma.profile.update({
      where: { id: userId },
      data: { avatarUrl },
    });
    return serializeProfile(profile);
  }

  async getStats(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: {
        totalXp: true,
        level: true,
        lockInScore: true,
        verifiedHours: true,
        currentStreak: true,
        longestStreak: true,
        totalStudyMinutes: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('User stats not found');
    }

    return {
      ...profile,
      verifiedHours: Number(profile.verifiedHours),
      /**
       * O recorde nunca é menor que a sequência atual.
       *
       * A gravação já foi consertada (`sessions.service`, ramo de reinício), mas
       * as contas que passaram pelo defeito têm `longestStreak: 0` com
       * `currentStreak: 1` no banco, e sem isto continuariam mostrando
       * "atual 1, maior 0" até a próxima sequência. Corrigir na leitura acerta
       * essas linhas hoje, sem migração. `achievements.service` já usa o mesmo
       * `max` pela mesma razão.
       */
      longestStreak: Math.max(profile.longestStreak, profile.currentStreak),
    };
  }

  async searchUsers(query: string) {
    return this.prisma.profile.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { handle: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
    });
  }

  async deleteUser(userId: string) {
    // 0. Ler o avatar ANTES de apagar o perfil — a URL guardada é o único
    //    lugar onde a chave real do objeto existe, e a extensão faz parte
    //    dela (`avatars/<id>/avatar.png`). Com o perfil já apagado, o arquivo
    //    fica sem endereço e sobrevive à exclusão da conta.
    const perfil = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    // 1. Delete profile from database (cascade deletes related data)
    await this.prisma.profile.delete({ where: { id: userId } }).catch(() => {
      // Profile may not exist — continue with cleanup
    });

    // 2. Delete avatar from S3
    //    `chaveDaUrl` devolve null para URL que não é nossa — foto vinda do
    //    login social, por exemplo. Aí não há o que apagar.
    const chaveDoAvatar = perfil?.avatarUrl
      ? this.storageService.chaveDaUrl(perfil.avatarUrl)
      : null;
    if (chaveDoAvatar) {
      try {
        await this.storageService.deleteObject(chaveDoAvatar);
      } catch (err) {
        this.logger.warn(`Failed to delete avatar for user ${userId}: ${err}`);
      }
    }

    // 3. Delete Firebase Auth user
    try {
      await this.firebaseService.getAuth().deleteUser(userId);
    } catch (err) {
      this.logger.warn(`Failed to delete Firebase user ${userId}: ${err}`);
    }

    return { deleted: true };
  }
}
