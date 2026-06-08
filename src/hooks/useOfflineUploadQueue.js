import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";
import { listOfflineUploads, removeOfflineUpload } from "@/lib/offlineUploadQueue";
import { useToast } from "@/components/ui/use-toast";

/** Flush queued uploads when the device comes back online. */
export function useOfflineUploadQueue() {
  const processing = useRef(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const flush = async () => {
      if (processing.current || !navigator.onLine) return;
      processing.current = true;
      try {
        const queue = await listOfflineUploads();
        if (!queue.length) return;

        let uploaded = 0;
        for (const item of queue.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
          const file = item.fileBlob instanceof Blob
            ? new File([item.fileBlob], item.fileName, { type: item.fileType })
            : null;
          if (!file) {
            await removeOfflineUpload(item.id);
            continue;
          }
          await dataProvider.saveUpload({ payload: item.payload, file });
          await removeOfflineUpload(item.id);
          uploaded += 1;
        }

        if (uploaded > 0) {
          queryClient.invalidateQueries({ queryKey: ["uploads"] });
          queryClient.invalidateQueries({ queryKey: ["creator-stats"] });
          toast({
            title: "Offline uploads synced",
            description: `${uploaded} draft${uploaded === 1 ? "" : "s"} uploaded.`,
          });
        }
      } catch (error) {
        console.warn("Offline upload sync failed:", error);
      } finally {
        processing.current = false;
      }
    };

    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [queryClient, toast]);
}
