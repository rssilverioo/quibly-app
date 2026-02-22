import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private knownProfiles = new Set<string>();

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.split('Bearer ')[1];

    try {
      const decodedToken = await this.firebaseService
        .getAuth()
        .verifyIdToken(token);

      const userId = decodedToken.uid;
      const email = decodedToken.email || '';

      // Auto-create profile if it doesn't exist yet (cached to avoid DB hit on every request)
      if (!this.knownProfiles.has(userId)) {
        await this.prisma.profile.upsert({
          where: { id: userId },
          update: {},
          create: {
            id: userId,
            email,
            username: decodedToken.name || email.split('@')[0] || 'user',
            handle: (decodedToken.name || email.split('@')[0] || 'user')
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '_')
              .slice(0, 30),
          },
        });
        this.knownProfiles.add(userId);
      }

      request.user = { userId, email };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired Firebase token');
    }
  }
}
