import fs from "fs";
import path from "path";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import container from "markdown-it-container";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.join(__dirname, "content");
const TEMPLATE_DIR = path.join(__dirname, "templates");
const DIST_DIR = path.join(__dirname, "dist");

if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });

const indexTemplate = fs.readFileSync(path.join(TEMPLATE_DIR, "index.html"), "utf-8");
const stylesDir = path.join(TEMPLATE_DIR, "styles");
const styleFiles = fs.readdirSync(stylesDir)
  .filter(f => f.endsWith(".css"))
  .sort();
const styles = styleFiles
  .map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(stylesDir, f), "utf-8"))
  .join("\n\n");
const appJs = fs.readFileSync(path.join(TEMPLATE_DIR, "app.js"), "utf-8");

/* =========================================================
   Markdown-it 配置
   ========================================================= */
const md = new MarkdownIt({
  html: true,
  breaks: true,      // 段落内单换行 → <br>
  linkify: false,
  typographer: false,
});

// 注册自定义容器：::: formula / ::: figure / ::: compare / ::: steps
const containers = [
  { name: "formula", cls: "p-formula-inline" },
  { name: "figure",  cls: "p-figure" },
  { name: "compare", cls: "p-compare" },
  { name: "steps",   cls: "p-steps" },
];

containers.forEach(({ name, cls }) => {
  md.use(container, name, {
    render(tokens, idx) {
      if (tokens[idx].nesting === 1) {
        return `<div class="${cls}">\n`;
      }
      return `</div>\n`;
    }
  });
});

/* =========================================================
   工具函数
   ========================================================= */
function langDisplay(lang) {
  const map = { cpp: "C++", c: "C", python: "Python", py: "Python", js: "JavaScript" };
  return map[lang.toLowerCase()] || lang.toUpperCase();
}

/* =========================================================
   自定义渲染规则
   ========================================================= */

// fence（```lang ... ```）—— 代码块
// 覆盖默认渲染，加语言标识
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const lang = token.info.trim().split(/\s+/)[0] || "";
  const code = token.content;
  // 默认输出简洁代码块，不产生 div
  return `<pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>`;
};

// code_inline（`xxx`）—— 行内代码
md.renderer.rules.code_inline = (tokens, idx) => {
  return `<code>${escapeHtml(tokens[idx].content)}</code>`;
};

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* =========================================================
   Markdown → 结构化 HTML
   ========================================================= */
