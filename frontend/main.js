const findBtn = document.getElementById("findBtn");
const replaceBtn = document.getElementById("replaceBtn");
const findReplacePanel = document.getElementById("findReplacePanel");
const findInput = document.getElementById("findInput");
const replaceInput = document.getElementById("replaceInput");
const findPrevBtn = document.getElementById("findPrevBtn");
const findNextBtn = document.getElementById("findNextBtn");
const findCloseBtn = document.getElementById("findCloseBtn");
const replaceOneBtn = document.getElementById("replaceOneBtn");
const replaceAllBtn = document.getElementById("replaceAllBtn");
const findStatus = document.getElementById("findStatus");

let findMatches = [];
let activeFindIndex = -1;

const editor = document.getElementById("editor");
const statusText = document.getElementById("statusText");
const docName = document.getElementById("docName");
const tableContextMenu = document.getElementById("tableContextMenu");
const imageContextMenu = document.getElementById("imageContextMenu");
const themeBtn = document.getElementById("themeBtn");
const zoomResetBtn = document.getElementById("zoomResetBtn");
const appMenu = document.getElementById("appMenu");
const menuBtn = document.getElementById("menuBtn");
const topbar = document.querySelector(".topbar");
const colorPicker = document.getElementById("colorPicker");
const applyColorBtn = document.getElementById("applyColorBtn");

let currentPath = "";
let currentTheme = localStorage.getItem("free-md-theme") || "light";
let zoomLevel = parseFloat(localStorage.getItem("free-md-zoom") || "1");
let currentTableCell = null;
let currentImage = null;
let savedRange = null;
let currentChosenColor = localStorage.getItem("free-md-color") || "#ff9800";
let layoutObserver = null;

/* ---------------- helpers ---------------- */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clearFindHighlights() {
  if (!editor) return;

  const hits = editor.querySelectorAll("mark.find-hit");
  hits.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize();
  });

  findMatches = [];
  activeFindIndex = -1;
}

function getTextNodes(root) {
  const nodes = [];
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        const parentTag = node.parentElement?.tagName?.toUpperCase();
        if (["SCRIPT", "STYLE"].includes(parentTag)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.parentElement?.closest?.("mark.find-hit")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let node;
  while ((node = walker.nextNode())) {
    nodes.push(node);
  }
  return nodes;
}

function updateFindStatus() {
  if (!findStatus) return;

  if (!findInput?.value) {
    findStatus.textContent = "0 match";
    return;
  }

  if (findMatches.length === 0) {
    findStatus.textContent = "No matches";
    return;
  }

  findStatus.textContent = `${activeFindIndex + 1} of ${findMatches.length}`;
}

function focusFindMatch(index) {
  if (!findMatches.length) return;

  if (index < 0) index = findMatches.length - 1;
  if (index >= findMatches.length) index = 0;

  activeFindIndex = index;

  findMatches.forEach((el) => el.classList.remove("find-hit--active"));

  const target = findMatches[activeFindIndex];
  if (!target) return;

  target.classList.add("find-hit--active");
  target.scrollIntoView({ block: "center", behavior: "smooth" });

  updateFindStatus();
}

function highlightFindResults(term) {
  const keepFocus = document.activeElement;

  clearFindHighlights();

  if (!term || !term.trim()) {
    updateFindStatus();
    if (keepFocus === findInput || keepFocus === replaceInput) {
      requestAnimationFrame(() => keepFocus.focus());
    }
    return;
  }

  const textNodes = getTextNodes(editor);
  const regex = new RegExp(escapeRegExp(term), "gi");

  textNodes.forEach((textNode) => {
    const text = textNode.nodeValue;
    regex.lastIndex = 0;
    if (!regex.test(text)) return;
    regex.lastIndex = 0;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index);
      if (before) fragment.appendChild(document.createTextNode(before));

      const mark = document.createElement("mark");
      mark.className = "find-hit";
      mark.textContent = match[0];
      fragment.appendChild(mark);
      findMatches.push(mark);

      lastIndex = match.index + match[0].length;
    }

    const after = text.slice(lastIndex);
    if (after) fragment.appendChild(document.createTextNode(after));

    textNode.parentNode.replaceChild(fragment, textNode);
  });

  if (findMatches.length > 0) {
    focusFindMatch(0);
  } else {
    activeFindIndex = -1;
    updateFindStatus();
  }

  if (keepFocus === findInput || keepFocus === replaceInput) {
    requestAnimationFrame(() => keepFocus.focus());
  }
}

function findNext() {
  if (!findMatches.length) return;
  focusFindMatch(activeFindIndex + 1);
  if (document.activeElement !== findInput && document.activeElement !== replaceInput) {
    findInput?.focus();
  }
}

