export default function App() {
  // M2 的书架页与 M3 的阅读页依次接进来。
  //
  // M1 的风险验证页保留在 ./dev/VerifyPage.tsx，需要重跑时把它挂到这里即可
  // （它会往 console 打 [VERIFY:*] 日志，开发模式下会转发到终端 stdout）。
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h2>马克阅读器</h2>
      <p>M1 骨架已完成，书架界面开发中。</p>
    </div>
  )
}
