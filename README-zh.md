# dsh-research-bench

**PerryLink DSH 科研插件家族的开源、合成、冻结评测集。**

*数据 + 量表 + 打分契约 —— 不是插件。任何检测器 README 只能引用由本仓产生的数字。*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

[English](README.md) · 简体中文

## 为什么存在

家族里每个插件都声称能“核验”什么。没有测量的声明就是营销，所以：

- 数据**合成且冻结**（不含受版权 PDF、不含个人信息、不抓取语料）；
- 标签来自**生成器量表**，绝不来自插件输出；
- 想发布准确率的插件必须提供**适配器**读取本仓数据并打印混淆矩阵；
- 插件 README 里的数字必须写明数据集版本与复现命令。

## 数据集

| 数据集 | 条数 | 状态 | 消费者 |
|---|---:|---|---|
| `data/citations` | **100** | ✅ 冻结 | `dsh-cite-verify` |
| `data/stats` | **30** | ✅ 冻结 | `dsh-statcheck` |
| `data/claims` | 50 | 🚧 随 `dsh-claim-check`（W2） | `dsh-claim-check` |
| `data/repro` | 10 | 🚧 随 `dsh-repro-audit`（W2） | `dsh-repro-audit` |
| `data/manuscripts` | 10 | 🚧 随 `dsh-manuscript-check`（W3） | `dsh-manuscript-check` |
| `data/figures` | 100 对 | 🚧 随 `dsh-image-integrity`（W4） | `dsh-image-integrity` |

### `data/citations`（v0.1.0，冻结）

100 条，8 类，每条都带插件本应收到的**冻结数据源响应**：

| 类别 | 条数 | 错在哪 |
|---|---:|---|
| `correct` | 30 | 全对 —— 不得被标记 |
| `wrong-author` | 20 | 第一作者被改 / 多引作者 |
| `wrong-year` | 15 | 年份差 1、2 或 10 年 |
| `wrong-doi` | 15 | 8 条查无此 DOI，7 条指向另一篇 |
| `retracted` | 8 | 记录自带撤稿通知 |
| `correction` | 6 | 记录自带更正通知 |
| `preprint` | 4 | arXiv 与正式版一致 |
| `disagreement` | 2 | PubMed 与 Crossref 标题不一致 |

所有作品、DOI（`10.5555/...`）、作者、期刊均为**虚构**。响应由生成器构造，因此测的是插件的**检查逻辑**，不是 Crossref 的可用性。

格式：每行一个 JSON，schema 见 [`schema/citation-case.schema.json`](schema/citation-case.schema.json)；标签与指标定义见 [`rubric/CITATIONS.md`](rubric/CITATIONS.md)。

## 打分契约

适配器：读 `cases.jsonl`（`BENCH_DIR` 或 `../dsh-research-bench`）→ 用冻结响应跑插件自己的管线（不联网）→ 每条给出预测 `{exists, mismatch_fields, update_notice}` → 计算指标并输出 JSON + Markdown。

指标（micro 平均）：存在性 precision/recall、字段 precision/recall/F1、更新通知 precision/recall、干净样本误报率、整案完全一致率。

插件 README 必须报告以上全部（或明确说明缺哪项及原因），并写明数据集版本与命令。

## 复现

```sh
npm run generate        # 确定性生成，重写 data/citations 与 data/stats
npm run validate        # 结构 + 计数 + 标签空间
```

CI 两者都跑，并断言“重新生成后工作树无变化” —— 数据集不能悄悄漂移。

## 许可与来源

- 代码与数据：Apache-2.0。
- 不含第三方语料、论文 PDF、真实引用、个人信息。
- 数据源响应是按真实 API 形状构造的合成 fixture，**不是**线上录制，绝不能被当作关于真实论文的证据。

## 限制

- 合成元数据干净、英文、格式规整；真实文献的音译、姓名助词、上标、期刊缩写未被覆盖。
- 冻结 fixture 无法发现数据源格式变更；那由插件自身测试覆盖。
- 标签编码的是本仓量表；插件与标签不一致是需要复核的发现，不自动等于插件 bug。
- 目前只有引用数据集冻结，其余随消费者加入并独立升版。
