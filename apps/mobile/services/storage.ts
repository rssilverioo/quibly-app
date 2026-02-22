import { api } from '../lib/api';
import { Platform } from 'react-native';

export async function uploadProofPhoto(
  _userId: string,
  _sessionId: string,
  photoUri: string,
  _checkIndex: number,
  proofCheckId: string
): Promise<string> {
  const formData = new FormData();
  const filename = `proof_${Date.now()}.jpg`;
  formData.append('photo', {
    uri: Platform.OS === 'ios' ? photoUri.replace('file://', '') : photoUri,
    type: 'image/jpeg',
    name: filename,
  } as any);

  const result = await api.upload<any>(
    `/proof-checks/${proofCheckId}/submit`,
    formData
  );
  return result.photoUrl || '';
}

export async function uploadAvatar(
  _userId: string,
  photoUri: string
): Promise<string> {
  const formData = new FormData();
  const filename = `avatar_${Date.now()}.jpg`;
  formData.append('file', {
    uri: Platform.OS === 'ios' ? photoUri.replace('file://', '') : photoUri,
    type: 'image/jpeg',
    name: filename,
  } as any);

  const result = await api.upload<any>('/users/me/avatar', formData);
  return result.avatarUrl || result.avatar_url || '';
}
