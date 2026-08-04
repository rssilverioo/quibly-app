import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Sem `UseGuards`: a rota é pública de propósito. A autenticação nesta API é
 * por controller (o guard global é só o de throttling), então não declarar
 * guard aqui é o que a mantém alcançável sem credencial — que é o ponto dela.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