function findPrev() {
  if (!findMatches.length) return;
  focusFindMatch(activeFindIndex - 1);
  if (document.activeElement !== findInput && document.activeElement !== replaceInput) {
    findInput?.focus();
  }
}

function openFindPanel(showReplace = false) {
  if (!findReplacePanel) return;

  findReplacePanel.hidden = false;

  const replaceRow = replaceInput?.closest(".find-panel__row");
  if (replaceRow) {
    replaceRow.style.display = showReplace ? "flex" : "none";
  }

  requestAnimationFrame(() => {
    findInput?.focus();
    findInput?.select();
  });
}

function closeFindPanel() {
  if (!findReplacePanel) return;
  findReplacePanel.hidden = true;
  clearFindHighlights();
  updateFindStatus();
  focusEditor();
}

function replaceCurrent() {
  if (!findMatches.length || activeFindIndex < 0) return;

  const replacement = replaceInput?.value || "";
  const target = findMatches[activeFindIndex];
  if (!target) return;

  target.replaceWith(document.createTextNode(replacement));
  highlightFindResults(findInput?.value || "");
  replaceInput?.focus();
}

function replaceAllMatches() {
  const term = findInput?.value || "";
  if (!term) return;

  const replacement = replaceInput?.value || "";
  const regex = new RegExp(escapeRegExp(term), "gi");

  clearFindHighlights();

  const textNodes = getTextNodes(editor);
  textNodes.forEach((textNode) => {
    textNode.nodeValue = textNode.nodeValue.replace(regex, replacement);
  });

  highlightFindResults(findInput?.value || "");
  replaceInput?.focus();
}

function clearFormattingToPlain() {
  focusEditor();
  restoreSelection();

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    document.execCommand("removeFormat", false, null);
    document.execCommand("formatBlock", false, "p");
    saveSelection();
    return;
  }

  const range = sel.getRangeAt(0);
  const text = sel.toString();

  range.deleteContents();
  const p = document.createElement("p");
  p.textContent = text;
  range.insertNode(p);

  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(p);
  sel.addRange(newRange);

  focusEditor();
  saveSelection();
  setStatus("Plain text");
}

function setStatus(message) {
  if (statusText) statusText.textContent = message || "Ready";
}

function setDocName(name) {
  if (docName) docName.textContent = name || "Untitled.md";
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function focusEditor() {
  editor.focus();
}

function saveTheme(theme) {
  localStorage.setItem("free-md-theme", theme);
}

function saveZoom(level) {
  localStorage.setItem("free-md-zoom", String(level));
}

function updateThemeButton() {
  if (!themeBtn) return;
  themeBtn.textContent = currentTheme === "dark" ? "☀" : "🌙";
}

function applyTheme(theme) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(theme);
  currentTheme = theme;
  saveTheme(theme);
  updateThemeButton();
}

function toggleTheme() {
  applyTheme(currentTheme === "dark" ? "light" : "dark");
}

function applyZoom(level) {
  zoomLevel = Math.max(0.5, Math.min(2.5, level));
  editor.style.zoom = String(zoomLevel);
  if (zoomResetBtn) {
    zoomResetBtn.textContent = `${Math.round(zoomLevel * 100)}%`;
  }
  saveZoom(zoomLevel);
}

function zoomIn() {
  applyZoom(zoomLevel + 0.1);
}

function zoomOut() {
  applyZoom(zoomLevel - 0.1);
}

function zoomReset() {
  applyZoom(1);
}

function saveSelection() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;
  savedRange = range.cloneRange();
}

function restoreSelection() {
  if (!savedRange) return false;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedRange);
  return true;
}

function exec(command, value = null) {
  focusEditor();
  restoreSelection();
  document.execCommand("styleWithCSS", false, true);
  document.execCommand(command, false, value);
  focusEditor();
  saveSelection();
}

function insertHTML(html) {
  focusEditor();
  restoreSelection();
  document.execCommand("insertHTML", false, html);
  focusEditor();
  saveSelection();
}

function applyBlock(block) {
  focusEditor();
  restoreSelection();

  const map = {
    P: "p",
    H1: "h1",
    H2: "h2",
    H3: "h3",
    H4: "h4",
    BLOCKQUOTE: "blockquote",
  };

  const tag = map[block];
  if (!tag) return;

  document.execCommand("formatBlock", false, tag);
  focusEditor();
  saveSelection();
}

function setChosenColor(color) {
  currentChosenColor = color;
  localStorage.setItem("free-md-color", color);
  if (colorPicker) colorPicker.value = color;
}

function applyChosenColor() {
  focusEditor();
  restoreSelection();
  document.execCommand("styleWithCSS", false, true);
  document.execCommand("foreColor", false, currentChosenColor);
  focusEditor();
  saveSelection();
}

