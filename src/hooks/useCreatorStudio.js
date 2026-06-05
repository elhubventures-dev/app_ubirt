import { dataProvider } from "@/api/dataProvider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useCreatorStudio() {
  const queryClient = useQueryClient();
  const statsQuery = useQuery({
    queryKey: ["creator-stats"],
    queryFn: dataProvider.getCreatorStats,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ payload, file }) => dataProvider.saveUpload(payload, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-stats"] });
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
    },
  });

  const uploadsQuery = useQuery({
    queryKey: ["uploads"],
    queryFn: dataProvider.getUploads,
  });

  const deleteUploadMutation = useMutation({
    mutationFn: (uploadId) => dataProvider.deleteUpload(uploadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["creator-stats"] });
    },
  });

  const updateUploadMutation = useMutation({
    mutationFn: ({ uploadId, patch }) => dataProvider.updateUpload(uploadId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
  const publishUploadMutation = useMutation({
    mutationFn: async (uploadId) => {
      const result = await dataProvider.publishUpload(uploadId);
      if (dataProvider.createPostFromUpload) {
        await dataProvider.createPostFromUpload(uploadId);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  return {
    ...statsQuery,
    uploads: uploadsQuery.data ?? [],
    isLoadingUploads: uploadsQuery.isLoading,
    saveUpload: uploadMutation.mutateAsync,
    updateUpload: updateUploadMutation.mutateAsync,
    deleteUpload: deleteUploadMutation.mutateAsync,
    publishUpload: publishUploadMutation.mutateAsync,
    isSavingUpload: uploadMutation.isPending,
    isUpdatingUpload: updateUploadMutation.isPending,
    isDeletingUpload: deleteUploadMutation.isPending,
    isPublishingUpload: publishUploadMutation.isPending,
  };
}
