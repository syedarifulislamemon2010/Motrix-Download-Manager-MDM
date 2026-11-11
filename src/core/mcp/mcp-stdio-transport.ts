import readline from 'node:readline'
import type { Readable, Writable } from 'node:stream'
import type { McpServer } from './mcp-server'

export class McpStdioTransport {
  private rl: readline.Interface | null = null

  constructor(
    private readonly server: McpServer,
    private readonly input: Readable = process.stdin,
    private readonly output: Writable = process.stdout
  ) {}

  start(): void {
    if (this.rl) return

    this.rl = readline.createInterface({
      input: this.input,
      terminal: false,
    })

    this.rl.on('line', (line) => {
      const trimmed = line.trim()
      if (!trimmed) return

      try {
        const parsed = JSON.parse(trimmed)
        void this.handleMessage(parsed)
      } catch {
        // Send JSON-RPC ParseError
        this.send({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error',
          },
        })
      }
    })
  }

  stop(): void {
    if (this.rl) {
      this.rl.close()
      this.rl = null
    }
  }

  private async handleMessage(message: unknown): Promise<void> {
    const response = await this.server.handleMessage(message)
    if (response) {
      this.send(response)
    }
  }

  private send(data: unknown): void {
    const json = JSON.stringify(data)
    this.output.write(`${json}\n`)
  }
}