function insertDivider() {
  insertHTML("<hr><p><br></p>");
}

function insertLink() {
  focusEditor();
  restoreSelection();

  const url = prompt("Enter URL", "https://example.com");
  if (!url) return;

  const selection = window.getSelection();
  const text = selection && selection.toString() ? selection.toString() : "Link";
  document.execCommand("insertHTML", false, `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`);
  focusEditor();
  saveSelection();
}

async function insertImage() {
  focusEditor();
  restoreSelection();

  const src = prompt("Enter image URL or file path", "image.png");
  if (!src) return;

  const alt = prompt("Enter alt text (optional)", "") ?? "";

  let displaySrc = src;
  let dataPath = "";

  if (isLocalPath(src)) {
    try {
      const app = await ensureBackend();
      const dataUrl = await app.ReadFileAsDataURL(src);
      if (dataUrl) {
        displaySrc = dataUrl;
        dataPath = src;
      }
    } catch (e) {
      setStatus("Could not load image: " + (e.message || e));
    }
  }

  const dataAttr = dataPath ? ` data-path="${escapeHtml(dataPath)}"` : "";
  document.execCommand("insertHTML", false,
    `<img alt="${escapeHtml(alt)}" src="${escapeHtml(displaySrc)}"${dataAttr} style="max-width:100%"><p><br></p>`);
  focusEditor();
  saveSelection();
  setStatus("Image inserted");
}

function insertInlineCode() {
  focusEditor();
  restoreSelection();

  const selection = window.getSelection();
  const text = selection && selection.toString() ? selection.toString() : "code";

  const hasMultiLine = /[\r\n]/.test(text);

  if (hasMultiLine) {
    document.execCommand(
      "insertHTML",
      false,
      `<code style="white-space: pre-wrap;">${escapeHtml(text)}</code>`
    );
  } else {
    document.execCommand(
      "insertHTML",
      false,
      `<code>${escapeHtml(text)}</code>`
    );
  }

  focusEditor();
  saveSelection();
}

function insertCodeBlock() {
  focusEditor();
  restoreSelection();

  const selection = window.getSelection();
  const text = selection && selection.toString() ? selection.toString() : "code";

  document.execCommand(
    "insertHTML",
    false,
    `<pre><code>${escapeHtml(text)}</code></pre><p><br></p>`
  );

  focusEditor();
  saveSelection();
}

function insertTable() {
  insertHTML(`
    <table>
      <thead>
        <tr>
          <th>Header 1</th>
          <th>Header 2</th>
          <th>Header 3</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><br></td>
          <td><br></td>
          <td><br></td>
        </tr>
      </tbody>
    </table>
    <p><br></p>
  `);
  setStatus("Table inserted");
}

function indentList() {
  exec("indent");
}

function outdentList() {
  exec("outdent");
}

function makeNewFile() {
  editor.innerHTML = "<p><br></p>";
  currentPath = "";
  setDocName("Untitled.md");
  setStatus("New file");
  focusEditor();
  saveSelection();
}

/* ---------------- table context ---------------- */

function hideTableContextMenu() {
  if (!tableContextMenu) return;
  tableContextMenu.hidden = true;
  currentTableCell = null;
}

function hideImageContextMenu() {
  if (!imageContextMenu) return;
  imageContextMenu.hidden = true;
  currentImage = null;
}

function showImageContextMenu(x, y, img) {
  if (!imageContextMenu) return;
  currentImage = img;
  imageContextMenu.hidden = false;
  imageContextMenu.style.left = `${x}px`;
  imageContextMenu.style.top = `${y}px`;
}

function removeImage() {
  if (!currentImage) return;
  currentImage.remove();
  hideImageContextMenu();
  setStatus("Image removed");
}

function showTableContextMenu(x, y, cell) {
  if (!tableContextMenu) return;
  currentTableCell = cell;
  tableContextMenu.hidden = false;
  tableContextMenu.style.left = `${x}px`;
  tableContextMenu.style.top = `${y}px`;
}

function getActiveTable() {
  return currentTableCell ? currentTableCell.closest("table") : null;
}

function insertRowAbove() {
  if (!currentTableCell) return;
  const row = currentTableCell.parentElement;
  const clone = row.cloneNode(true);
  clone.querySelectorAll("td, th").forEach((cell) => {
    cell.innerHTML = cell.tagName === "TH" ? "Header" : "<br>";
  });
  row.parentElement.insertBefore(clone, row);
  hideTableContextMenu();
}

function insertRowBelow() {
  if (!currentTableCell) return;
  const row = currentTableCell.parentElement;
  const clone = row.cloneNode(true);
  clone.querySelectorAll("td, th").forEach((cell) => {
    cell.innerHTML = cell.tagName === "TH" ? "Header" : "<br>";
  });
  row.parentElement.insertBefore(clone, row.nextSibling);
  hideTableContextMenu();
}

