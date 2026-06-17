const globalForSSE = global as any;
if (!globalForSSE.sseClients) {
  globalForSSE.sseClients = new Set();
}

export const sseClients = globalForSSE.sseClients;

export function addSSEClient(controller: any) {
  sseClients.add(controller);
}

export function removeSSEClient(controller: any) {
  sseClients.delete(controller);
}

export function notifyRefresh() {
  const encoder = new TextEncoder();
  const message = encoder.encode('data: refresh\n\n');
  
  sseClients.forEach((controller: any) => {
    try {
      controller.enqueue(message);
    } catch (error) {
      sseClients.delete(controller);
    }
  });
}
