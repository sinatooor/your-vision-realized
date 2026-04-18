import jsPDF from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  LevelFormat,
  ImageRun,
} from "docx";
import { saveAs } from "file-saver";
import type { MemoSignOff } from "@/lib/memoChat";

const FIRM_NAME = "JurisdictIQ";
const FIRM_TAGLINE = "Cross-Border Legal Intelligence";

export interface MemoExportPayload {
  executiveSummary: string;
  memoMarkdown: string;
  signOff?: MemoSignOff | null;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function formatSignedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fileBase() {
  return `${FIRM_NAME}-Advisory-Memo-${dateStamp()}`;
}

function dataUrlToUint8Array(dataUrl: string): { bytes: Uint8Array; type: "png" | "jpg" } | null {
  const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const type = m[1].toLowerCase() === "png" ? "png" : "jpg";
  const binary = atob(m[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, type };
}

/* ---------------- Markdown parsing (lightweight) ---------------- */

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "hr" }
  | { type: "blockquote"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] };

function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Headings
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length as 1 | 2 | 3;
      blocks.push({ type: `h${level}` as "h1" | "h2" | "h3", text: h[2].trim() });
      i++;
      continue;
    }

    // Table
    if (line.includes("|") && i + 1 < lines.length && /^[\s|:-]+$/.test(lines[i + 1])) {
      const headers = line
        .split("|")
        .map((c) => c.trim())
        .filter((_, idx, arr) => !(idx === 0 && arr[0] === "") && !(idx === arr.length - 1 && arr[arr.length - 1] === ""));
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        const row = lines[i]
          .split("|")
          .map((c) => c.trim())
          .filter((_, idx, arr) => !(idx === 0 && arr[0] === "") && !(idx === arr.length - 1 && arr[arr.length - 1] === ""));
        rows.push(row);
        i++;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", text: buf.join(" ") });
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, "").trim());
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, "").trim());
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Paragraph (collect until blank/heading/list/table)
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].startsWith(">") &&
      !lines[i].includes("|")
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ type: "p", text: buf.join(" ") });
  }
  return blocks;
}

/** Strip basic inline markdown (bold/italic/code/links) for plain text rendering. */
function stripInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

