import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { planoEfetivo, SELECAO_DE_PLANO } from '../common/plano-efetivo';
import { LeaguesService } from '../leagues/leagues.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { ChallengesService } from '../challenges/challenges.service';
import { StorageService } from '../storage/storage.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leaguesService: LeaguesService,
    private readonly challengesService: ChallengesService,
    private readonly storageService: StorageService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * O limite de salas do plano. Deixa passar, ou recusa dizendo o porquê.
   *
   * ## Por que conta dono, e não participação
   *
   * Entrar na sala de outra pessoa não custa nada e nunca deve custar. Contar
   * participação faria o limite punir quem foi convidado — a pessoa é aceita
   * em quatro grupos de estudo e o app trava, sem que ela tenha criado nada.
   * Pior: o convite de um amigo passaria a depender do plano dela.
   *
   * ## Por que a resposta carrega `code`
   *
   * Um 403 com texto é indistinguível de "você não tem permissão" para quem
   * está do outro lado. O app precisa saber que **este** 403 é o paywall, para
   * abrir a tela de assinatura em vez de um alerta de erro — e precisa saber
   * disso sem casar string, que quebra na primeira tradução.
   */
  private async exigirCotaDeSala(userId: string) {
    const perfil = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: SELECAO_DE_PLANO,
    });

    // `planoEfetivo` e não `perfil.plan`: quem cancelou continua PRO gravado
    // até o `EXPIRATION` chegar, e ele pode não chegar. Ver common/plano-efetivo.ts.
    const limite = await this.entitlements.getLimit(planoEfetivo(perfil), 'rooms');
    if (limite === Infinity) return;

    const minhas = await this.prisma.league.count({ where: { ownerId: userId } });
    if (minhas < limite) return;

    throw new ForbiddenException({
      code: 'ROOM_LIMIT_REACHED',
      limit: limite,
      current: minhas,
      message: `The free plan includes ${limite} rooms of your own.`,
    });
  }

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
    await this.exigirCotaDeSala(userId);

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
      // `CreateLeagueDto` já valida 2..100, o mesmo teto do `UpdateRoomDto`.
      // Ausente, `leagues.service` aplica o padrão de 50.
      max_members: dto.max_members,
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
    /*
     A foto é obrigatória — **ela é o check-in**.

     Isto dizia "foto ou legenda", e o app nunca deixou publicar sem foto: duas
     regras para a mesma pergunta, com a mais restritiva vencendo em silêncio.
     Quem tentasse pela API conseguia um post de texto que a tela não sabia
     produzir. Encontrado pelo dono do produto em 10/08, e resolvido para o lado
     da foto por decisão dele.

     O motivo não é estético. `challenges.service.ts` conta **dia com foto**
     como presença na sala. Aceitar post de texto faria a presença ser
     reivindicável digitando uma linha — e aí o número que a sala mostra deixa
     de significar "apareceu e estudou". A foto é a prova barata que sustenta o
     resto do produto.

     A legenda continua opcional: ela acompanha a foto, não a substitui.
    */
    if (!photo) {
      throw new BadRequestException('A photo is required');
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


  /**
   * Só o dono mexe na sala. Devolve a liga quando pode, lança quando não.
   *
   * Confere `ownerId` e não `role: 'owner'` do membro: são duas fontes para a
   * mesma verdade, e a coluna da liga é a que manda — um membro promovido a
   * `admin` não vira dono, e a checagem por papel deixaria essa porta aberta.
   */
  private async exigirDono(roomId: string, userId: string) {
    const league = await this.prisma.league.findUnique({
      where: { id: roomId },
      select: { id: true, ownerId: true, coverUrl: true },
    });

    if (!league) throw new NotFoundException('Room not found');
    if (league.ownerId !== userId) {
      throw new ForbiddenException('Only the room owner can do that');
    }
    return league;
  }

  /**
   * Renomear e redescrever. A data fica de fora de propósito — ver
   * `UpdateRoomDto`.
   */
  async update(userId: string, roomId: string, dto: UpdateRoomDto) {
    await this.exigirDono(roomId, userId);

    /**
     * Encolher a sala abaixo de quem já está dentro é recusado, e não aplicado
     * em silêncio.
     *
     * Ninguém é expulso — expulsar por causa de um número seria a pior leitura
     * possível de "editar sala". Mas aceitar o número deixaria a sala num
     * estado que ela não sabe explicar: 20 pessoas dentro, teto 5, porta
     * fechada para sempre e nenhuma tela dizendo por quê. O erro nomeia a
     * contagem atual, que é a informação de que o dono precisa para escolher.
     */
    if (dto.max_members !== undefined) {
      const dentro = await this.prisma.leagueMember.count({ where: { leagueId: roomId } });
      if (dto.max_members < dentro) {
        throw new BadRequestException(
          `The room already has ${dentro} members. The limit cannot be lower than that.`,
        );
      }
    }

    const league = await this.prisma.league.update({
      where: { id: roomId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.max_members !== undefined ? { maxMembers: dto.max_members } : {}),
      },
      select: { id: true, name: true, description: true, coverUrl: true, maxMembers: true },
    });

    return league;
  }

  /**
   * Troca a capa da sala.
   *
   * A anterior é apagada **depois** de a nova estar gravada e o banco apontar
   * para ela: se a ordem fosse a inversa, uma falha no upload deixaria a sala
   * sem capa nenhuma. Falhar em apagar deixa um objeto órfão, que custa alguns
   * bytes; falhar tendo apagado custa a imagem do usuário.
   */
  async updateCover(
    userId: string,
    roomId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    const league = await this.exigirDono(roomId, userId);

    const extensao = (file.originalname.split('.').pop() ?? 'jpg').toLowerCase();
    const url = await this.storageService.uploadPublic(
      `room-covers/${roomId}/${Date.now()}.${extensao}`,
      file.buffer,
      file.mimetype || 'image/jpeg',
    );

    const atualizada = await this.prisma.league.update({
      where: { id: roomId },
      data: { coverUrl: url },
      select: { id: true, coverUrl: true },
    });

    if (league.coverUrl) {
      const chave = this.storageService.chaveDaUrl(league.coverUrl);
      // Só apaga o que **nós** montamos. `chaveDaUrl` devolve `null` para URL de
      // terceiro, e apagar às cegas ali miraria uma chave que não é nossa.
      if (chave) await this.storageService.deleteObject(chave).catch(() => {});
    }

    return atualizada;
  }

  /**
   * Apaga a sala inteira.
   *
   * É o caminho oficial para "errei a data": a janela do desafio não é
   * editável, então quem precisa de outra recria. Por isso o destrutivo existe
   * — sem ele, um erro de data seria permanente.
   *
   * O `onDelete: Cascade` do schema leva membros, posts e mensagens junto. A
   * capa é apagada aqui porque o storage não participa do cascade do banco.
   */
  async remove(userId: string, roomId: string) {
    const league = await this.exigirDono(roomId, userId);

    if (league.coverUrl) {
      const chave = this.storageService.chaveDaUrl(league.coverUrl);
      if (chave) await this.storageService.deleteObject(chave).catch(() => {});
    }

    await this.prisma.league.delete({ where: { id: roomId } });
    return { deleted: true };
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
        // `null` aqui não é ausência de dado: é o app caindo no desenho gerado
        // a partir do id, que é o padrão bom. Toda sala mostrava o coelho porque
        // esta coluna não existia até 07/08.
        coverUrl: league.coverUrl,
        memberCount: league.members.length,
        // O teto vem junto da contagem porque as duas só significam alguma
        // coisa lado a lado: "7" não diz nada, "7 de 50" diz.
        maxMembers: league.maxMembers,
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
              metric: 'days',
              // Token, como o `leaderboard` já devolve — o cliente traduz.
              metricUnit: 'days',
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
              /**
               * O líder **nunca foi preenchido**.
               *
               * O campo existe no contrato desde sempre e chegava `null`: o
               * `leaderboard` era buscado, e só o `me` era lido dele. Na tela
               * isso virava um avatar "?" com zero ao lado — inclusive quando
               * quem olhava era o próprio líder, com seis dias logo à direita.
               *
               * `entries[0]` porque o serviço já devolve ordenado e a busca é
               * `limit: 1`. Lista vazia continua `null`, que é o certo: desafio
               * sem ninguém pontuando não tem líder, e inventar um zerado seria
               * pior que não ter.
               */
              leader: leaderboard?.entries?.[0]
                ? {
                    displayName: leaderboard.entries[0].displayName,
                    metricValue: leaderboard.entries[0].metricValue,
                    avatarUrl: leaderboard.entries[0].avatarUrl,
                    plan: leaderboard.entries[0].plan,
                  }
                : null,
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
