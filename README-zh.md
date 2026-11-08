# dsh-research-bench

**面向 DSH 科研插件家族的开源、合成、冻结基准。**

*数据 + 评分规则 + 打分契约 —— 不是插件。检测器的 README 只能引用由本仓库产生的数字。*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

[English](README.md) · 简体中文

---

## 为什么要有这个仓库

家族里的每个插件都声称能*核验*某样东西。没有测量支撑的声明就是营销，所以：

- 数据集是**合成且冻结**的（不含受版权保护的 PDF、不含个人数据、不含抓取的语料）；
- 标签来自**生成器的评分规则**，绝不来自插件的输出；
- 每个想发布准确率的插件都必须附带一个**适配器**，读取这些文件并打印混淆矩阵；
- 插件 README 中的数字必须写明数据集版本与确切命令。

## 数据集

| 数据集 | 用例数 | 状态 | 使用方 |
|---|---:|---|---|
| `data/citations` | **100** | ✅ 已冻结 | `dsh-cite-verify` |
| `data/stats` | **30** | ✅ 已冻结 | `dsh-statcheck` |
| `data/claims` | **50** | ✅ 已冻结 | `dsh-claim-check` |
| `data/images` | **100 对** | ✅ 已冻结 | `dsh-image-integrity` |
| `data/meta` | **20** | ✅ 已冻结 | `dsh-meta-analysis` |
| `data/claims-heldout` | **50** | ✅ 已冻结 | `dsh-claim-check`（独立 held-out） |
| `data/repro` | 10 | 🚧 随 `dsh-repro-audit`（W2） | `dsh-repro-audit` |
| `data/manuscripts` | **10** | ✅ 已冻结 | `dsh-manuscript-check` |
| `data/figures` | 100 对 | 🚧 随 `dsh-image-integrity`（W4） | `dsh-image-integrity` |

### `data/repro`（v0.1.0，已冻结）

10 个 recipe 夹具项目，运行时在临时目录生成（不提交 `.git`）：干净、缺 seed/lockfile、无 git、脏树、缺运行命令/env 钉，以及 3 个记录后漂移用例。级别与精确 gap 集合由 recipe 指定；插件 README 报告 level 准确率、gap P/R、漂移检出与 git 前置条件。

### `data/manuscripts`（v0.1.0，已冻结）

10 篇合成稿件、140 个条目标签（每篇 14 项结构/声明）与文档级 `missingCoreSections`。标签由生成器按构造给出，不由检测器反推；插件 README 报告条目级 present/missing P/R，并声明这是关键词检测的回归基线，不是合规审查。

### `data/claims-heldout`（v0.1.0，已冻结）

基线冻结后新写的 50 条 claim/source 对，7 段全新 source，与基线无逐字复用；哈希写入 `SUMMARY.json`，运行器发现哈希变化即拒绝运行。它是**同作者时间留出集**，不是盲测/无偏估计（作者写题前已读实现）；结果与基线分开报告。

### `data/meta`（v0.1.0，已冻结）

20 组合成元分析（153 条研究行），覆盖同质、中/高异质、零/负效应、k=2/5/10/12 与等/不等 SE。固定/随机合并值、Q、I²、τ² 由生成器中的独立闭式实现计算，不由插件反推；插件 README 报告实测最大绝对误差与限制（同 DL 模型、无缺失）。

### `data/images`（v0.1.0，已冻结）

100 对合成 64×64 PNG：25 对重复块、25 对镜像块、25 对无关、25 对仅共享平坦边框的难负例。标签由生成器给出，不由检测器反推。检测器 README 必须引用实测 precision/recall/FPR，并说明 fixture 是网格对齐且未压缩的。

### `data/claims`（v0.1.0，已冻结）

50 条 claim，分布在五个合成段落上：15 条有支撑（`verified`）、10 条转述（**按设计为 `insufficient`** —— v0.1 不做语义判断）、8 条数字错误（`disproven`）、7 条否定翻转与 5 条断章取义（`contradicted`）、5 条内容缺失（`insufficient`）。schema 见 [`schema/claim-case.schema.json`](schema/claim-case.schema.json)；规则与有效性说明见 [`rubric/CLAIMS.md`](rubric/CLAIMS.md)。

> **有效性说明。** v0.1 的 claim 用例与 `dsh-claim-check` 的规则依据同一份评分规则写成，且其中一条规则在某个 supported 用例失败后被修正。该数据集上的 1.0 数字是一个**回归基线，而不是**对真实稿件准确率的无偏估计。一个不参照实现编写的 held-out 集仍在计划中。

### `data/stats`（v0.1.0，已冻结）

