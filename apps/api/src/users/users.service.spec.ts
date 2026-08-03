import { UsersService } from './users.service';
import { StorageService } from '../storage/storage.service';

const ENDPOINT = 'https://t3.storage.dev';

function makePrismaMock() {
  return {
    profile: {
      findUnique: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
}

function makeFirebaseMock() {
  const deleteUser = jest.fn().mockResolvedValue(undefined);
  return { getAuth: () => ({ deleteUser }), deleteUser };
}

/**
 * O storage real, com o S3 trocado por espião. Vale mais que um mock de dois
 * métodos: o defeito que estes testes travam morava justamente na costura
 * entre a URL que o `uploadPublic` monta e a chave que o `deleteObject`
 * espera. Um mock de `chaveDaUrl` faria essa costura passar por decreto.
 */
function makeStorage() {
  const storage = new StorageService({
    get: (chave: string, padrao?: string) =>
      ({
        S3_ENDPOINT: ENDPOINT,
        S3_BUCKET: 'nomads-uploads',
        S3_BUCKET_PUBLIC: 'nomads-public',
        S3_BUCKET_PRIVATE: 'nomads-uploads',
      })[chave] ?? padrao,
  } as any);
  storage.onModuleInit();
  (storage as any).s3 = { send: jest.fn() };

  jest.spyOn(storage, 'deleteObject');
  return storage;
}

describe('UsersService.deleteUser', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let firebase: ReturnType<typeof makeFirebaseMock>;
  let storage: StorageService;
  let service: UsersService;

  beforeEach(() => {
    prisma = makePrismaMock();
    firebase = makeFirebaseMock();
    storage = makeStorage();
    service = new UsersService(prisma as any, storage, firebase as any);
  });

  it('apaga o avatar na chave real, com extensão', async () => {
    prisma.profile.findUnique.mockResolvedValue({
      avatarUrl: `${ENDPOINT}/nomads-public/avatars/user-1/avatar.png`,
    });

    await service.deleteUser('user-1');

    // A chave é `avatars/user-1/avatar.png`, e não `avatars/user-1`: o
    // segundo nunca existiu como objeto, e por isso a exclusão de conta
    // deixava o avatar de pé — legível por qualquer um assim que o bucket
    // público entrasse no ar.
    expect(storage.deleteObject).toHaveBeenCalledWith('avatars/user-1/avatar.png');
  });

  it('lê o perfil antes de apagá-lo', async () => {
    prisma.profile.findUnique.mockResolvedValue({
      avatarUrl: `${ENDPOINT}/nomads-public/avatars/user-1/avatar.jpg`,
    });

    await service.deleteUser('user-1');

    // Invertida a ordem, `avatarUrl` já não existe e o arquivo perde o
    // endereço para sempre.
    const ordemDeLeitura = prisma.profile.findUnique.mock.invocationCallOrder[0];
    const ordemDeExclusao = prisma.profile.delete.mock.invocationCallOrder[0];
    expect(ordemDeLeitura).toBeLessThan(ordemDeExclusao);
  });

  it('não tenta apagar avatar que não é nosso', async () => {
    prisma.profile.findUnique.mockResolvedValue({
      avatarUrl: 'https://lh3.googleusercontent.com/a/foto-do-login-social',
    });

    await service.deleteUser('user-1');

    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('segue em frente quando não há perfil nem avatar', async () => {
    prisma.profile.findUnique.mockResolvedValue(null);

    await expect(service.deleteUser('user-1')).resolves.toEqual({ deleted: true });

    expect(storage.deleteObject).not.toHaveBeenCalled();
    // O usuário do Firebase tem que sumir mesmo assim — senão sobra uma conta
    // que consegue autenticar e não tem perfil nenhum do outro lado.
    expect(firebase.deleteUser).toHaveBeenCalledWith('user-1');
  });

  it('falha do storage não impede a exclusão no Firebase', async () => {
    prisma.profile.findUnique.mockResolvedValue({
      avatarUrl: `${ENDPOINT}/nomads-public/avatars/user-1/avatar.png`,
    });
    (storage.deleteObject as jest.Mock).mockRejectedValueOnce(new ErroDeStorage());

    await expect(service.deleteUser('user-1')).resolves.toEqual({ deleted: true });
    expect(firebase.deleteUser).toHaveBeenCalledWith('user-1');
  });
});

/** Erro qualquer, só para o caso de falha do storage. */
class ErroDeStorage extends Error {
  constructor() {
    super('storage fora do ar');
  }
}