function deleteRow() {
  if (!currentTableCell) return;
  const row = currentTableCell.parentElement;
  const section = row.parentElement;
  if (section.children.length <= 1) {
    setStatus("Cannot delete the last row");
    hideTableContextMenu();
    return;
  }
  row.remove();
  hideTableContextMenu();
}

function insertColLeft() {
  if (!currentTableCell) return;
  const table = getActiveTable();
  const index = currentTableCell.cellIndex;

  Array.from(table.rows).forEach((row) => {
    const refCell = row.children[index] || null;
    const inHead = row.parentElement.tagName === "THEAD";
    const tag = inHead ? "th" : "td";
    const cell = document.createElement(tag);
    cell.innerHTML = inHead ? "Header" : "<br>";
    row.insertBefore(cell, refCell);
  });

  hideTableContextMenu();
}

function insertColRight() {
  if (!currentTableCell) return;
  const table = getActiveTable();
  const index = currentTableCell.cellIndex;

  Array.from(table.rows).forEach((row) => {
    const refCell = row.children[index + 1] || null;
    const inHead = row.parentElement.tagName === "THEAD";
    const tag = inHead ? "th" : "td";
    const cell = document.createElement(tag);
    cell.innerHTML = inHead ? "Header" : "<br>";
    row.insertBefore(cell, refCell);
  });

  hideTableContextMenu();
}

function deleteCol() {
  if (!currentTableCell) return;
  const table = getActiveTable();
  const index = currentTableCell.cellIndex;

  if (!table || !table.rows.length || table.rows[0].cells.length <= 1) {
    setStatus("Cannot delete the last column");
    hideTableContextMenu();
    return;
  }

  Array.from(table.rows).forEach((row) => {
    if (row.cells[index]) row.deleteCell(index);
  });

  hideTableContextMenu();
}

/* ---------------- markdown import/export ---------------- */

function parseInlineMarkdown(text) {

  // allow span color tag
  text = text.replace(
    /<span\s+style="color:[^"]+">(.+?)<\/span>/gi,
    (m) => m
  );

  let html = escapeHtml(text);

  // restore span color tag
  html = html.replace(
    /&lt;span\s+style="color:([^"]+)"&gt;(.+?)&lt;\/span&gt;/gi,
    '<span style="color:$1">$2</span>'
  );

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img alt="${alt}" src="${src}" style="max-width:100%">`);
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return html;
}

function isTableSeparatorLine(line) {
  const t = line.trim();
  return /^\|?(\s*:?-+:?\s*\|)+\s*$/.test(t);
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(s => s.trim());
}

function markdownToHtml(md) {
  if (!md || !md.trim()) return "<p><br></p>";

  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmedStart = line.trimStart();

    if (/^\s*$/.test(line)) {
      html.push("<p><br></p>");
      i++;
      continue;
    }

    if (/^---+$/.test(trimmedStart.trim())) {
      html.push("<hr>");
      i++;
      continue;
    }

    if (/^```/.test(trimmedStart)) {
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trimStart())) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^####\s+/.test(trimmedStart)) {
      html.push(`<h4>${parseInlineMarkdown(trimmedStart.replace(/^####\s+/, ""))}</h4>`);
      i++;
      continue;
    }
    if (/^###\s+/.test(trimmedStart)) {
      html.push(`<h3>${parseInlineMarkdown(trimmedStart.replace(/^###\s+/, ""))}</h3>`);
      i++;
      continue;
    }
    if (/^##\s+/.test(trimmedStart)) {
      html.push(`<h2>${parseInlineMarkdown(trimmedStart.replace(/^##\s+/, ""))}</h2>`);
      i++;
      continue;
    }
    if (/^#\s+/.test(trimmedStart)) {
      html.push(`<h1>${parseInlineMarkdown(trimmedStart.replace(/^#\s+/, ""))}</h1>`);
      i++;
      continue;
    }

    if (/^>\s+/.test(trimmedStart)) {
      html.push(`<blockquote>${parseInlineMarkdown(trimmedStart.replace(/^>\s+/, ""))}</blockquote>`);
      i++;
      continue;
    }

    if (
      trimmedStart.startsWith("|") &&
      i + 1 < lines.length &&
      isTableSeparatorLine(lines[i + 1].trimStart())
    ) {
      const headerCells = splitTableRow(trimmedStart);
      i += 2;

      const rows = [];
      while (i < lines.length && lines[i].trimStart().startsWith("|")) {
        rows.push(splitTableRow(lines[i].trimStart()));
        i++;
      }

      let tableHtml = "<table><thead><tr>";
      headerCells.forEach((cell) => {
        tableHtml += `<th>${parseInlineMarkdown(cell)}</th>`;
      });
      tableHtml += "</tr></thead><tbody>";

      rows.forEach((row) => {
        tableHtml += "<tr>";
        headerCells.forEach((_, colIndex) => {
          const cell = row[colIndex] ?? "";
          tableHtml += `<td>${parseInlineMarkdown(cell) || "<br>"}</td>`;
        });
        tableHtml += "</tr>";
      });

      tableHtml += "</tbody></table>";
      html.push(tableHtml);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const raw = lines[i];
        const indent = raw.match(/^(\s*)/)[1].length;
        const text = raw.replace(/^\s*[-*]\s+/, "");
        items.push({ indent, text });
        i++;
      }

      let out = "";
      let level = 0;

      items.forEach((item) => {
        const targetLevel = Math.floor(item.indent / 2);
        while (level < targetLevel + 1) {
          out += "<ul>";
          level++;
        }
        while (level > targetLevel + 1) {
          out += "</ul>";
          level--;
        }
        out += `<li>${parseInlineMarkdown(item.text)}</li>`;
      });

      while (level > 0) {
        out += "</ul>";
        level--;
      }

      html.push(out);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const raw = lines[i];
        const indent = raw.match(/^(\s*)/)[1].length;
        const text = raw.replace(/^\s*\d+\.\s+/, "");
        items.push({ indent, text });
        i++;
      }

      let out = "";
      let level = 0;

      items.forEach((item) => {
        const targetLevel = Math.floor(item.indent / 2);
        while (level < targetLevel + 1) {
          out += "<ol>";
          level++;
        }
        while (level > targetLevel + 1) {
          out += "</ol>";
          level--;
        }
        out += `<li>${parseInlineMarkdown(item.text)}</li>`;
      });

      while (level > 0) {
        out += "</ol>";
        level--;
      }

      html.push(out);
      continue;
    }

    html.push(`<p>${parseInlineMarkdown(trimmedStart)}</p>`);
    i++;
  }

  return html.join("");
}

