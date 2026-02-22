import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

function serializeProfile<T extends { verifiedHours: any }>(profile: T) {
  return { ...profile, verifiedHours: Number(profile.verifiedHours) };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
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

  async getProfileByHandle(handle: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { handle },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return serializeProfile(profile);
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
}
