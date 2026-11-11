import { usePolledQuery } from '@renderer/hooks/use-polled-query'
import { Queries } from '@shared/protocol/queries'
import type { TaskServer } from '@shared/types/server'

const EMPTY_SERVERS: TaskServer[] = []

export function useTaskServers(taskId: string | null, enabled = true) {
  const servers = usePolledQuery<TaskServer[]>(
    Queries.GetTaskServers,
    taskId,
    taskId !== null ? { taskId } : null,
    { initial: EMPTY_SERVERS, enabled }
  )
  return { servers: servers ?? EMPTY_SERVERS }
}
