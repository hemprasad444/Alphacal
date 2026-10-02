// Progress photos in Firebase Storage, private to their owner. Download URLs are cached
// for the session so the grid doesn't refetch them.
import { deleteObject, getDownloadURL, ref, uploadString } from 'firebase/storage';
import { fb } from './firebase';

const urls = new Map<string, Promise<string>>();

export async function uploadPhoto(path: string, jpegBase64: string): Promise<void> {
  await uploadString(ref(fb().storage, path), jpegBase64, 'base64', { contentType: 'image/jpeg' });
}

/** A URL the image component can load: the file itself in demo mode, else Storage's. */
export function photoUrl(path: string): Promise<string> {
  if (!path.startsWith('users/')) return Promise.resolve(path);
  let u = urls.get(path);
  if (!u) {
    u = getDownloadURL(ref(fb().storage, path));
    urls.set(path, u);
    u.catch(() => urls.delete(path));
  }
  return u;
}

export async function deletePhotoFile(path: string): Promise<void> {
  if (!path.startsWith('users/')) return;
  urls.delete(path);
  await deleteObject(ref(fb().storage, path)).catch(e => console.warn('REI: photo delete failed', e));
}
