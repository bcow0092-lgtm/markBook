# 测试样本

技术方案 §6.4 要求的 EPUB 人工验证清单。产物**以二进制形式提交进仓库**，
脚本留档但**不在 CI 中执行**——这样 CI 既不需要联网，也不需要 zip 写入依赖。

## 文件

| 文件 | 覆盖特征 | 来源 |
|---|---|---|
| `sample-gutenberg.epub` | 真实排版、规范 EPUB 3 | Project Gutenberg #1342（公有领域） |
| `wide-table.epub` | 15 列超宽表格，必然溢出单页 | 由源书注入生成 |
| `many-images.epub` | 200 张内嵌图片 | 由源书注入生成 |
| `mixed-cjk-latin.epub` | 中英混排、代码块、引用块 | 由源书注入生成 |
| `no-cover-no-author.epub` | 无封面、无作者元数据 | 由源书剥离生成 |
| `broken-opf.epub` | 损坏的 OPF，验证容错 | 由源书截断生成 |

## 重新生成

```bash
node tests/fixtures/generate.mjs tests/fixtures/sample-gutenberg.epub
```

源书需要手工准备：

```bash
curl -L -o tests/fixtures/sample-gutenberg.epub \
  https://www.gutenberg.org/cache/epub/1342/pg1342.epub
```

## 为什么自带 zip 实现

`zip.mjs` 是一个最小的 zip 读写实现，没有用现成工具，原因有三：

1. 环境里没有 `zip` CLI
2. PowerShell 的 `Compress-Archive` 在 Windows 上用**反斜杠**写 zip 条目名，违反 zip 规范（必须用正斜杠），epub.js 直接报 `Cannot load book`。这个坑在 M1 上真实踩到过
3. 项目规范要求依赖精简，不为一次性脚本引入 `archiver` / `jszip`

另外 `generate.mjs` 重新打包时会把 `mimetype` 放在第一个条目且不压缩——这是 EPUB 规范的要求。

## 已知的样本局限

- 五个变体都是同一本源书的副本，各约 550KB，仓库里合计约 3MB
- 未覆盖「损害程度介于正常与完全损坏之间」的 EPUB
- 源书第一章自带两张页眉表格（共 208 个单元格，宽 5906px），会干扰表格相关断言的归因，M3 做自动化断言时要注意
