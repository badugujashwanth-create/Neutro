// Browser shim for libraries that conditionally probe Node worker_threads.
// rrweb's bundled helper imports this path in dev, but browser execution never
// needs these Node APIs.
export class Worker {
  constructor() {
    throw new Error('worker_threads.Worker is not available in the browser')
  }
}

const workerThreadsShim = { Worker }

export default workerThreadsShim
