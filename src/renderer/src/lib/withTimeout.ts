/**
 * 给一个 promise 加上超时。
 *
 * 存在的理由很具体：损坏的 OPF 会让 epub.js 的 `display()` 既不 resolve
 * 也不 reject（技术方案 §7.1 实测），只靠 try/catch 兜不住。解析元数据走
 * 的是同一套解析器，同样可能不 settle。
 *
 * 成功路径也要清掉定时器，否则一个已完成的解析会留下悬空 timer。
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}超时（${ms}ms）`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