function nodeInlineToMarkdown(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const tag = node.tagName.toUpperCase();

  if (tag === "STRONG" || tag === "B") {
    return `**${Array.from(node.childNodes).map(nodeInlineToMarkdown).join("")}**`;
  }
  if (tag === "EM" || tag === "I") {
    return `*${Array.from(node.childNodes).map(nodeInlineToMarkdown).join("")}*`;
  }
  if (tag === "S" || tag === "STRIKE") {
    return `~~${Array.from(node.childNodes).map(nodeInlineToMarkdown).join("")}~~`;
  }
  if (tag === "CODE" && node.parentElement?.tagName !== "PRE") {
    return `\`${node.textContent}\``;
  }
  if (tag === "A") {
    const text = Array.from(node.childNodes).map(nodeInlineToMarkdown).join("") || node.textContent || "Link";
    const href = node.getAttribute("href") || "";
    return `[${text}](${href})`;
  }
  if (tag === "IMG") {
    const alt = node.getAttribute("alt") || "";
    // Prefer the original local path stored in data-path over a potentially huge data URL.
    const src = node.dataset.path || node.getAttribute("src") || "";
    return `![${alt}](${src})`;
  }
  if (tag === "SPAN" && node.style.color) {
    return `<span style="color:${node.style.color};">${Array.from(node.childNodes).map(nodeInlineToMarkdown).join("")}</span>`;
  }

  return Array.from(node.childNodes).map(nodeInlineToMarkdown).join("");
}

