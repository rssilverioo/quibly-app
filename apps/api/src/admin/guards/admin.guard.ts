import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  private adminIds: Set<string>;

  constructor(private readonly configService: ConfigService) {
    const ids = this.configService.get<string>('ADMIN_USER_IDS', '');
    this.adminIds = new Set(ids.split(',').map((id) => id.trim()).filter(Boolean));
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId || !this.adminIds.has(userId)) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
