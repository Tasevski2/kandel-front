import { useQueryClient } from '@tanstack/react-query';

// simple hook for invalidating stale data from cache
// not production ready, but useful for dev
export function useInvalidateQueries() {
  const qc = useQueryClient();

  const invalidateQueriesByScopeKey = async (
    scopeKey: string,
    multi: boolean = false
  ) => {
    await qc.invalidateQueries({
      queryKey: [multi ? 'readContracts' : 'readContract', { scopeKey }],
    });
  };

  return {
    invalidateQueriesByScopeKey,
  };
}
