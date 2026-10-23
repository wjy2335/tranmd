import assert from "node:assert";
import { toMarginNoteMarkdown } from "../src/transform";

const input = `---
title: 测试
tags: [a, b]
---

# 标题一

这是正文，包含一个 [[笔记链接|别名]] 和 [[另一个笔记]]。

> [!NOTE] 提示框标题
> 这是 callout 内容。

一段 %%隐藏注释%% 文字，还有行内代码 \`a == b\` 不应被改。

\`\`\`js
const x = "== 不要动 ==";
\`\`\`

![[图片.png|300]]

高亮 ==这里== 和删除线 ~~删除我~~。

行内标签 #重要 和 #todo/今天。

块引用测试 ^abc123

脚注例子[^1]，末尾 [^2]。

[^1]: 第一个脚注
[^2]: 第二个脚注

$$
E = mc^2
$$
`;

const out = toMarginNoteMarkdown(input);

// frontmatter 移除
assert.ok(!out.includes("title: 测试"), "frontmatter 应被删除");
assert.ok(!out.includes("tags: [a, b]"), "frontmatter tags 应被删除");

// wikilink 转换
assert.ok(!out.includes("[["), "不应残留 [[");
assert.ok(out.includes("别名"), "[[笔记链接|别名]] → 别名");
assert.ok(out.includes("另一个笔记"), "[[另一个笔记]] → 另一个笔记");

// callout 转换
assert.ok(!out.includes("[!NOTE]"), "callout 类型标记应被删除");
assert.ok(out.includes("> 提示框标题"), "callout 标题保留为引用");

// 注释删除
assert.ok(!out.includes("隐藏注释"), "%%注释%% 应被删除");

// 代码/数学保护
assert.ok(out.includes("`a == b`"), "行内代码内的 == 不应被改");
assert.ok(
  out.includes('const x = "== 不要动 ==";'),
  "代码块内的 == 不应被改"
);
assert.ok(out.includes("$$\nE = mc^2\n$$"), "数学块应保留");

// 嵌入图片
assert.ok(!out.includes("![[图片.png|300]]"), "嵌入应被转换");
assert.ok(out.includes("图片.png"), "图片嵌入 → 文件名");

// 高亮 / 删除线
assert.ok(out.includes("<mark>这里</mark>"), "==高亮== → <mark>");
assert.ok(!out.includes("~~删除我~~"), "删除线符号应被移除");
assert.ok(out.includes("删除我"), "删除线保留文字");

// 行内标签
assert.ok(!out.includes("#重要"), "#标签应去掉 #");
assert.ok(out.includes("重要"), "标签文字保留");
assert.ok(!out.includes("#todo/今天"), "#todo/今天 应去掉 #");

// 块引用
assert.ok(!out.includes("^abc123"), "块引用标记应被删除");

// 脚注
assert.ok(!out.includes("[^1]"), "脚注引用应被删除");
assert.ok(out.includes("- 脚注：第一个脚注"), "脚注定义转普通列表");

// 回归：高亮内容里含单个 = 时也要转换
const calloutInput = `> [!important] 示例：==**示例 A**==
> ==**参数 x = 1；参数 y = 2；合计 = 3**==
`;
const calloutOut = toMarginNoteMarkdown(calloutInput);
assert.ok(
  calloutOut.includes("<mark>**示例 A**</mark>"),
  "第一行高亮应转换"
);
assert.ok(
  calloutOut.includes("<mark>**参数 x = 1；参数 y = 2；合计 = 3**</mark>"),
  "含单个 = 的高亮也要转换"
);
assert.ok(!calloutOut.includes("=="), "不应残留 == 高亮标记");

console.log("✅ transform 测试全部通过");
