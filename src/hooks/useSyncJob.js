import { useQuery } from '@tanstack/react-query'
import { getJob } from '@/api/jobs'

const TERMINAL = ['success', 'failed']

export function useSyncJob(jobId) {
  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (!status || TERMINAL.includes(status)) return false
      return 2500
    },
    refetchIntervalInBackground: false,
  })

  const isRunning = !!jobId && !TERMINAL.includes(job?.status)

  return { job, isLoading, isRunning }
}
