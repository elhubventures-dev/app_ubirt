import { dataProvider } from "@/api/dataProvider";
import { useQuery } from "@tanstack/react-query";

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: dataProvider.getNotifications,
  });
}
