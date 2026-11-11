import { useIpcEvent } from '@renderer/hooks/use-ipc-event'
import { transport } from '@renderer/lib/transport'
import { Commands } from '@shared/protocol/commands'
import { Events } from '@shared/protocol/events'
import { Queries } from '@shared/protocol/queries'
import {
  type HelperBinaryDetection,
  type HelperBinaryId,
  type HelperBinaryInstallResult,
  type HelperBinaryInstallStatus,
  helperBinaryDetectionSchema,
  helperBinaryInstallResultSchema,
  helperBinaryInstallStatusSchema,
} from '@shared/schemas/helper-binary'
import { useCallback, useEffect, useRef, useState } from 'react'

const busyPhases = new Set(['downloading', 'verifying', 'extracting'])

export function useHelperBinary(id: HelperBinaryId) {
  const [status, setStatus] = useState<HelperBinaryInstallStatus | null>(null)
  const [detection, setDetection] = useState<HelperBinaryDetection | null>(null)
  const [installing, setInstalling] = useState(false)
  const pending = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const statusRes = await transport.invoke(
        Queries.GetHelperBinaryInstallStatus,
        { id }
      )
      setStatus(helperBinaryInstallStatusSchema.parse(statusRes))
    } catch {
      // ignore
    }
    try {
      const detectRes = await transport.invoke(
        Queries.GetHelperBinaryDetection,
        { id }
      )
      setDetection(helperBinaryDetectionSchema.parse(detectRes))
    } catch {
      // ignore
    }
  }, [id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useIpcEvent(Events.HelperBinaryInstallStatusChanged, (payload: unknown) => {
    const parsed = helperBinaryInstallStatusSchema.safeParse(payload)
    if (parsed.success && parsed.data.id === id) {
      setStatus(parsed.data)
      if (parsed.data.phase === 'installed' || parsed.data.phase === 'error') {
        void transport
          .invoke(Queries.GetHelperBinaryDetection, { id })
          .then((res) => {
            setDetection(helperBinaryDetectionSchema.parse(res))
          })
      }
    }
  })

  const install = async (): Promise<HelperBinaryInstallResult | null> => {
    if (pending.current || (status && busyPhases.has(status.phase))) return null
    pending.current = true
    setInstalling(true)
    try {
      const res = await transport.invoke(Commands.InstallHelperBinary, { id })
      const result = helperBinaryInstallResultSchema.parse(res)
      await refresh()
      return result
    } finally {
      pending.current = false
      setInstalling(false)
    }
  }

  return {
    status,
    detection,
    installing: installing || Boolean(status && busyPhases.has(status.phase)),
    install,
    refresh,
  }
}
