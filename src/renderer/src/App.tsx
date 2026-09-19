export default function App() {
  // M1 只搭了骨架，正式的书架页与阅读页在 M2 起实现。
  //
  // M1 的风险验证页保留在 ./dev/VerifyPage.tsx，需要重跑时把它挂到这里即可
  // （它会往 console 打 [VERIFY:*] 日志，开发模式下会转发到终端 stdout）。
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h2>马克阅读器</h2>
      <p>M1 骨架已完成，书架与阅读界面待 M2 起实现。</p>
    </div>
  )
}