function blockToMarkdown(node, level = 0) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent.trim();
    return text ? `${text}\n\n` : "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const tag = node.tagName.toUpperCase();

  if (tag === "H1") return `# ${Array.from(node.childNodes).map(nodeInlineToMarkdown).join("").trim()}\n\n`;
  if (tag === "H2") return `## ${Array.from(node.childNodes).map(nodeInlineToMarkdown).join("").trim()}\n\n`;
  if (tag === "H3") return `### ${Array.from(node.childNodes).map(nodeInlineToMarkdown).join("").trim()}\n\n`;
  if (tag === "H4") return `#### ${Array.from(node.childNodes).map(nodeInlineToMarkdown).join("").trim()}\n\n`;
  if (tag === "P") return `${Array.from(node.childNodes).map(nodeInlineToMarkdown).join("").trim()}\n\n`;
  if (tag === "BLOCKQUOTE") return `> ${Array.from(node.childNodes).map(nodeInlineToMarkdown).join("").trim()}\n\n`;
  if (tag === "HR") return `---\n\n`;

  if (tag === "PRE") {
    const code = node.textContent || "";
    return `\`\`\`\n${code.replace(/\n$/, "")}\n\`\`\`\n\n`;
  }

  if (tag === "UL") {
    let out = "";
    Array.from(node.children).forEach((li) => {
      if (li.tagName.toUpperCase() !== "LI") return;

      const childParts = [];
      const nestedParts = [];

      Array.from(li.childNodes).forEach((child) => {
        if (
          child.nodeType === Node.ELEMENT_NODE &&
          (child.tagName.toUpperCase() === "UL" || child.tagName.toUpperCase() === "OL")
        ) {
          nestedParts.push(blockToMarkdown(child, level + 1));
        } else {
          childParts.push(nodeInlineToMarkdown(child));
        }
      });

      out += `${"  ".repeat(level)}- ${childParts.join("").trim()}\n`;
      nestedParts.forEach((n) => {
        out += n;
      });
    });
    return `${out}\n`;
  }

  if (tag === "OL") {
    let out = "";
    let index = 1;
    Array.from(node.children).forEach((li) => {
      if (li.tagName.toUpperCase() !== "LI") return;

      const childParts = [];
      const nestedParts = [];

      Array.from(li.childNodes).forEach((child) => {
        if (
          child.nodeType === Node.ELEMENT_NODE &&
          (child.tagName.toUpperCase() === "UL" || child.tagName.toUpperCase() === "OL")
        ) {
          nestedParts.push(blockToMarkdown(child, level + 1));
        } else {
          childParts.push(nodeInlineToMarkdown(child));
        }
      });

      out += `${"  ".repeat(level)}${index}. ${childParts.join("").trim()}\n`;
      nestedParts.forEach((n) => {
        out += n;
      });
      index++;
    });
    return `${out}\n`;
  }

  if (tag === "TABLE") {
    const rows = Array.from(node.querySelectorAll("tr"));
    if (!rows.length) return "";

    const matrix = rows.map((row) =>
      Array.from(row.children).map((cell) =>
        Array.from(cell.childNodes).map(nodeInlineToMarkdown).join("").trim()
      )
    );

    const header = matrix[0];
    const body = matrix.slice(1);

    let out = `| ${header.join(" | ")} |\n`;
    out += `| ${header.map(() => "---").join(" | ")} |\n`;
    body.forEach((row) => {
      out += `| ${row.join(" | ")} |\n`;
    });
    return `${out}\n`;
  }

  return Array.from(node.childNodes).map((child) => blockToMarkdown(child, level)).join("");
}

