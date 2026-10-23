import {
  App,
  Editor,
  MarkdownView,
  Menu,
  Modal,
  Notice,
  Plugin,
  TFile,
} from "obsidian";
import { toMarginNoteMarkdown } from "./transform";

/** 移动端 Capacitor 剪贴板的最小类型定义（避免 any）。 */
interface CapacitorClipboard {
  write?: (options: { string: string }) => Promise<void>;
}
interface CapacitorGlobal {
  Plugins?: {
    Clipboard?: CapacitorClipboard;
  };
}

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

/** 给可能挂起的剪贴板调用加超时，避免 await 永久卡住导致「没反应」。 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("clipboard timeout")),
      ms
    );
    p.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    );
  });
}

export default class TranMDPlugin extends Plugin {
  async onload() {
    // 命令 1：复制选中内容（编辑/阅读模式都可用；未选中则复制整篇）
    // 注意：用 callback 而非 editorCallback，否则阅读模式下命令不会触发。
    this.addCommand({
      id: "copy-selection-as-mn-md",
      name: "复制选中内容为 MarginNote Markdown",
      callback: async () => {
        const selected = this.getSelectedText();
        const source = selected || (await this.getActiveContent());
        if (source == null) return;
        await this.copyAndNotify(
          toMarginNoteMarkdown(source),
          selected ? "已复制选中内容" : "未选中，已复制整篇笔记"
        );
      },
    });

    // 命令 2：复制整篇笔记
    this.addCommand({
      id: "copy-note-as-mn-md",
      name: "复制整篇笔记为 MarginNote Markdown",
      callback: async () => {
        const content = await this.getActiveContent();
        if (content == null) return;
        await this.copyAndNotify(
          toMarginNoteMarkdown(content),
          "已复制整篇笔记"
        );
      },
    });

    // 左侧 Ribbon 图标
    this.addRibbonIcon(
      "clipboard-copy",
      "复制整篇笔记为 MarginNote Markdown",
      async () => {
        const content = await this.getActiveContent();
        if (content == null) return;
        await this.copyAndNotify(
          toMarginNoteMarkdown(content),
          "已复制整篇笔记"
        );
      }
    );

    // 文件资源管理器右键菜单
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file: TFile) => {
        if (file.extension !== "md") return;
        menu.addItem((item) => {
          item
            .setTitle("复制为 MarginNote Markdown")
            .setIcon("clipboard-copy")
            .onClick(async () => {
              const content = await this.app.vault.cachedRead(file);
              await this.copyAndNotify(
                toMarginNoteMarkdown(content),
                `已复制「${file.basename}」`
              );
            });
        });
      })
    );

    // 编辑器选区菜单（编辑模式右键 / 移动端选区 ⋮ 菜单）
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
        menu.addItem((item) => {
          item
            .setTitle("复制为 MarginNote Markdown")
            .setIcon("clipboard-copy")
            .onClick(() => {
              const selection = editor.getSelection();
              const source = selection || editor.getValue();
              void this.copyAndNotify(
                toMarginNoteMarkdown(source),
                selection ? "已复制选中内容" : "未选中，已复制整篇笔记"
              );
            });
        });
      })
    );
  }

  /** 取当前选区：编辑模式用编辑器选区，阅读模式用页面 DOM 选区。 */
  private getSelectedText(): string {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.getMode() === "source" && view.editor) {
      return view.editor.getSelection();
    }
    // 阅读模式（preview）：从渲染后的 DOM 选区取文本
    return window.getSelection()?.toString() ?? "";
  }

  /** 优先取编辑器里（含未保存的）内容，否则读当前文件。 */
  private async getActiveContent(): Promise<string | null> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.getMode() === "source" && view.editor) {
      return view.editor.getValue();
    }

    const file = this.app.workspace.getActiveFile() ?? view?.file ?? null;
    if (file) return this.app.vault.cachedRead(file);

    new Notice("没有打开的笔记");
    return null;
  }

  private async copyAndNotify(text: string, message: string) {
    try {
      await this.copyText(text);
      new Notice(message + " ✅");
    } catch {
      new Notice("自动复制失败，已打开手动复制窗口");
      new FallbackModal(this.app, text).open();
    }
  }

  private async copyText(text: string) {
    // 1) 移动端原生剪贴板（桌面若存在但不可用，靠超时跳过，避免卡死）
    const clipboardWrite = window.Capacitor?.Plugins?.Clipboard?.write;
    if (clipboardWrite) {
      try {
        await withTimeout(clipboardWrite({ string: text }), 1500);
        return;
      } catch {
        /* 超时或失败，继续 */
      }
    }

    // 2) 桌面标准 Clipboard API
    if (navigator?.clipboard?.writeText) {
      try {
        await withTimeout(navigator.clipboard.writeText(text), 1500);
        return;
      } catch {
        /* 超时或失败，继续 */
      }
    }

    // 3) execCommand 同步兜底（桌面端）
    if (this.execCopy(text)) return;

    throw new Error("无法写入剪贴板");
  }

  private execCopy(text: string): boolean {
    try {
      const el = document.body.createEl("textarea");
      el.value = text;
      el.setCssStyles({ position: "fixed", opacity: "0" });
      el.focus();
      el.select();
      const ok = document.execCommand("copy");
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** 所有剪贴板方式都失败时（多见于移动端限制），弹出可手动复制的窗口。 */
class FallbackModal extends Modal {
  constructor(app: App, private text: string) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "无法自动写入剪贴板，请手动复制" });
    contentEl.createEl("p", {
      text: "长按下方文本全选后复制，再粘贴到 MarginNote。",
    });
    const ta = contentEl.createEl("textarea");
    ta.value = this.text;
    ta.setCssStyles({
      width: "100%",
      height: "50vh",
      fontFamily: "monospace",
    });
    ta.addEventListener("focus", () => ta.select());
    ta.focus();
    ta.select();
  }

  onClose() {
    this.contentEl.empty();
  }
}
