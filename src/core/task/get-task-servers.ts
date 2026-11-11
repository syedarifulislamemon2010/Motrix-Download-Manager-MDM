import type { EngineAdapter } from '@core/engine/engine-adapter'
import type { GeoIPManager } from '@core/geoip/geo-ip-manager'
import type { TaskServer } from '@shared/types/server'

export interface GetTaskServersDeps {
  engineAdapter: Pick<EngineAdapter, 'getTaskServers'>
  taskManager: {
    getById: (id: string) => { engineTaskId: string } | undefined
  }
  geoipManager?: Pick<GeoIPManager, 'isEnabled' | 'lookupCountry'>
}

export interface GetTaskServersPayload {
  taskId: string
}

export function createGetTaskServersHandler(deps: GetTaskServersDeps) {
  return async ({ taskId }: GetTaskServersPayload): Promise<TaskServer[]> => {
    const task = deps.taskManager.getById(taskId)
    if (!task) return []
    const servers = await deps.engineAdapter.getTaskServers(task.engineTaskId)
    if (!deps.geoipManager?.isEnabled()) return servers
    return servers.map((server) => ({
      ...server,
      country: deps.geoipManager?.lookupCountry(server.ip),
    }))
  }
}
