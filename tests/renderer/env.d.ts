/**
 * 让 tsc 认识 jest-dom 的匹配器（toBeInTheDocument / toHaveTextContent 等）。
 *
 * 运行时由 tests/setup.ts 注册，但类型是另一回事 —— 不引这一行，
 * `npm run typecheck` 会把每个匹配器都报成「属性不存在」。
 *
 * 用 import 而不是 `/// <reference types="..." />`：后者解析不了
 * 包的子路径导出，而类型挂在 `@testing-library/jest-dom/vitest` 上。
 */
import '@testing-library/jest-dom/vitest'
