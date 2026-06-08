const DB_NAME = "ubirt-offline";
const STORE = "upload-queue";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(store, mode) {
  return openDb().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const objectStore = transaction.objectStore(STORE);
      transaction.oncomplete = () => resolve(objectStore);
      transaction.onerror = () => reject(transaction.error);
    });
  });
}

export async function enqueueOfflineUpload({ payload, file }) {
  const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry = {
    id,
    payload,
    fileName: file?.name || "upload.jpg",
    fileType: file?.type || "image/jpeg",
    fileBlob: file,
    createdAt: new Date().toISOString(),
  };

  const db = await openDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(entry);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  return id;
}

export async function listOfflineUploads() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

export async function removeOfflineUpload(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export function isLikelyNetworkError(error) {
  if (!error) return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = String(error.message || error).toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("failed to fetch") ||
    msg.includes("timeout") ||
    msg.includes("offline")
  );
}
