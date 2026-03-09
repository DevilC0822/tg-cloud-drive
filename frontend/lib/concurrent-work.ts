export async function runConcurrentWork(
  workerCount: number,
  workSize: number,
  worker: (index: number) => Promise<void>,
) {
  if (workerCount <= 0 || workSize <= 0) {
    return
  }

  let nextIndex = 0
  const runWorker = async () => {
    while (nextIndex < workSize) {
      const currentIndex = nextIndex
      nextIndex += 1
      await worker(currentIndex)
    }
  }

  const workers = Array.from({ length: Math.min(workerCount, workSize) }, () => runWorker())
  await Promise.all(workers)
}