/** Split inline text into runs preserving bold/italic/code. */
type InlineRun = { text: string; bold?: boolean; italic?: boolean; code?: boolean };
function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const re = /(\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|`([^`]+)`|\[([^\]]+)\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[2] || m[3]) runs.push({ text: m[2] || m[3], bold: true });
    else if (m[4] || m[5]) runs.push({ text: m[4] || m[5], italic: true });
    else if (m[6]) runs.push({ text: m[6], code: true });
    else if (m[7]) runs.push({ text: m[7] });
    last = re.lastIndex;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length ? runs : [{ text }];
}

/* ---------------- PDF Export ---------------- */

export function exportMemoAsPdf(memo: { executiveSummary: string; memoMarkdown: string }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 56;
  const marginTop = 72;
  const marginBottom = 64;
  const contentW = pageW - marginX * 2;
  let y = marginTop;

  // Brand colors
  const PRIMARY: [number, number, number] = [30, 41, 59]; // slate-800
  const MUTED: [number, number, number] = [100, 116, 139]; // slate-500
  const RULE: [number, number, number] = [203, 213, 225]; // slate-300

  function ensure(space: number) {
    if (y + space > pageH - marginBottom) {
      addFooter();
      doc.addPage();
      y = marginTop;
      addHeader();
    }
  }

  function addHeader() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PRIMARY);
    doc.text(FIRM_NAME.toUpperCase(), marginX, 40);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(FIRM_TAGLINE, marginX, 54);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.5);
    doc.line(marginX, 60, pageW - marginX, 60);
  }

  function addFooter() {
    const page = doc.getCurrentPageInfo().pageNumber;
    doc.setDrawColor(...RULE);
    doc.line(marginX, pageH - 48, pageW - marginX, pageH - 48);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${FIRM_NAME} — Advisory Memorandum`, marginX, pageH - 32);
    doc.text(`Page ${page}`, pageW - marginX, pageH - 32, { align: "right" });
    doc.text(dateStamp(), pageW / 2, pageH - 32, { align: "center" });
  }

  function writeText(text: string, opts: { size: number; bold?: boolean; color?: [number, number, number]; italic?: boolean; leading?: number; indent?: number }) {
    const { size, bold, color = PRIMARY, italic, leading = 1.35, indent = 0 } = opts;
    doc.setFont("helvetica", bold ? "bold" : italic ? "italic" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(stripInline(text), contentW - indent);
    const lh = size * leading;
    for (const ln of lines) {
      ensure(lh);
      doc.text(ln, marginX + indent, y);
      y += lh;
    }
  }

  // Header on first page
  addHeader();

  // Title
  y = marginTop + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...PRIMARY);
  doc.text("Advisory Memorandum", marginX, y);
  y += 10;
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(1.2);
  doc.line(marginX, y, marginX + 60, y);
  y += 22;

  // Executive Summary block
  doc.setFillColor(241, 245, 249); // slate-100
  const summaryLines = doc.splitTextToSize(stripInline(memo.executiveSummary), contentW - 24);
  const summaryH = summaryLines.length * 13 + 36;
  ensure(summaryH);
  doc.rect(marginX, y, contentW, summaryH, "F");
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(2);
  doc.line(marginX, y, marginX, y + summaryH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("EXECUTIVE SUMMARY", marginX + 12, y + 16);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...PRIMARY);
  let sy = y + 32;
  for (const ln of summaryLines) {
    doc.text(ln, marginX + 12, sy);
    sy += 13;
  }
  y += summaryH + 18;

  // Body
  const blocks = parseMarkdown(memo.memoMarkdown);
  for (const b of blocks) {
    switch (b.type) {
      case "h1":
        y += 6;
        writeText(b.text, { size: 16, bold: true });
        y += 4;
        break;
      case "h2":
        y += 8;
        writeText(b.text, { size: 13, bold: true });
        y += 2;
        break;
      case "h3":
        y += 6;
        writeText(b.text, { size: 11, bold: true });
        break;
      case "p":
        writeText(b.text, { size: 10 });
        y += 6;
        break;
      case "ul":
        for (const it of b.items) {
          ensure(14);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(...MUTED);
          doc.text("•", marginX + 4, y);
          writeText(it, { size: 10, indent: 16 });
        }
        y += 4;
        break;
      case "ol":
        b.items.forEach((it, idx) => {
          ensure(14);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(...MUTED);
          doc.text(`${idx + 1}.`, marginX + 4, y);
          writeText(it, { size: 10, indent: 20 });
        });
        y += 4;
        break;
      case "blockquote":
        ensure(20);
        doc.setDrawColor(...PRIMARY);
        doc.setLineWidth(2);
        const startY = y - 10;
        writeText(b.text, { size: 10, italic: true, indent: 14, color: MUTED });
        doc.line(marginX, startY, marginX, y - 4);
        y += 4;
        break;
      case "hr":
        ensure(12);
        doc.setDrawColor(...RULE);
        doc.setLineWidth(0.5);
        doc.line(marginX, y, marginX + contentW, y);
        y += 14;
        break;
      case "table": {
        const colW = contentW / b.headers.length;
        const rowH = 22;
        ensure(rowH);
        doc.setFillColor(241, 245, 249);
        doc.rect(marginX, y - 14, contentW, rowH, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...PRIMARY);
        b.headers.forEach((h, idx) => {
          doc.text(stripInline(h), marginX + idx * colW + 6, y);
        });
        y += rowH - 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        for (const row of b.rows) {
          // compute height for wrapped cells
          const cellLines = row.map((c) => doc.splitTextToSize(stripInline(c), colW - 12));
          const h = Math.max(...cellLines.map((l) => l.length)) * 11 + 8;
          ensure(h);
          doc.setDrawColor(...RULE);
          doc.setLineWidth(0.3);
          doc.line(marginX, y - 4, marginX + contentW, y - 4);
          cellLines.forEach((lines, idx) => {
            let cy = y + 4;
            for (const ln of lines) {
              doc.text(ln, marginX + idx * colW + 6, cy);
              cy += 11;
            }
          });
          y += h;
        }
        y += 8;
        break;
      }
    }
  }

  addFooter();
  doc.save(`${fileBase()}.pdf`);
}

/* ---------------- DOCX Export ---------------- */

