import * as SecureStore from "expo-secure-store";
import type { AuthSession } from "@/contracts/auth";

const META_KEY = "pragmabiz.mobile.session.meta";
const CHUNK_KEY_PREFIX = "pragmabiz.mobile.session.chunk.";
const CHUNK_SIZE = 1800;

type SessionMeta = {
  chunks: number;
};

const deleteChunks = async (count: number) => {
  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(`${CHUNK_KEY_PREFIX}${index}`)
    )
  );
};

export const saveSession = async (session: AuthSession) => {
  const previousMetaText = await SecureStore.getItemAsync(META_KEY);
  if (previousMetaText) {
    try {
      const previousMeta = JSON.parse(previousMetaText) as SessionMeta;
      await deleteChunks(previousMeta.chunks);
    } catch {
      await deleteChunks(8);
    }
  }

  const serialized = JSON.stringify(session);
  const chunks = Math.ceil(serialized.length / CHUNK_SIZE);
  await Promise.all(
    Array.from({ length: chunks }, (_, index) =>
      SecureStore.setItemAsync(
        `${CHUNK_KEY_PREFIX}${index}`,
        serialized.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE)
      )
    )
  );
  await SecureStore.setItemAsync(META_KEY, JSON.stringify({ chunks }));
};

export const loadSession = async (): Promise<AuthSession | null> => {
  const metaText = await SecureStore.getItemAsync(META_KEY);
  if (!metaText) return null;

  try {
    const meta = JSON.parse(metaText) as SessionMeta;
    const chunks = await Promise.all(
      Array.from({ length: meta.chunks }, (_, index) =>
        SecureStore.getItemAsync(`${CHUNK_KEY_PREFIX}${index}`)
      )
    );
    if (chunks.some((chunk) => !chunk)) return null;
    return JSON.parse(chunks.join("")) as AuthSession;
  } catch {
    return null;
  }
};

export const clearSession = async () => {
  const metaText = await SecureStore.getItemAsync(META_KEY);
  if (metaText) {
    try {
      const meta = JSON.parse(metaText) as SessionMeta;
      await deleteChunks(meta.chunks);
    } catch {
      await deleteChunks(8);
    }
  }
  await SecureStore.deleteItemAsync(META_KEY);
};