function htmlToMarkdown(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;

  let md = "";
  Array.from(temp.childNodes).forEach((node) => {
    md += blockToMarkdown(node);
  });

  return md.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/* ---------------- backend ---------------- */

async function ensureBackend() {
  for (let i = 0; i < 50; i++) {
    if (window.go && window.go.main && window.go.main.App) {
      return window.go.main.App;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Wails backend not ready");
}

/**
 * Returns true when `src` is a local filesystem path (not a web URL or data URL).
 */
function isLocalPath(src) {
  if (!src) return false;
  if (/^(https?|data|blob):/i.test(src)) return false;
  if (src.startsWith("//")) return false;
  return true;
}

/**
 * For every <img> in `container` whose src is a local filesystem path,
 * ask the backend to convert it to a base64 data URL and swap it in.
 * The original path is preserved in data-path so the markdown exporter can use it.
 */
async function resolveLocalImages(container, app) {
  const images = Array.from(container.querySelectorAll("img"));
  for (const img of images) {
    const src = img.getAttribute("src") || "";
    if (!isLocalPath(src)) continue;
    try {
      const dataUrl = await app.ReadFileAsDataURL(src);
      if (dataUrl) {
        img.dataset.path = src;
        img.src = dataUrl;
      }
    } catch (e) {
      console.warn("Could not load local image:", src, e);
    }
  }
}

async function openFile() {
  try {
    const app = await ensureBackend();
    const result = await app.OpenMarkdownFile();

    if (!result || result.cancelled === "true") {
      setStatus("Open cancelled");
      return;
    }

    currentPath = result.path || "";
    setDocName(result.name || "Untitled.md");
    editor.innerHTML = markdownToHtml(result.content || "");
    await resolveLocalImages(editor, app);
    setStatus("Opened");
    focusEditor();
    saveSelection();
  } catch (err) {
    console.error(err);
    setStatus(`Open failed: ${err.message || err}`);
  }
}

async function saveFile() {
  try {
    const app = await ensureBackend();
    const markdown = htmlToMarkdown(editor.innerHTML);
    const result = await app.SaveMarkdownFile(markdown);

    if (result?.name) setDocName(result.name);
    if (result?.path) currentPath = result.path;
    setStatus("Saved");
  } catch (err) {
    console.error(err);
    setStatus(`Save failed: ${err.message || err}`);
  }
}

async function saveFileAs() {
  try {
    const app = await ensureBackend();
    const markdown = htmlToMarkdown(editor.innerHTML);
    const result = await app.SaveMarkdownFileAs(markdown);

    if (result?.name) setDocName(result.name);
    if (result?.path) currentPath = result.path;
    setStatus("Saved As");
  } catch (err) {
    console.error(err);
    setStatus(`Save As failed: ${err.message || err}`);
  }
}

function syncLayoutMetrics() {
  if (!topbar) return;

  const height = Math.ceil(topbar.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--topbar-height", `${height}px`);
}

function bindLayoutMetrics() {
  syncLayoutMetrics();
  window.addEventListener("resize", syncLayoutMetrics);

  if (typeof ResizeObserver !== "undefined" && topbar) {
    layoutObserver = new ResizeObserver(syncLayoutMetrics);
    layoutObserver.observe(topbar);
  }
}

/* ---------------- bindings ---------------- */

function bindToolbar() {
  findBtn?.addEventListener("click", () => openFindPanel(false));
  replaceBtn?.addEventListener("click", () => openFindPanel(true));

  document.getElementById("plainBtn")?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    saveSelection();
  });
  document.getElementById("plainBtn")?.addEventListener("click", clearFormattingToPlain);

  document.querySelectorAll("[data-cmd]").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      saveSelection();
    });
    btn.addEventListener("click", () => {
      const cmd = btn.dataset.cmd;
      if (cmd) exec(cmd);
    });
  });

  document.querySelectorAll("[data-block]").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      saveSelection();
    });
    btn.addEventListener("click", () => {
      const block = btn.dataset.block;
      if (block) applyBlock(block);
    });
  });

  document.getElementById("codeInlineBtn")?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    saveSelection();
  });
  document.getElementById("codeInlineBtn")?.addEventListener("click", insertInlineCode);

  document.getElementById("codeBlockBtn")?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    saveSelection();
  });
  document.getElementById("codeBlockBtn")?.addEventListener("click", insertCodeBlock);

  document.getElementById("hrBtn")?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    saveSelection();
  });
  document.getElementById("hrBtn")?.addEventListener("click", insertDivider);

  document.getElementById("linkBtn")?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    saveSelection();
  });
  document.getElementById("linkBtn")?.addEventListener("click", insertLink);

  document.getElementById("imageBtn")?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    saveSelection();
  });
  document.getElementById("imageBtn")?.addEventListener("click", insertImage);

  document.getElementById("tableBtn")?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    saveSelection();
  });
  document.getElementById("tableBtn")?.addEventListener("click", insertTable);

  document.getElementById("indentBtn")?.addEventListener("click", indentList);
  document.getElementById("outdentBtn")?.addEventListener("click", outdentList);

  colorPicker?.addEventListener("input", (e) => {
    setChosenColor(e.target.value);
  });

  applyColorBtn?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    saveSelection();
  });
  applyColorBtn?.addEventListener("click", applyChosenColor);

  document.getElementById("zoomInBtn")?.addEventListener("click", zoomIn);
  document.getElementById("zoomOutBtn")?.addEventListener("click", zoomOut);
  document.getElementById("zoomResetBtn")?.addEventListener("click", zoomReset);
  document.getElementById("themeBtn")?.addEventListener("click", toggleTheme);
}

function bindFindReplace() {
  findInput?.addEventListener("input", () => {
    highlightFindResults(findInput.value);
  });

  findInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) findPrev();
      else findNext();
    }
  });

  replaceInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      replaceCurrent();
    }
  });

  findPrevBtn?.addEventListener("click", findPrev);
  findNextBtn?.addEventListener("click", findNext);
  findCloseBtn?.addEventListener("click", closeFindPanel);
  replaceOneBtn?.addEventListener("click", replaceCurrent);
  replaceAllBtn?.addEventListener("click", replaceAllMatches);
}

function bindMenu() {
  menuBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    appMenu.hidden = !appMenu.hidden;
  });

  document.getElementById("menuNew")?.addEventListener("click", () => {
    makeNewFile();
    appMenu.hidden = true;
  });

  document.getElementById("menuOpen")?.addEventListener("click", async () => {
    await openFile();
    appMenu.hidden = true;
  });

  document.getElementById("menuSave")?.addEventListener("click", async () => {
    await saveFile();
    appMenu.hidden = true;
  });

  document.getElementById("menuSaveAs")?.addEventListener("click", async () => {
    await saveFileAs();
    appMenu.hidden = true;
  });

  document.addEventListener("click", (e) => {
    if (appMenu && !appMenu.contains(e.target) && e.target !== menuBtn) {
      appMenu.hidden = true;
    }
  });
}

