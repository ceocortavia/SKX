import readline from 'readline';
import { tools, toolsByName } from './tools';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

const serverInfo = {
  name: 'skx-mcp-server',
  version: '0.1.0',
};

function sendResponse(response: JsonRpcResponse) {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

function sendError(id: number | string | null, code: number, message: string, data?: any) {
  sendResponse({
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  });
}

async function handleCallTool(id: number | string, params: any) {
  const name = params?.name;
  if (typeof name !== 'string' || !name) {
    return sendError(id, -32602, 'Tool name is required');
  }
  const tool = toolsByName.get(name);
  if (!tool) {
    return sendError(id, -32601, `Unknown tool: ${name}`);
  }
  let args: any = params?.arguments ?? {};
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch (error) {
      return sendError(id, -32602, 'Failed to parse arguments JSON', { error: String(error) });
    }
  }
  try {
    const result = await tool.handler(args ?? {});
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'json',
            data: result,
          },
        ],
      },
    });
  } catch (error) {
    sendError(id, -32000, (error as Error)?.message ?? 'Tool execution failed');
  }
}

async function handleRequest(request: JsonRpcRequest) {
  const { id, method, params } = request;
  if (method === 'initialize') {
    sendResponse({
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        capabilities: {
          tools: {},
        },
        serverInfo,
      },
    });
    return;
  }

  if (method === 'ping') {
    sendResponse({ jsonrpc: '2.0', id: id ?? null, result: { ok: true } });
    return;
  }

  if (method === 'list_tools') {
    sendResponse({
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      },
    });
    return;
  }

  if (method === 'call_tool') {
    if (id === undefined || id === null) {
      sendError(null, -32600, 'call_tool requires an id');
      return;
    }
    await handleCallTool(id, params);
    return;
  }

  if (id !== undefined) {
    sendError(id, -32601, `Unknown method: ${method}`);
  }
}

function startServer() {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let message: JsonRpcRequest;
    try {
      message = JSON.parse(trimmed);
    } catch (error) {
      sendError(null, -32700, 'Failed to parse JSON', { input: trimmed });
      return;
    }

    handleRequest(message).catch((err) => {
      const id = message.id ?? null;
      sendError(id, -32000, 'Internal error', { error: (err as Error)?.message });
    });
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

startServer();
