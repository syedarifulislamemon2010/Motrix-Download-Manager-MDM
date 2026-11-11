import type { CountryRef } from './geoip'

/**
 * A single HTTP(S) or FTP download server / mirror connected to a task.
 * Translated from aria2's `aria2.getServers` response.
 *
 * Country information is enriched by the shared task-servers query handler
 * when the GeoIP service is enabled.
 */
export interface TaskServer {
  /** Stable unique identifier composed as `${ip}:${port}:${currentUri}` */
  id: string
  /** Original URI requested */
  uri: string
  /** Current active connection URI */
  currentUri: string
  /** Current download speed from this server (bytes/sec) */
  downloadSpeed: number
  /** Server IP address */
  ip: string
  /** Server port number */
  port: number
  /**
   * Resolved country, populated by the query handler when GeoIP is enabled
   * and the lookup succeeds. Null when GeoIP lookup missed.
   */
  country?: CountryRef | null
  /**
   * Measured or estimated connection latency in milliseconds.
   */
  latencyMs?: number | null
}
