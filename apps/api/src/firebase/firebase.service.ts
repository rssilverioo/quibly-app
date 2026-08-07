import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app: admin.app.App;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const serviceAccountJson = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_JSON',
    );

    if (serviceAccountJson) {
      const serviceAccount = this.lerContaDeServico(serviceAccountJson);
      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: this.configService.get<string>(
          'FIREBASE_STORAGE_BUCKET',
        ),
      });
    } else {
      this.app = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        storageBucket: this.configService.get<string>(
          'FIREBASE_STORAGE_BUCKET',
        ),
      });
    }
  }

  /**
   * O JSON da conta de serviço, com as duas formas que os painéis produzem.
   *
   * Um `JSON.parse` cru aqui derrubou um deploy inteiro com
   * `SyntaxError: Expected property name or '}' in JSON at position 1` — uma
   * mensagem que não nomeia a variável, não diz de onde veio e aponta para o
   * `on-module-init.hook` do Nest na pilha. Custou horas para ser lida como "o
   * valor de `FIREBASE_SERVICE_ACCOUNT_JSON` está escapado".
   *
   * **A forma escapada é aceita de propósito.** `{\"type\":...` é o que sai de
   * um campo de painel que passou o valor por uma camada de `stringify`, e é um
   * erro de operação, não de conteúdo: a chave está correta, só chegou vestida.
   * Recusar seria tecnicamente defensável e praticamente inútil — o operador
   * não tem como saber, e o app fica fora do ar.
   */
  private lerContaDeServico(bruto: string): admin.ServiceAccount {
    const texto = bruto.trim();

    const tentativas = [
      texto,
      // Aspas escapadas: desfaz `\"` → `"` e `\\n` → `\n`, nesta ordem — o
      // inverso desfaria o escape das aspas dentro da chave privada.
      texto.replace(/\\"/g, '"').replace(/\\\\n/g, '\\n'),
      // Aspas simples em volta do valor inteiro, que alguns painéis adicionam.
      texto.replace(/^'|'$/g, ''),
    ];

    for (const tentativa of tentativas) {
      try {
        const conta = JSON.parse(tentativa);
        if (conta && typeof conta === 'object' && conta.project_id) return conta;
      } catch {
        // Próxima forma.
      }
    }

    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON não é um JSON válido. Deve ser o arquivo da ' +
        'conta de serviço inteiro, numa linha, com aspas normais (`{"type":...`) e ' +
        'os `\\n` da chave privada preservados como dois caracteres. ' +
        `Recebido: ${texto.slice(0, 40)}…`,
    );
  }

  getAuth(): admin.auth.Auth {
    return this.app.auth();
  }

  getStorage(): admin.storage.Storage {
    return this.app.storage();
  }

  getMessaging(): admin.messaging.Messaging {
    return this.app.messaging();
  }
}