function bindEditor() {
  editor.addEventListener("mouseup", saveSelection);
  editor.addEventListener("keyup", saveSelection);
  editor.addEventListener("focus", saveSelection);

  editor.addEventListener("mouseover", (e) => {
    const link = e.target.closest("a");
    if (link) {
      link.title = "Ctrl+Click open the link";
    }
  });

  editor.addEventListener("click", async (e) => {
    const link = e.target.closest("a");
    if (!link) return;

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      try {
        const url = link.getAttribute("href");
        if (url) {
          const app = await ensureBackend();
          if (app.OpenExternalURL) {
            await app.OpenExternalURL(url);
          } else {
            window.open(url, "_blank");
          }
        }
      } catch (err) {
        console.error(err);
        setStatus(`Open link failed: ${err.message || err}`);
      }
    }
  });



  editor.addEventListener("contextmenu", (e) => {
    // Image right-click
    if (e.target.tagName === "IMG") {
      e.preventDefault();
      hideTableContextMenu();
      showImageContextMenu(e.pageX, e.pageY, e.target);
      return;
    }
    hideImageContextMenu();

    const cell = e.target.closest("td, th");
    if (!cell) {
      hideTableContextMenu();
      return;
    }
    e.preventDefault();
    showTableContextMenu(e.pageX, e.pageY, cell);
  });

  document.addEventListener("click", (e) => {
    if (tableContextMenu && !tableContextMenu.contains(e.target)) {
      hideTableContextMenu();
    }
    if (imageContextMenu && !imageContextMenu.contains(e.target)) {
      hideImageContextMenu();
    }
  });

  tableContextMenu?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-table-action]");
    if (!btn) return;

    const action = btn.dataset.tableAction;
    if (action === "row-above") insertRowAbove();
    if (action === "row-below") insertRowBelow();
    if (action === "row-delete") deleteRow();
    if (action === "col-left") insertColLeft();
    if (action === "col-right") insertColRight();
    if (action === "col-delete") deleteCol();
  });

  imageContextMenu?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-image-action]");
    if (!btn) return;
    if (btn.dataset.imageAction === "remove") removeImage();
  });

  window.addEventListener("keydown", async (e) => {
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key.toLowerCase() === "f") {
      e.preventDefault();
      openFindPanel(false);
      return;
    }

    if (mod && e.key.toLowerCase() === "h") {
      e.preventDefault();
      openFindPanel(true);
      return;
    }

    
    if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (e.shiftKey) await saveFileAs();
      else await saveFile();
      return;
    }

    if (mod && e.key.toLowerCase() === "o") {
      e.preventDefault();
      await openFile();
      return;
    }

    if (mod && e.key.toLowerCase() === "n") {
      e.preventDefault();
      makeNewFile();
      return;
    }

    if (mod && (e.key === "+" || e.key === "=")) {
      e.preventDefault();
      zoomIn();
      return;
    }

    if (mod && e.key === "-") {
      e.preventDefault();
      zoomOut();
      return;
    }

    if (mod && e.key === "0") {
      e.preventDefault();
      zoomReset();
      return;
    }

    if (e.key === "Tab") {
      const sel = window.getSelection();
      const node = sel?.anchorNode;
      const li = node?.nodeType === 1
        ? node.closest?.("li")
        : node?.parentElement?.closest?.("li");

      if (li) {
        e.preventDefault();
        if (e.shiftKey) outdentList();
        else indentList();
      }
    }

    if (e.key === "Escape") {
      closeFindPanel();
      hideTableContextMenu();
      hideImageContextMenu();
      if (appMenu) appMenu.hidden = true;
    }
  });

  window.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) zoomIn();
        else zoomOut();
      }
    },
    { passive: false }
  );
}

/* ---------------- init ---------------- */

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(currentTheme);
  applyZoom(zoomLevel);
  setChosenColor(currentChosenColor);
  bindLayoutMetrics();
  bindToolbar();
  bindMenu();
  bindEditor();
  bindFindReplace();

  if (!editor.innerHTML.trim()) {
    editor.innerHTML = "<p><br></p>";
  }

  setStatus("Ready");

  try {
    const app = await ensureBackend();
    setStatus("Ready");

    // If the app was launched by double-clicking a .md file, open it automatically.
    const startup = await app.GetStartupFile();
    if (startup && !startup.cancelled && startup.path) {
      currentPath = startup.path;
      setDocName(startup.name || "Untitled.md");
      editor.innerHTML = markdownToHtml(startup.content || "");
      await resolveLocalImages(editor, app);
      setStatus("Opened: " + (startup.name || startup.path));
      focusEditor();
      saveSelection();
    }
  } catch (err) {
    console.warn(err);
    setStatus("Ready (frontend only)");
  }
});