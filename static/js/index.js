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
    conversations: "/conversations",
    models: "/models",
    settings: "/settings",
    profile: "/profile",
  };

  const PROVIDER_PRESETS = {
    openai: { baseUrl: "", placeholder: "https://api.openai.com/v1" },
    ollama: {
      baseUrl: "http://localhost:11434/v1",
      placeholder: "http://localhost:11434/v1",
    },
    vllm: {
      baseUrl: "http://localhost:8000/v1",
      placeholder: "http://localhost:8000/v1",
    },
  };

  const HISTORY_VISIBLE_KEY = "clark-history-visible";
  const SIDEBAR_COLLAPSED_KEY = "clark-sidebar-collapsed";
  const MOBILE_QUERY = "(max-width: 768px)";

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

  /** Up-to-2-character initials from a name (matches the server's logic). */
  const initialsFrom = (name) => {
    const parts = (name || "").replace(/[._@]/g, " ").split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };

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
      this.sidebarToggle = document.getElementById("sidebarToggle");
      this.menuBtn = document.getElementById("menuBtn");
      this.userMenuBtn = document.getElementById("userMenuBtn");
      this.userMenu = document.getElementById("userMenu");
      this.historyPanel = document.getElementById("historyPanel");
      this.historyList = document.getElementById("historyList");
      this.historyEmpty = document.getElementById("historyEmpty");
      this.historyToggle = document.getElementById("historyToggle");
      this.historyClose = document.getElementById("historyClose");
      this.newChatBtn = document.getElementById("newChatBtn");
      this.modelSelect = document.getElementById("modelSelect");
      this.modelSelectBtn = document.getElementById("modelSelectBtn");
      this.modelSelectName = document.getElementById("modelSelectName");
      this.modelMenu = document.getElementById("modelMenu");
      this.profileBtn = document.getElementById("profileBtn");
      this.settingsBtn = document.getElementById("settingsBtn");
      this.settingsOverlay = document.getElementById("settingsOverlay");
      this.settingsClose = document.getElementById("settingsClose");
      this.settingsCancel = document.getElementById("settingsCancel");
      this.settingsSave = document.getElementById("settingsSave");
      this.providerSelect = document.getElementById("providerSelect");
      this.baseUrlInput = document.getElementById("baseUrlInput");
      this.apiKeyInput = document.getElementById("apiKeyInput");
      this.modelsInput = document.getElementById("modelsInput");
      this.defaultModelInput = document.getElementById("defaultModelInput");
      this.profileOverlay = document.getElementById("profileOverlay");
      this.profileClose = document.getElementById("profileClose");
      this.profileCancel = document.getElementById("profileCancel");
      this.profileSave = document.getElementById("profileSave");
      this.profileAvatar = document.getElementById("profileAvatar");
      this.displayNameInput = document.getElementById("displayNameInput");
      this.usernameInput = document.getElementById("usernameInput");
      this.userChipAvatar = document.getElementById("userChipAvatar");
      this.userChipName = document.getElementById("userChipName");
      this.userMenuAvatar = document.getElementById("userMenuAvatar");
      this.userMenuName = document.getElementById("userMenuName");
      this.profileEmailFallback = "";

      this.pending = false;
      this.conversationId = null;
      this.model = null;
    }

    init() {
      this.bindComposer();
      this.bindSidebar();
      this.bindHistory();
      this.bindUserMenu();
      this.bindSuggestions();
      this.bindModelSelect();
      this.bindSettings();
      this.fileInput.addEventListener("change", () => this.uploadFiles());
      this.processBtn.addEventListener("click", () => this.processFiles());
      this.loadFiles();
      this.loadConversations();
      this.loadModels();
      this.input.focus();
    }

    isMobile() {
      return window.matchMedia(MOBILE_QUERY).matches;
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

    /* ----- model selection ----- */

    async loadModels() {
      try {
        const { models, default: preferred } = await this.request(API.models);
        if (!Array.isArray(models) || models.length === 0) return;
        this.model = models.includes(preferred) ? preferred : models[0];
        this.renderModelMenu(models);
        this.modelSelectName.textContent = this.model;
      } catch (error) {
        console.error(error);
        /* leave the static label in place if models can't be fetched */
      }
    }

    renderModelMenu(models) {
      this.modelMenu.innerHTML = "";
      for (const name of models) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "model-menu-item";
        item.setAttribute("role", "menuitemradio");
        item.dataset.model = name;
        item.innerHTML =
          `<span class="model-menu-name">${escapeHtml(name)}</span>` +
          `<svg class="model-menu-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
          `stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>`;
        item.addEventListener("click", () => this.selectModel(name));
        this.modelMenu.appendChild(item);
      }
      this.markSelectedModel();
    }

    markSelectedModel() {
      for (const item of this.modelMenu.querySelectorAll(".model-menu-item")) {
        const active = item.dataset.model === this.model;
        item.classList.toggle("model-menu-item--active", active);
        item.setAttribute("aria-checked", active ? "true" : "false");
      }
    }

    selectModel(name) {
      this.model = name;
      this.modelSelectName.textContent = name;
      this.markSelectedModel();
      this.closeModelMenu();
    }

    bindModelSelect() {
      if (!this.modelSelectBtn) return;
      this.modelSelectBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        this.modelMenu.hidden ? this.openModelMenu() : this.closeModelMenu();
      });
      document.addEventListener("click", (event) => {
        if (!this.modelMenu.hidden && !this.modelSelect.contains(event.target)) {
          this.closeModelMenu();
        }
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") this.closeModelMenu();
      });
    }

    openModelMenu() {
      this.modelMenu.hidden = false;
      this.modelSelectBtn.setAttribute("aria-expanded", "true");
    }

    closeModelMenu() {
      this.modelMenu.hidden = true;
      this.modelSelectBtn.setAttribute("aria-expanded", "false");
    }

    /* ----- settings ----- */

    bindSettings() {
      this.bindProfile();
      if (!this.settingsBtn) return;
      this.settingsBtn.addEventListener("click", () => this.openSettings());
      this.settingsClose.addEventListener("click", () => this.closeSettings());
      this.settingsCancel.addEventListener("click", () => this.closeSettings());
      this.settingsOverlay.addEventListener("click", (event) => {
        if (event.target === this.settingsOverlay) this.closeSettings();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !this.settingsOverlay.hidden) {
          this.closeSettings();
        }
      });
      this.providerSelect.addEventListener("change", () =>
        this.applyProviderPreset(this.providerSelect.value)
      );
      this.settingsSave.addEventListener("click", () => this.saveSettings());
    }

    applyProviderPreset(provider) {
      const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.openai;
      this.baseUrlInput.value = preset.baseUrl;
      this.baseUrlInput.placeholder = preset.placeholder;
    }

    async openSettings() {
      this.setUserMenuOpen(false);
      try {
        const s = await this.request(API.settings);
        this.providerSelect.value = s.provider || "openai";
        this.applyProviderPreset(this.providerSelect.value);
        if (s.base_url) this.baseUrlInput.value = s.base_url;
        this.modelsInput.value = s.chat_models || "";
        this.defaultModelInput.value = s.default_model || "";
        this.apiKeyInput.value = "";
        this.apiKeyInput.placeholder = s.has_api_key
          ? "•••••••••••• (saved)"
          : "sk-…";
      } catch (error) {
        console.error(error);
        this.toast("Couldn't load settings.", "error");
      }
      this.settingsOverlay.hidden = false;
    }

    closeSettings() {
      this.settingsOverlay.hidden = true;
    }

    async saveSettings() {
      const payload = {
        provider: this.providerSelect.value,
        base_url: this.baseUrlInput.value.trim(),
        api_key: this.apiKeyInput.value.trim(),
        chat_models: this.modelsInput.value.trim(),
        default_model: this.defaultModelInput.value.trim(),
      };
      this.settingsSave.disabled = true;
      try {
        await this.request(API.settings, {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify(payload),
        });
        this.closeSettings();
        this.toast("Settings saved.", "success");
        await this.loadModels(); // refresh the picker with the new model list
      } catch (error) {
        console.error(error);
        this.toast(error.message || "Couldn't save settings.", "error");
      } finally {
        this.settingsSave.disabled = false;
      }
    }

    /* ----- profile ----- */

    bindProfile() {
      if (!this.profileBtn) return;
      this.profileBtn.addEventListener("click", () => this.openProfile());
      this.profileClose.addEventListener("click", () => this.closeProfile());
      this.profileCancel.addEventListener("click", () => this.closeProfile());
      this.profileOverlay.addEventListener("click", (event) => {
        if (event.target === this.profileOverlay) this.closeProfile();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !this.profileOverlay.hidden) {
          this.closeProfile();
        }
      });
      // Live-preview the avatar initials as the display name is typed.
      this.displayNameInput.addEventListener("input", () => {
        const name = this.displayNameInput.value.trim() || this.profileEmailFallback;
        this.profileAvatar.textContent = initialsFrom(name);
      });
      this.profileSave.addEventListener("click", () => this.saveProfile());
    }

    async openProfile() {
      this.setUserMenuOpen(false);
      try {
        const p = await this.request(API.profile);
        this.profileEmailFallback = (p.email || "").split("@")[0];
        this.displayNameInput.value = p.display_name || "";
        this.usernameInput.value = p.username || "";
        this.profileAvatar.textContent = p.initials || "?";
      } catch (error) {
        console.error(error);
        this.toast("Couldn't load profile.", "error");
      }
      this.profileOverlay.hidden = false;
      this.displayNameInput.focus();
    }

    closeProfile() {
      this.profileOverlay.hidden = true;
    }

    async saveProfile() {
      this.profileSave.disabled = true;
      try {
        const p = await this.request(API.profile, {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify({
            display_name: this.displayNameInput.value.trim(),
            username: this.usernameInput.value.trim(),
          }),
        });
        this.userChipAvatar.textContent = p.initials;
        this.userChipName.textContent = p.name;
        this.userMenuAvatar.textContent = p.initials;
        this.userMenuName.textContent = p.name;
        this.closeProfile();
        this.toast("Profile saved.", "success");
      } catch (error) {
        console.error(error);
        this.toast(error.message || "Couldn't save profile.", "error");
      } finally {
        this.profileSave.disabled = false;
      }
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
      // Detached, not destroyed — newChat() puts it back with its
      // suggestion-button listeners intact.
      this.welcome.remove();
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
          body: JSON.stringify({
            message: text,
            conversation_id: this.conversationId,
            model: this.model,
          }),
        });
        const isNewConversation = this.conversationId === null;
        this.conversationId = answer.conversation_id;
        await this.typeOut(content, answer.content);
        if (isNewConversation) {
          await this.loadConversations();
        }
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
      this.menuBtn.addEventListener("click", () => {
        this.sidebar.classList.toggle("sidebar--open");
        this.sidebarOverlay.classList.toggle(
          "visible",
          this.sidebar.classList.contains("sidebar--open")
        );
      });
      this.sidebarOverlay.addEventListener("click", () => this.closeDrawers());

      this.sidebarToggle.addEventListener("click", () => {
        const collapsed = this.sidebar.classList.toggle("sidebar--collapsed");
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
      });
      if (!this.isMobile() && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true") {
        this.sidebar.classList.add("sidebar--collapsed");
      }
    }

    closeDrawers() {
      this.sidebar.classList.remove("sidebar--open");
      this.historyPanel.classList.remove("history--open");
      this.sidebarOverlay.classList.remove("visible");
    }

    /* ----- user menu ----- */

    bindUserMenu() {
      this.userMenuBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        this.setUserMenuOpen(this.userMenu.hidden);
      });

      document.addEventListener("click", (event) => {
        if (!this.userMenu.hidden && !this.userMenu.contains(event.target)) {
          this.setUserMenuOpen(false);
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !this.userMenu.hidden) {
          this.setUserMenuOpen(false);
          this.userMenuBtn.focus();
        }
      });
    }

    setUserMenuOpen(open) {
      this.userMenu.hidden = !open;
      this.userMenuBtn.setAttribute("aria-expanded", String(open));
    }

    /* ----- chat history ----- */

    bindHistory() {
      this.historyToggle.addEventListener("click", () => this.toggleHistory());
      this.historyClose.addEventListener("click", () => this.closeDrawers());
      this.newChatBtn.addEventListener("click", () => this.newChat());

      if (!this.isMobile() && localStorage.getItem(HISTORY_VISIBLE_KEY) === "false") {
        this.historyPanel.classList.add("history--hidden");
      }
    }

    toggleHistory() {
      if (this.isMobile()) {
        const open = this.historyPanel.classList.toggle("history--open");
        this.sidebar.classList.remove("sidebar--open");
        this.sidebarOverlay.classList.toggle("visible", open);
      } else {
        const hidden = this.historyPanel.classList.toggle("history--hidden");
        localStorage.setItem(HISTORY_VISIBLE_KEY, String(!hidden));
      }
    }

    async loadConversations() {
      try {
        const conversations = await this.request(API.conversations);
        this.renderConversations(conversations);
      } catch (error) {
        console.error(error);
      }
    }

    renderConversations(conversations) {
      this.historyList.innerHTML = "";
      this.historyEmpty.hidden = conversations.length > 0;

      for (const conversation of conversations) {
        const item = document.createElement("li");
        item.className = "history-item";
        item.dataset.id = String(conversation.id);
        if (conversation.id === this.conversationId) {
          item.classList.add("history-item--active");
        }

        const body = document.createElement("div");
        body.className = "history-item-body";
        const title = document.createElement("div");
        title.className = "history-item-title";
        title.textContent = conversation.title;
        const date = document.createElement("div");
        date.className = "history-item-date";
        date.textContent = new Date(conversation.created_at).toLocaleDateString(
          undefined,
          { month: "short", day: "numeric" }
        );
        body.append(title, date);

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "history-delete";
        deleteBtn.type = "button";
        deleteBtn.title = "Delete conversation";
        deleteBtn.textContent = "✕";
        deleteBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          if (deleteBtn.classList.contains("confirm")) {
            this.deleteConversation(conversation.id);
          } else {
            deleteBtn.classList.add("confirm");
            deleteBtn.textContent = "Sure?";
            setTimeout(() => {
              deleteBtn.classList.remove("confirm");
              deleteBtn.textContent = "✕";
            }, 2500);
          }
        });

        item.append(body, deleteBtn);
        item.addEventListener("click", () => this.openConversation(conversation.id));
        this.historyList.appendChild(item);
      }
    }

    async openConversation(id) {
      if (this.pending || id === this.conversationId) {
        if (this.isMobile()) this.closeDrawers();
        return;
      }
      try {
        const messages = await this.request(`${API.conversations}/${id}`);
        this.conversationId = id;
        this.hideWelcome();
        this.thread.innerHTML = "";
        for (const message of messages) {
          if (message.role === "user") {
            this.addUserMessage(message.content);
          } else {
            const { content } = this.addAssistantMessage();
            content.innerHTML = renderMarkdown(message.content);
          }
        }
        this.markActiveConversation();
        this.scrollToBottom(true);
        if (this.isMobile()) this.closeDrawers();
        this.input.focus();
      } catch (error) {
        console.error(error);
        this.toast("Couldn't load that conversation.", "error");
      }
    }

    markActiveConversation() {
      this.historyList.querySelectorAll(".history-item").forEach((item) => {
        item.classList.toggle(
          "history-item--active",
          Number(item.dataset.id) === this.conversationId
        );
      });
    }

    newChat() {
      if (this.pending) return;
      this.conversationId = null;
      this.thread.innerHTML = "";
      this.thread.appendChild(this.welcome);
      this.markActiveConversation();
      if (this.isMobile()) this.closeDrawers();
      this.input.focus();
    }

    async deleteConversation(id) {
      try {
        await this.request(`${API.conversations}/${id}`, { method: "DELETE" });
        if (id === this.conversationId) {
          this.newChat();
        }
        await this.loadConversations();
        this.toast("Conversation deleted.", "success");
      } catch (error) {
        console.error(error);
        this.toast("Couldn't delete the conversation.", "error");
      }
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
