import { ForbiddenException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';

/**
 * O broadcast manda push para todo mundo. Com a chave ausente no ambiente,
 * a rota recusa — antes ela aceitava um padrão que estava no repositório
 * público.
 */
describe('POST /notifications/broadcast — chave', () => {
  const service = { broadcastToSegment: jest.fn().mockResolvedValue({ sent: 0 }) };
  const controller = (env: Record<string, string>) =>
    new NotificationsController(
      service as any,
      { get: (k: string, d = '') => env[k] ?? d } as any,
    );
  const corpo = { title: 't', body: 'b' };

  it('sem NOTIFICATION_API_KEY no ambiente, recusa até a antiga chave padrão', () => {
    expect(() => controller({}).broadcast('quibly-notify-secret', corpo)).toThrow(ForbiddenException);
    expect(service.broadcastToSegment).not.toHaveBeenCalled();
  });

  it('chave errada recusa', () => {
    expect(() => controller({ NOTIFICATION_API_KEY: 'certa' }).broadcast('errada', corpo)).toThrow(ForbiddenException);
  });

  it('chave certa passa', async () => {
    await controller({ NOTIFICATION_API_KEY: 'certa' }).broadcast('certa', corpo);
    expect(service.broadcastToSegment).toHaveBeenCalledWith('t', 'b', 'all');
  });
});
