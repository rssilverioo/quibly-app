import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }

  async createProfile(
    userId: string,
    email: string,
    username: string,
    handle: string,
  ) {
    return this.prisma.profile.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email,
        username,
        handle,
      },
    });
  }
}
