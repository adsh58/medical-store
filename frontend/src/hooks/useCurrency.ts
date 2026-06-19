import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

export function useCurrency() {
  const { data: settingsData } = useQuery<any>({
    queryKey: ["system-settings"],
    queryFn: () => apiClient.get("/settings").then(res => res.data),
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });

  const currencySymbol = settingsData?.currency || "$";

  const formatCurrency = (value: number | string) => {
    const val = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(val)) return `${currencySymbol}0.00`;
    return `${currencySymbol}${val.toFixed(2)}`;
  };

  return {
    currencySymbol,
    formatCurrency,
  };
}
