import { useEffect, useRef, useCallback } from 'react'
import type { WSMessage } from '@/types'

type MessageHandler = (message: WSMessage) => void

interface UseScanWebSocketOptions {
  jobId: string
  onMessage?: MessageHandler
  onProgress?: MessageHandler
  onLog?: MessageHandler
  onStatus?: MessageHandler
  enabled?: boolean
}

export function useScanWebSocket({
  jobId,
  onMessage,
  onProgress,
  onLog,
  onStatus,
  enabled = true,
}: UseScanWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | undefined>(undefined)
  const handlersRef = useRef({ onMessage, onProgress, onLog, onStatus })
  handlersRef.current = { onMessage, onProgress, onLog, onStatus }

  const connect = useCallback(() => {
    if (!enabled || !jobId) return

    const token = localStorage.getItem('access_token')
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/api/v1/scans/${jobId}/ws?token=${token}`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.debug('WebSocket connected:', jobId)
      }

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data)
          handlersRef.current.onMessage?.(message)
          if (message.type === 'progress') handlersRef.current.onProgress?.(message)
          if (message.type === 'log') handlersRef.current.onLog?.(message)
          if (message.type === 'status') handlersRef.current.onStatus?.(message)
        } catch {
          // ignore parse errors
        }
      }

      ws.onclose = () => {
        wsRef.current = null
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect()
        }, 3000)
      }

      ws.onerror = () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
      }
    } catch {
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect()
      }, 5000)
    }
  }, [jobId, enabled])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close()
        }
        wsRef.current = null
      }
    }
  }, [connect])
}