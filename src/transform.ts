/**
 * tranmd 核心转换：把 Obsidian 语法的 Markdown 转成 MarginNote 4 可渲染的标准 Markdown。
 *
 * 转换规则（默认推荐）：
 *  1. 删除文件开头的 YAML frontmatter
 *  2. 保护代码块 / 行内代码 / 数学块，避免误改
 *  3. 删除 %% 注释 %%
 *  4. 嵌入 ![[...]] → 显示名纯文本
 *  5. 双向链接 [[...]] → 显示名纯文本（含 |别名 / #标题 / ^块引用）
 *  6. Callout > [!type] 标题 → > 标题
 *  7. 行内 #标签 → 去掉 # 保留文字
 *  8. 行尾块引用 ^blockid → 删除
 *  9. ==高亮== → <mark>高亮</mark>
 * 10. ~~删除线~~ → 去掉符号保留文字（MN4 不支持删除线）
 * 11. 脚注 [^id] 引用删除，定义转为普通列表行（MN4 不支持脚注）
 */

export function toMarginNoteMarkdown(raw: string): string {
  let s = (raw ?? "").replace(/\r\n?/g, "\n");

  // 1. 删除文件开头的 YAML frontmatter
  s = removeFrontmatter(s);

  // 2. 保护代码块 / 行内代码 / 数学块，避免被后续规则误改
  const store: string[] = [];
  s = maskProtected(s, store);

  // 3. 删除 %% 注释 %%
  s = s.replace(/%%[\s\S]*?%%/g, "");

  // 4. 嵌入 ![[...]]（必须在普通链接之前处理）
  s = s.replace(/!\[\[([^[\]]+)\]\]/g, (_m, inner: string) =>
    resolveWikiText(inner, true)
  );

  // 5. 双向链接 [[...]]
  s = s.replace(/\[\[([^[\]]+)\]\]/g, (_m, inner: string) =>
    resolveWikiText(inner, false)
  );

  // 6. Callout > [!type] 标题 → > 标题
  s = s.replace(/^((?:\s*>+\s*)+)\[![^\]]*\]\s*[+-]?\s*/gm, "$1");

  // 7. 行内 #标签 → 去掉 # 保留文字
  s = stripInlineTags(s);

  // 8. 行尾块引用 ^blockid → 删除
  s = s.replace(/\s+\^[A-Za-z0-9_-]+\s*$/gm, "");

  // 9. 高亮 ==...== → <mark>...</mark>
  // 内容里允许出现单个 =（如 "数组下标 = 元素编号"），只把 == 当作边界
  s = s.replace(/==((?:(?!==)[^\n])+?)==/g, "<mark>$1</mark>");

  // 10. 删除线 ~~...~~ → 保留文字（同样允许内容里的单个 ~）
  s = s.replace(/~~((?:(?!~~)[^\n])+?)~~/g, "$1");

  // 11. 脚注：先转定义行，再删引用
  s = s.replace(/^\[\^[^\]\n]+\]:\s*/gm, "- 脚注：");
  s = s.replace(/\[\^[^\]\n]+\]/g, "");

  // 还原代码 / 数学区域
  s = restoreProtected(s, store);

  // 清理多余空行
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim() + "\n";
}

function removeFrontmatter(s: string): string {
  const m = s.match(/^---\n[\s\S]*?\n(?:---|\.\.\.)\s*(?:\n|$)/);
  if (m && m.index === 0) return s.slice(m[0].length);
  return s;
}

function maskProtected(s: string, store: string[]): string {
  const patterns: RegExp[] = [
    /```[\s\S]*?```/g, // 围栏代码块
    /~~~[\s\S]*?~~~/g, // 波浪围栏代码块
    /`{2,}[^`]*?`{2,}/g, // 多反引号行内代码
    /`[^`\n]*`/g, // 单反引号行内代码
    /\$\$[\s\S]*?\$\$/g, // 数学块
  ];
  for (const re of patterns) {
    s = s.replace(re, (m) => {
      const token = "\uE000TMD" + store.length + "\uE001";
      store.push(m);
      return token;
    });
  }
  return s;
}

function restoreProtected(s: string, store: string[]): string {
  return s.replace(/\uE000TMD(\d+)\uE001/g, (_m, i) => store[Number(i)]);
}

function resolveWikiText(inner: string, isEmbed: boolean): string {
  let target = inner.trim();
  let alias: string | null = null;

  const pipe = target.indexOf("|");
  if (pipe >= 0) {
    const rest = target.slice(pipe + 1);
    target = target.slice(0, pipe);
    // 图片嵌入的 |数字 是尺寸而非别名
    if (!(isEmbed && /^\d+$/.test(rest))) alias = rest;
  }

  if (alias != null && alias.length > 0) return alias;

  const hash = target.indexOf("#");
  if (hash >= 0) {
    const after = target.slice(hash + 1);
    return after && !after.startsWith("^") ? after : target.slice(0, hash);
  }

  const caret = target.indexOf("^");
  if (caret >= 0) return target.slice(0, caret);

  return target;
}

function stripInlineTags(s: string): string {
  return s.replace(
    /#[\p{L}\p{N}_][\p{L}\p{N}_\-/]*/gu,
    (match: string, offset: number, str: string) => {
      const prev = str[offset - 1];
      // 前面是单词字符或 #（标题）时跳过，避免误伤 URL 片段 / C# / ## 标题
      if (prev && /[\p{L}\p{N}_#]/u.test(prev)) return match;
      return match.slice(1);
    }
  );
}
