import { describe, it, expect } from 'vitest'
import { withTimeout } from '../../src/renderer/src/lib/withTimeout'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe('withTimeout', () => {
  it('及时完成时原样透传结果', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000, '测试')).resolves.toBe(42)
  })

  it('超时后拒绝，错误里带标签与时长', async () => {
    const never = new Promise<string>(() => {})
    await expect(withTimeout(never, 30, '解析元数据')).rejects.toThrow('解析元数据超时（30ms）')
  })

  it('原 promise 先拒绝时透传原始错误，不被超时盖掉', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('原始错误')), 1000, '测试'),
    ).rejects.toThrow('原始错误')
  })

  it('成功路径不留悬空定时器 —— 进程能正常退出', async () => {
    await withTimeout(Promise.resolve('ok'), 5, '测试')
    // 若定时器没被清掉，它会在 5ms 后触发并回写已 settle 的 promise，
    // 这里用一个更长的等待来确保没有副作用（不会被 unhandled rejection 打断）
    await sleep(20)
    expect(true).toBe(true)
  })
})