30 条围绕已发表临界值构造的合成句子：10 条一致（报告的 p 正是该临界统计量所对应的概率），20 条不一致（p 错误、阈值错误、CI 与显著的 p 矛盾、`p = .000`、`p > 1`）。标签来自临界值表 —— 不是来自插件。格式见 [`schema/stat-case.schema.json`](schema/stat-case.schema.json)；规则见 [`rubric/STATS.md`](rubric/STATS.md)。

### `data/citations`（v0.1.0，已冻结）

100 条用例，分为八类，每条都带有插件本应收到的**冻结数据源响应**：

| 类别 | 用例数 | 错在哪里 |
|---|---:|---|
| `correct` | 30 | 没有错误 —— 不得被标记 |
| `wrong-author` | 20 | 第一作者被改动 / 多引了一位作者 |
| `wrong-year` | 15 | 年份相差 1 年、2 年或 10 年 |
| `wrong-doi` | 15 | 8 个无法解析的 DOI，7 个指向其他工作的 DOI |
| `retracted` | 8 | 记录带有撤稿通知 |
| `correction` | 6 | 记录带有更正通知 |
| `preprint` | 4 | arXiv 与正式发表的 DOI 一致 |
| `disagreement` | 2 | PubMed 与 Crossref 的标题不一致 |

每一个工作、DOI（`10.5555/...`）、作者与期刊都是**虚构的**。fixture 响应由生成器构造，因此这个基准测量的是插件的*检查逻辑*，而不是 Crossref 的可用性。

格式：每行一个 JSON 对象，schema 见 [`schema/citation-case.schema.json`](schema/citation-case.schema.json)。标签定义与指标契约见 [`rubric/CITATIONS.md`](rubric/CITATIONS.md)。

## 打分契约

插件适配器是插件仓库中的一个脚本，它需要完成以下步骤：

1. 读取 `cases.jsonl`（路径取自 `BENCH_DIR`，否则取 `../dsh-research-bench`）。
2. 针对用例自带的冻结数据源 fixture，运行插件自己的管线（不联网）。
3. 对每个用例产出一条预测：
   ```json
   { "exists": true, "mismatch_fields": ["title"], "update_notice": false }
   ```
4. 计算下面的指标，并写出 JSON 报告与 Markdown 表格。

### 指标（micro 平均）

| 指标 | 定义 |
|---|---|
| existence precision / recall | 预测的 `exists=false` 与标注的 `exists=false` 相对照 |
| field precision / recall / F1 | 在 `mismatch_fields` 中的 `(case, field)` 对上计算 |
| update-notice precision / recall | 在 `update_notice` 上计算 |
| clean false-positive rate | `correct` 用例中，任一字段被标记、`update_notice` 被标记，或被判为 `not_found` 的比例 |
| case exact match | 存在性**与**字段集合**与**通知标记全部一致的用例比例 |

插件 README 必须报告上述全部指标（或明确说明哪一项未报告及其原因），并写明数据集版本与产生这些数字的命令。

## 复现

```sh
npm run generate        # 确定性；重写 data/citations、data/stats、data/claims 与 data/images
npm run validate        # structure + counts + categories + label space + SUMMARY agreement
```

CI 会运行这两个命令，并在重新生成会改动已提交文件时判为失败 —— 数据集无法悄悄漂移。

## 许可与来源

- 代码与数据：Apache-2.0。
- 不含第三方语料、论文 PDF、真实引用或个人信息。
- 数据源响应是按真实 API 形状构造的合成 fixture；它们**不是**从线上服务录制的，绝不能被当作关于某篇真实论文的证据。

## 限制

- 合成工作具有干净、英文、格式规整的元数据；真实文献中的转写、姓名助词、上标与期刊缩写，这个数据集都没有覆盖。
- 冻结 fixture 无法捕捉数据源一侧的格式变更；这类问题由插件自身的测试覆盖。
- 标签编码的是*本仓库*的评分规则。插件与标签不一致，是一个需要复核的发现，而不是自动等同于插件有 bug。
- 六套数据集全部冻结在 v0.1.0：citations、stats、claims、claims-heldout、images、meta、manuscripts 与 repro。
- claims v0.1 数据集是共同设计的回归基线（见上文有效性说明）；它不是 held-out 测试集。

## 版本管理

在数据集陆续加入期间保持 `0.x`。数据集版本（`dataset`、`version`、`total`）写在每个 `SUMMARY.json` 中；修改已冻结数据集的标签或用例，需要提升版本号，并在 [`CHANGELOG.md`](CHANGELOG.md) 中记录一笔。
