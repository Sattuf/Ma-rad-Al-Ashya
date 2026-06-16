import useSWR from 'swr';
import { identityApi } from '@/lib/api/identity';

export function useKycStatus() {
  const { data, error, mutate, isLoading } = useSWR(
    '/identity/kyc/status',
    identityApi.getKycStatus,
    {
      refreshInterval: (latestData) => {
        const status = latestData?.status;
        if (status === 'session_created' || status === 'processing' || status === 'pending') {
          return 10000; // Poll every 10 seconds
        }
        return 0;
      },
    }
  );

  return {
    status: data?.status || 'unverified',
    data,
    error,
    isLoading,
    mutate,
  };
}