function renderContent(mdText) {
  // 用 markdown-it 解析，代码块天然独立
  let html = md.render(mdText);

  // 处理 `## xxx` 标题区块（把连续内容包进对应容器）
  // 这是过渡方案：未来可用 ::: 容器替代

  // ## 题目
  html = html.replace(
    /<h2[^>]*>题目<\/h2>([\s\S]*?)(?=<h2|$)/g,
    (m, inner) =>
      `<div class="p-question"><div class="p-question-label">今日题目</div><div class="p-question-text">${inner.trim()}</div></div>`
  );

  // ## 图形
  html = html.replace(
    /<h2[^>]*>图形<\/h2>\s*<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g,
    (m, figure) =>
      `<div class="p-figure"><div class="p-figure-label">图形</div><div class="p-figure-body"><pre>${figure.trimEnd()}</pre></div></div>`
  );

  // ## 输入输出样例
  html = html.replace(
    /<h2[^>]*>输入输出样例<\/h2>([\s\S]*?)(?=<h2|$)/g,
    (m, inner) => {
      const tables = inner.match(/<table>[\s\S]*?<\/table>/g) || [];
      if (tables.length === 0) return '';
      const cards = tables.map((table, idx) => {
        const cells = [...table.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => x[1].trim());
        if (cells.length < 2) return '';
        const title = tables.length > 1
          ? `<div class="p-sample-title">样例 #${idx + 1}</div>`
          : '';
        return `
          <div class="p-sample">
            ${title}
            <div class="p-sample-grid">
              <div class="p-sample-col p-sample-in">
                <div class="p-sample-col-label">输入</div>
                <pre>${cells[0]}</pre>
              </div>
              <div class="p-sample-arrow">→</div>
              <div class="p-sample-col p-sample-out">
                <div class="p-sample-col-label">输出</div>
                <pre>${cells[1]}</pre>
              </div>
            </div>
          </div>
        `;
      }).join('');
      return `<div class="p-samples">${cards}</div>`;
    }
  );

  // ## 对比
  html = html.replace(
    /<h2[^>]*>对比<\/h2>\s*<table>([\s\S]*?)<\/table>/g,
    (m, tableContent) => {
      const theadMatch = tableContent.match(/<thead>([\s\S]*?)<\/thead>/);
if (!theadMatch) return '';
const firstTrMatch = theadMatch[1].match(/<tr>([\s\S]*?)<\/tr>/);
if (!firstTrMatch) return '';
const headers = [...firstTrMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(x => x[1].trim());
      const tbodyMatch = tableContent.match(/<tbody>([\s\S]*?)<\/tbody>/);
      if (!tbodyMatch || headers.length < 2) return '';
      const dataRows = [...tbodyMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
      const cols = headers.map(() => []);
      dataRows.forEach(row => {
        const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => x[1].trim());
        cells.forEach((c, i) => { if (cols[i]) cols[i].push(c); });
      });
      const colCls = ['p-compare-left', 'p-compare-right'];
      return `<div class="p-compare">${
        headers.map((h, i) => `
          <div class="p-compare-col ${colCls[i] || ''}">
            <div class="p-compare-header">${h}</div>
            ${cols[i].map(line => `<div class="p-compare-line">${line}</div>`).join('')}
          </div>
        `).join('')
      }</div>`;
    }
  );
  // ## 追踪
  html = html.replace(
    /<h2[^>]*>追踪<\/h2>\s*<table>([\s\S]*?)<\/table>/g,
    (m, tableContent) => {
      // 从 thead 里提取第一个 tr，只取这一行的 th
      const theadMatch = tableContent.match(/<thead>([\s\S]*?)<\/thead>/);
      if (!theadMatch) return '';
      const firstTrMatch = theadMatch[1].match(/<tr>([\s\S]*?)<\/tr>/);
      if (!firstTrMatch) return '';
      const headers = [...firstTrMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(x => x[1].trim());

      // 从 tbody 里提取所有数据行
      const tbodyMatch = tableContent.match(/<tbody>([\s\S]*?)<\/tbody>/);
      if (!tbodyMatch) return '';
      const rows = [...tbodyMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(row =>
        [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => x[1].trim())
      );

      return `<div class="p-trace">
        <div class="p-trace-label">执行追踪</div>
        <table class="p-trace-table">
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>`;
    }
  );

  // ## 思考方式
  html = html.replace(
    /<h2[^>]*>思考方式<\/h2>([\s\S]*?)(?=<h2|$)/g,
    (m, inner) => {
      let stepIdx = 0;
      const processed = inner.replace(
        /<h3[^>]*>([^<]+)<\/h3>([\s\S]*?)(?=<h3|<h2|$)/g,
        (mm, label, body) => {
          stepIdx++;
          return `<div class="p-step" data-index="${stepIdx}"><div class="p-step-label">${label}</div><div class="p-step-text">${body.trim()}</div></div>`;
        }
      );
      return `<div class="p-thinking"><div class="p-thinking-label">思考方式</div>${processed}</div>`;
    }
  );

  // ## 代码
  html = html.replace(
    /<h2[^>]*>代码<\/h2>\s*<pre><code[^>]*class="language-(\w+)"[^>]*>([\s\S]*?)<\/code><\/pre>/g,
    (m, lang, code) =>
      `<div class="p-code-label">关键代码</div><div class="p-code"><div class="p-code-head"><span class="p-code-dot p-code-dot-r"></span><span class="p-code-dot p-code-dot-y"></span><span class="p-code-dot p-code-dot-g"></span><span class="p-code-title">${langDisplay(lang)}</span></div><pre><code class="language-${lang}">${code}</code></pre></div>`
  );

  // ## 知识扩展
  html = html.replace(
    /<h2[^>]*>知识扩展<\/h2>\s*<ul>([\s\S]*?)<\/ul>/g,
    '<div class="p-extend"><div class="p-extend-label">知识扩展</div><ul class="p-extend-list">$1</ul></div>'
  );

  return html;
}

/* =========================================================
   构建
   ========================================================= */
function walk(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else if (entry.name.endsWith(".md")) result.push(full);
  }
  return result;
}

const files = walk(CONTENT_DIR).sort();

const lessons = files.map(file => {
  const raw = fs.readFileSync(file, "utf-8");
  const { data, content } = matter(raw);

  const basename = path.basename(file);
  const fileMatch = basename.match(/^(\d+)/);
  const dayNum = fileMatch ? parseInt(fileMatch[1], 10) : parseInt(data.day, 10);
  const dayStr = String(dayNum).padStart(3, "0");

  return {
    ...data,
    day: dayStr,
    dayNum: dayNum,
    slug: path.basename(file, ".md"),
    html: renderContent(content)
  };
});

lessons.sort((a, b) => a.dayNum - b.dayNum);

// 检测重复
const daySet = new Set();
const dupes = [];
lessons.forEach(l => {
  if (daySet.has(l.day)) dupes.push(l.day);
  daySet.add(l.day);
});
if (dupes.length) {
  console.warn("⚠️  发现重复的 day：" + dupes.join(", "));
}

const dataJson = JSON.stringify(lessons);
const finalHtml = indexTemplate
  .split("/* __STYLES__ */").join(styles)
  .split("/* __APP_JS__ */").join(appJs)
  .split("__DATA_JSON__").join(dataJson);

fs.writeFileSync(path.join(DIST_DIR, "index.html"), finalHtml, "utf-8");

const stats = fs.statSync(path.join(DIST_DIR, "index.html"));
const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
console.log(`构建完成：${lessons.length} 篇内容 → dist/index.html (${sizeMB} MB)`);

if (stats.size > 3 * 1024 * 1024) {
  console.warn("⚠️  文件已超过 3 MB，建议启用目录分页");
}