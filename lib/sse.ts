type SSEController = ReadableStreamDefaultController<Uint8Array>;

const globalForSSE = globalThis as unknown as { sseClients?: Set<SSEController> };
if (!globalForSSE.sseClients) {
  globalForSSE.sseClients = new Set<SSEController>();
}

export const sseClients: Set<SSEController> = globalForSSE.sseClients;

export function addSSEClient(controller: SSEController) {
  sseClients.add(controller);
}

export function removeSSEClient(controller: SSEController) {
  sseClients.delete(controller);
}

export function notifyRefresh() {
  const encoder = new TextEncoder();
  const message = encoder.encode('data: refresh\n\n');

  sseClients.forEach((controller) => {
    try {
      controller.enqueue(message);
    } catch {
      sseClients.delete(controller);
    }
  });
}
