import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChatService } from './chat.service';

/**
 * Prazo padrão, em dias, entre apagar uma mensagem e o conteúdo dela sumir.
 *
 * Noventa dias é o compromisso: tempo de sobra para alguém denunciar um abuso e
 * a moderação apurar, e curto o bastante para não virar um arquivo permanente
 * de texto de usuário — que é exatamente o que a LGPD obriga a justificar.
 *
 * Ajustável por `CHAT_RETENTION_DAYS` sem deploy de código, porque este é o
 * número que muda quando a política jurídica muda, e não a lógica em volta dele.
 */
const DIAS_PADRAO = 90;

/**
 * Apaga o **conteúdo** de mensagens já apagadas que venceram o prazo.
 *
 * Vive separado do `ChatService` pela mesma razão que o `SessionsSweeper`: o
 * serviço continua uma classe simples, testável direto, e o teste chama
 * `purgarConteudoVencido()` com o relógio injetado sem levantar o agendador.
 *
 * ## Rodando mais de uma instância
 *
 * Não há trava distribuída, e não precisa: o `updateMany` filtra por
 * `purgedAt: null`, então duas instâncias varrendo o mesmo minuto disputam as
 * mesmas linhas e o banco resolve — a segunda encontra zero para atualizar. O
 * pior caso é leitura duplicada num tique, não conteúdo expurgado duas vezes.
 *
 * `CHAT_RETENTION_SWEEPER_ENABLED=false` desliga a varredura nesta instância.
 */
@Injectable()
export class ChatRetentionSweeper {
  private readonly logger = new Logger(ChatRetentionSweeper.name);
  private readonly enabled: boolean;
  private readonly dias: number;
  /** Impede que uma varredura lenta encontre o próprio tique seguinte. */
  private running = false;

  constructor(private readonly chat: ChatService) {
    this.enabled = process.env.CHAT_RETENTION_SWEEPER_ENABLED !== 'false';

    const configurado = Number.parseInt(process.env.CHAT_RETENTION_DAYS ?? '', 10);
    // Um valor inválido cai no padrão em vez de virar `NaN`: `NaN` no cálculo
    // da data produziria um limite inválido, e o `updateMany` não casaria nada
    // — a retenção pareceria funcionar enquanto nunca expurgava.
    this.dias = Number.isFinite(configurado) && configurado > 0 ? configurado : DIAS_PADRAO;

    if (!this.enabled) {
      this.logger.warn('Expurgo de chat desligado por CHAT_RETENTION_SWEEPER_ENABLED=false');
    }
  }

  /**
   * Uma vez por dia. O prazo é medido em dias, então varrer de hora em hora só
   * multiplicaria a consulta para antecipar o expurgo em minutos.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM, { name: 'purge-chat-content' })
  async handleCron(): Promise<void> {
    if (!this.enabled || this.running) return;

    this.running = true;
    try {
      const { purgadas } = await this.chat.purgarConteudoVencido(this.dias);
      if (purgadas > 0) {
        // Registrar o número importa: é o que prova que a política de retenção
        // está de fato rodando, se um dia alguém perguntar.
        this.logger.log(
          `Expurgado o conteúdo de ${purgadas} mensagem(ns) apagada(s) há mais de ${this.dias} dias`,
        );
      }
    } catch (err) {
      // Um tique do agendador nunca derruba o processo.
      this.logger.error(
        `Expurgo de chat falhou: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      this.running = false;
    }
  }
}
