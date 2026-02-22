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
      const serviceAccount = JSON.parse(serviceAccountJson);
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