export async function exportMemoAsDocx(memo: { executiveSummary: string; memoMarkdown: string }) {
  const inlineToRuns = (text: string, baseOpts: { bold?: boolean; italic?: boolean; size?: number; color?: string } = {}) =>
    parseInline(text).map(
      (r) =>
        new TextRun({
          text: r.text,
          bold: r.bold || baseOpts.bold,
          italics: r.italic || baseOpts.italic,
          font: r.code ? "Courier New" : "Calibri",
          size: baseOpts.size ?? 22,
          color: baseOpts.color,
        })
    );

  const blocks = parseMarkdown(memo.memoMarkdown);
  const children: Paragraph[] = [];

  // Firm letterhead
  children.push(
    new Paragraph({
      children: [new TextRun({ text: FIRM_NAME.toUpperCase(), bold: true, size: 22, color: "1E293B" })],
    }),
    new Paragraph({
      children: [new TextRun({ text: FIRM_TAGLINE, italics: true, size: 18, color: "64748B" })],
      border: { bottom: { color: "CBD5E1", space: 4, style: BorderStyle.SINGLE, size: 6 } },
      spacing: { after: 240 },
    })
  );

  // Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: "Advisory Memorandum", bold: true, size: 40, color: "1E293B" })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Date: ${dateStamp()}`, size: 20, color: "64748B" })],
      spacing: { after: 240 },
    })
  );

  // Executive Summary
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "EXECUTIVE SUMMARY", bold: true, size: 18, color: "64748B" })],
      shading: { type: "clear", fill: "F1F5F9", color: "auto" },
      border: { left: { color: "1E293B", space: 8, style: BorderStyle.SINGLE, size: 18 } },
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: inlineToRuns(memo.executiveSummary, { italic: true, size: 22 }),
      shading: { type: "clear", fill: "F1F5F9", color: "auto" },
      border: { left: { color: "1E293B", space: 8, style: BorderStyle.SINGLE, size: 18 } },
      spacing: { after: 360 },
    })
  );

  for (const b of blocks) {
    switch (b.type) {
      case "h1":
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: b.text, bold: true, size: 32, color: "1E293B" })],
            spacing: { before: 280, after: 140 },
          })
        );
        break;
      case "h2":
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: b.text, bold: true, size: 26, color: "1E293B" })],
            spacing: { before: 240, after: 120 },
          })
        );
        break;
      case "h3":
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun({ text: b.text, bold: true, size: 22, color: "1E293B" })],
            spacing: { before: 200, after: 100 },
          })
        );
        break;
      case "p":
        children.push(
          new Paragraph({
            children: inlineToRuns(b.text),
            spacing: { after: 120 },
            alignment: AlignmentType.JUSTIFIED,
          })
        );
        break;
      case "ul":
        for (const it of b.items) {
          children.push(
            new Paragraph({
              children: inlineToRuns(it),
              bullet: { level: 0 },
              spacing: { after: 60 },
            })
          );
        }
        break;
      case "ol":
        b.items.forEach((it) => {
          children.push(
            new Paragraph({
              children: inlineToRuns(it),
              numbering: { reference: "memo-ol", level: 0 },
              spacing: { after: 60 },
            })
          );
        });
        break;
      case "blockquote":
        children.push(
          new Paragraph({
            children: inlineToRuns(b.text, { italic: true, color: "64748B" }),
            border: { left: { color: "1E293B", space: 8, style: BorderStyle.SINGLE, size: 18 } },
            indent: { left: 360 },
            spacing: { after: 120 },
          })
        );
        break;
      case "hr":
        children.push(
          new Paragraph({
            children: [],
            border: { bottom: { color: "CBD5E1", space: 1, style: BorderStyle.SINGLE, size: 6 } },
            spacing: { after: 120 },
          })
        );
        break;
      case "table": {
        // Header row
        children.push(
          new Paragraph({
            children: [new TextRun({ text: b.headers.join("  •  "), bold: true, size: 20, color: "1E293B" })],
            shading: { type: "clear", fill: "F1F5F9", color: "auto" },
            spacing: { before: 120, after: 60 },
          })
        );
        for (const row of b.rows) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: row.join("  |  "), size: 20 })],
              spacing: { after: 40 },
            })
          );
        }
        children.push(new Paragraph({ children: [], spacing: { after: 120 } }));
        break;
      }
    }
  }

  const doc = new Document({
    creator: FIRM_NAME,
    title: "Advisory Memorandum",
    description: "AI-drafted advisory memorandum",
    numbering: {
      config: [
        {
          reference: "memo-ol",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${fileBase()}.docx`);
}

/* ---------------- Markdown Export ---------------- */

export function exportMemoAsMarkdown(memo: { memoMarkdown: string }) {
  const blob = new Blob([memo.memoMarkdown], { type: "text/markdown" });
  saveAs(blob, `${fileBase()}.md`);
}
