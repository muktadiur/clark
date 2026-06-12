/**
 * Clark — chat application frontend.
 *
 * Vanilla ES2017+, no dependencies. All server communication goes through
 * same-origin endpoints, so the app works behind any host/port/proxy.
 */
(() => {
  "use strict";

  const API = {
    files: "/files",
    upload: "/upload_files",
    delete: "/delete_file/",
    process: "/process/",
    completions: "/completions/",
  };

  const JSON_HEADERS = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  /* ------------------------------------------------------------------ *
   * Utilities
   * ------------------------------------------------------------------ */

  const escapeHtml = (text) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const baseName = (path) => path.split(/[\\/]/).pop();

  /**
   * Minimal markdown renderer for LLM answers. Input is fully HTML-escaped
   * before any tags are produced, so model output can never inject markup.
   * Supports: fenced code blocks, inline code, bold, italic, headings,
   * unordered/ordered lists, links, paragraphs.
   */
  function renderMarkdown(raw) {
    const codeBlocks = [];
    const text = raw.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      codeBlocks.push({ lang, code });
      return `\u0000${codeBlocks.length - 1}\u0000`;
    });

    const renderInline = (line) =>
      escapeHtml(line)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|\s)\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
        .replace(
          /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
        );

    const lines = text.split("\n");
    const out = [];
    let list = null; // { tag: "ul" | "ol", items: [] }
    let paragraph = [];

    const flushParagraph = () => {
      if (paragraph.length) {
        out.push(`<p>${paragraph.map(renderInline).join("<br>")}</p>`);
        paragraph = [];
      }
    };

    const flushList = () => {
      if (list) {
        out.push(
          `<${list.tag}>${list.items.map((i) => `<li>${i}</li>`).join("")}</${list.tag}>`
        );
        list = null;
      }
    };

    for (const line of lines) {
      const codeRef = line.match(/^\u0000(\d+)\u0000$/);
      const heading = line.match(/^(#{1,4})\s+(.*)$/);
      const bullet = line.match(/^\s*[-*]\s+(.*)$/);
      const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);

      if (codeRef) {
        flushParagraph();
        flushList();
        const { lang, code } = codeBlocks[Number(codeRef[1])];
        const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
        out.push(`<pre><code${cls}>${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`);
      } else if (heading) {
        flushParagraph();
        flushList();
        const level = Math.min(heading[1].length + 2, 4); // h3 / h4 only
        out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      } else if (bullet || ordered) {
        flushParagraph();
        const tag = bullet ? "ul" : "ol";
        if (!list || list.tag !== tag) {
          flushList();
          list = { tag, items: [] };
        }
        list.items.push(renderInline((bullet || ordered)[1]));
      } else if (line.trim() === "") {
        flushParagraph();
        flushList();
      } else {
        flushList();
        paragraph.push(line);
      }
    }
    flushParagraph();
    flushList();
    return out.join("");
  }

  /* ------------------------------------------------------------------ *
   * Application
   * ------------------------------------------------------------------ */

  class ChatApp {
    constructor() {
      this.thread = document.getElementById("chatThread");
      this.scroller = document.getElementById("chatScroll");
      this.welcome = document.getElementById("welcome");
      this.composer = document.getElementById("composer");
      this.input = document.getElementById("promptInput");
      this.sendBtn = document.getElementById("sendBtn");
      this.fileList = document.getElementById("fileList");
      this.fileEmpty = document.getElementById("fileEmpty");
      this.fileInput = document.getElementById("fileInput");
      this.processBtn = document.getElementById("processBtn");
      this.toastContainer = document.getElementById("toastContainer");
      this.sidebar = document.getElementById("sidebar");
      this.sidebarOverlay = document.getElementById("sidebarOverlay");
      this.menuBtn = document.getElementById("menuBtn");

      this.pending = false;
    }

    init() {
      this.bindComposer();
      this.bindSidebar();
      this.bindSuggestions();
      this.fileInput.addEventListener("change", () => this.uploadFiles());
      this.processBtn.addEventListener("click", () => this.processFiles());
      this.loadFiles();
      this.input.focus();
    }

    /* ----- networking ----- */

    async request(url, options = {}) {
      const response = await fetch(url, options);
      if (response.status === 401) {
        window.location.href = "/login";
        throw new Error("Not authenticated");
      }
      if (!response.ok) {
        let detail = `Request failed (${response.status})`;
        try {
          detail = (await response.json()).detail || detail;
        } catch {
          /* non-JSON error body */
        }
        throw new Error(detail);
      }
      return response.json();
    }

    /* ----- composer ----- */

    bindComposer() {
      this.composer.addEventListener("submit", (event) => {
        event.preventDefault();
        this.send();
      });

      this.input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          this.send();
        }
      });

      this.input.addEventListener("input", () => {
        this.sendBtn.disabled = this.input.value.trim() === "" || this.pending;
        this.autoResize();
      });
    }

    autoResize() {
      this.input.style.height = "auto";
      this.input.style.height = `${Math.min(this.input.scrollHeight, 200)}px`;
    }

    resetComposer() {
      this.input.value = "";
      this.autoResize();
      this.sendBtn.disabled = true;
    }

    setPending(pending) {
      this.pending = pending;
      this.sendBtn.disabled = pending || this.input.value.trim() === "";
    }

    bindSuggestions() {
      document.querySelectorAll(".suggestion").forEach((button) => {
        button.addEventListener("click", () => {
          this.input.value = button.textContent.trim();
          this.input.dispatchEvent(new Event("input"));
          this.send();
        });
      });
    }

    /* ----- chat thread ----- */

    hideWelcome() {
      if (this.welcome) {
        this.welcome.remove();
        this.welcome = null;
      }
    }

    isNearBottom() {
      const { scrollTop, scrollHeight, clientHeight } = this.scroller;
      return scrollHeight - scrollTop - clientHeight < 120;
    }

    scrollToBottom(force = false) {
      if (force || this.isNearBottom()) {
        this.scroller.scrollTop = this.scroller.scrollHeight;
      }
    }

    addUserMessage(text) {
      const message = document.createElement("div");
      message.className = "message message--user";
      const bubble = document.createElement("div");
      bubble.className = "message-bubble";
      bubble.textContent = text;
      message.appendChild(bubble);
      this.thread.appendChild(message);
      this.scrollToBottom(true);
    }

    addAssistantMessage() {
      const message = document.createElement("div");
      message.className = "message message--assistant";

      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      avatar.textContent = "✳";

      const content = document.createElement("div");
      content.className = "message-content";
      content.innerHTML =
        '<div class="typing-dots"><span></span><span></span><span></span></div>';

      message.append(avatar, content);
      this.thread.appendChild(message);
      this.scrollToBottom(true);
      return { message, content };
    }

    /**
     * Typewriter effect: streams the plain text in adaptive chunks
     * (~2 seconds total regardless of length), then swaps in the
     * markdown-rendered HTML.
     */
    typeOut(content, text) {
      return new Promise((resolve) => {
        const chunk = Math.max(1, Math.ceil(text.length / 160));
        let index = 0;
        content.classList.add("typing-text");
        content.textContent = "";

        const step = () => {
          index = Math.min(index + chunk, text.length);
          content.textContent = text.slice(0, index);
          this.scrollToBottom();
          if (index < text.length) {
            setTimeout(step, 12);
          } else {
            content.classList.remove("typing-text");
            content.innerHTML = renderMarkdown(text);
            this.scrollToBottom();
            resolve();
          }
        };
        step();
      });
    }

    async send() {
      const text = this.input.value.trim();
      if (!text || this.pending) return;

      this.hideWelcome();
      this.addUserMessage(text);
      this.resetComposer();
      this.setPending(true);

      const { message, content } = this.addAssistantMessage();
      try {
        const answer = await this.request(API.completions, {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ message: text }),
        });
        await this.typeOut(content, answer.content);
      } catch (error) {
        console.error(error);
        message.classList.add("message--error");
        content.textContent =
          "Sorry, I couldn't answer that. Make sure you've uploaded documents " +
          "and clicked “Process documents”, then try again.";
      } finally {
        this.setPending(false);
        this.input.focus();
      }
    }

    /* ----- documents ----- */

    async loadFiles() {
      try {
        const files = await this.request(API.files);
        this.renderFiles(files);
      } catch (error) {
        console.error(error);
      }
    }

    renderFiles(files) {
      this.fileList.innerHTML = "";
      this.fileEmpty.hidden = files.length > 0;
      this.processBtn.disabled = files.length === 0;

      for (const path of files) {
        const item = document.createElement("li");
        item.className = "file-item";
        item.innerHTML = `
          <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <path d="M14 2v6h6"/>
          </svg>
          <span class="file-name"></span>
          <button class="file-delete" type="button" title="Delete file">✕</button>`;
        item.querySelector(".file-name").textContent = baseName(path);

        const deleteBtn = item.querySelector(".file-delete");
        deleteBtn.addEventListener("click", () => {
          if (deleteBtn.classList.contains("confirm")) {
            this.deleteFile(path);
          } else {
            deleteBtn.classList.add("confirm");
            deleteBtn.textContent = "Sure?";
            setTimeout(() => {
              deleteBtn.classList.remove("confirm");
              deleteBtn.textContent = "✕";
            }, 2500);
          }
        });

        this.fileList.appendChild(item);
      }
    }

    async uploadFiles() {
      const files = Array.from(this.fileInput.files);
      if (!files.length) return;

      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      try {
        await this.request(API.upload, { method: "POST", body: formData });
        this.fileInput.value = "";
        await this.loadFiles();
        this.toast(
          `Uploaded ${files.length} file${files.length > 1 ? "s" : ""}. ` +
            "Click “Process documents” to index them.",
          "success"
        );
      } catch (error) {
        console.error(error);
        this.toast("Upload failed. Please try again.", "error");
      }
    }

    async deleteFile(path) {
      try {
        await this.request(API.delete, {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ file_name: path }),
        });
        await this.loadFiles();
        this.toast(`Deleted ${baseName(path)}.`, "success");
      } catch (error) {
        console.error(error);
        this.toast("Couldn't delete the file.", "error");
      }
    }

    async processFiles() {
      const label = this.processBtn.querySelector(".process-label");
      const icon = this.processBtn.querySelector(".process-icon");
      const spinner = this.processBtn.querySelector(".spinner");

      this.processBtn.disabled = true;
      icon.setAttribute("hidden", "");
      spinner.removeAttribute("hidden");
      label.textContent = "Processing…";

      try {
        await this.request(API.process, { method: "POST", headers: JSON_HEADERS });
        // Indexing runs as a server-side background task; give it a moment
        // before re-enabling so users don't immediately re-trigger it.
        setTimeout(() => {
          this.processBtn.disabled = false;
          spinner.setAttribute("hidden", "");
          icon.removeAttribute("hidden");
          label.textContent = "Process documents";
          this.toast("Documents indexed. You can start asking questions.", "success");
        }, 5000);
      } catch (error) {
        console.error(error);
        this.processBtn.disabled = false;
        spinner.setAttribute("hidden", "");
        icon.removeAttribute("hidden");
        label.textContent = "Process documents";
        this.toast("Processing failed. Please try again.", "error");
      }
    }

    /* ----- sidebar (mobile) ----- */

    bindSidebar() {
      const close = () => {
        this.sidebar.classList.remove("sidebar--open");
        this.sidebarOverlay.classList.remove("visible");
      };
      this.menuBtn.addEventListener("click", () => {
        this.sidebar.classList.toggle("sidebar--open");
        this.sidebarOverlay.classList.toggle("visible");
      });
      this.sidebarOverlay.addEventListener("click", close);
    }

    /* ----- toasts ----- */

    toast(message, kind = "info", duration = 4000) {
      const toast = document.createElement("div");
      toast.className = `toast toast--${kind}`;
      toast.textContent = message;
      this.toastContainer.appendChild(toast);
      setTimeout(() => {
        toast.classList.add("toast--closing");
        toast.addEventListener("animationend", () => toast.remove(), { once: true });
      }, duration);
    }
  }

  document.addEventListener("DOMContentLoaded", () => new ChatApp().init());
})();
