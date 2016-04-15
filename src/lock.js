export default class Lock {
  constructor() {
    this.isLocked = false
    this.queue = []
  }

  lock() {
    if (this.isLocked) {
      return new Promise((resolve) => {
        this.queue.push(resolve)
      })
    } else {
      this.isLocked = true
      return Promise.resolve()
    }
  }

  unlock() {
    const resolveNext = this.queue.shift()

    if (resolveNext) {
      resolveNext()
    } else {
      this.isLocked = false
    }
  }
}
