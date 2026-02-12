import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const frontendDir = path.resolve(scriptDir, '..');
const repoDir = path.resolve(frontendDir, '..');
const sourceDir = path.resolve(frontendDir, 'src');
const reportPath = path.resolve(
  repoDir,
  'design-system',
  'tg-cloud-drive-v2',
  'UI-COPY-AUDIT-REPORT.zh-CN.md'
);
const isCheckMode = process.argv.includes('--check');

const FILE_EXTENSIONS = new Set(['.ts', '.tsx']);

const AUDIT_RULES = [
  {
    id: 'forbidden-vague-phrase',
    severity: 'high',
    pattern: /处理一下|调整配置/g,
    description: '禁用模糊表达',
    suggestion: '改为可执行动作，例如“保存设置”“立即清理”。',
  },
  {
    id: 'forbidden-technical-exposure',
    severity: 'high',
    pattern: /API\s*请求失败|执行\s*API/g,
    description: '禁用技术暴露文案',
    suggestion: '改为用户视角，例如“操作失败，请重试”。',
  },
  {
    id: 'forbidden-emotional-copy',
    severity: 'medium',
    pattern: /糟糕，出问题了/g,
    description: '禁用情绪化文案',
    suggestion: '改为中性结果表达，例如“操作失败，请稍后重试”。',
  },
  {
    id: 'terminology-faststart',
    severity: 'medium',
    pattern: /(^|[^a-zA-Z])FastStart([^a-zA-Z]|$)/g,
    description: '术语统一：FastStart -> 视频加速',
    suggestion: '统一替换为“视频加速”。',
  },
  {
    id: 'terminology-realtime-task',
    severity: 'low',
    pattern: /实时传输/g,
    description: '术语统一：实时传输 -> 实时任务',
    suggestion: '统一替换为“实时任务”。',
  },
  {
    id: 'terminology-history-record',
    severity: 'low',
    pattern: /历史任务/g,
    description: '术语统一：历史任务 -> 历史记录',
    suggestion: '统一替换为“历史记录”。',
  },
  {
    id: 'terminology-cleanup-policy',
    severity: 'low',
    pattern: /删除策略/g,
    description: '术语统一：删除策略 -> 清理策略（按上下文）',
    suggestion: '按场景替换为“源文件清理策略”或“清理策略”。',
  },
];

async function walkFiles(rootDir) {
  const queue = [rootDir];
  const result = [];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const absolutePath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }

      if (!FILE_EXTENSIONS.has(path.extname(entry.name))) continue;
      result.push(absolutePath);
    }
  }

  return result;
}

function extractStringLiterals(content) {
  const literals = [];
  const regex = /(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const raw = match[2];
    if (!raw) continue;

    const value = raw.replace(/\\n/g, '\n').trim();
    if (!value) continue;

    if (!/[\u4e00-\u9fff]/.test(value) && !/(^|[^a-zA-Z])FastStart([^a-zA-Z]|$)|API|删除策略|历史任务|实时传输/.test(value)) {
      continue;
    }

    literals.push({
      value,
      index: match.index,
    });
  }

  return literals;
}

function createLineIndex(content) {
  const lineBreakIndexes = [0];
  for (let i = 0; i < content.length; i += 1) {
    if (content[i] === '\n') lineBreakIndexes.push(i + 1);
  }
  return lineBreakIndexes;
}

function getLineNumber(lineIndex, offset) {
  let low = 0;
  let high = lineIndex.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const start = lineIndex[mid];
    const nextStart = mid + 1 < lineIndex.length ? lineIndex[mid + 1] : Number.MAX_SAFE_INTEGER;

    if (offset >= start && offset < nextStart) return mid + 1;
    if (offset < start) high = mid - 1;
    else low = mid + 1;
  }

  return 1;
}

function auditLiterals(filePath, literals) {
  const findings = [];

  for (const literal of literals) {
    for (const rule of AUDIT_RULES) {
      rule.pattern.lastIndex = 0;
      if (!rule.pattern.test(literal.value)) continue;

      findings.push({
        filePath,
        line: literal.line,
        text: literal.value,
        ruleId: rule.id,
        severity: rule.severity,
        description: rule.description,
        suggestion: rule.suggestion,
      });
    }
  }

  return findings;
}

function sortFindings(findings) {
  const severityOrder = { high: 0, medium: 1, low: 2 };

  return findings.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath, 'zh-CN');
    return a.line - b.line;
  });
}

function summarize(findings) {
  const bySeverity = { high: 0, medium: 0, low: 0 };
  const byRule = new Map();

  for (const item of findings) {
    bySeverity[item.severity] += 1;
    byRule.set(item.ruleId, (byRule.get(item.ruleId) || 0) + 1);
  }

  return { bySeverity, byRule };
}

function formatReport(findings, scannedFiles) {
  const now = new Date();
  const summary = summarize(findings);

  const lines = [];
  lines.push('# UI 文案自动巡检报告');
  lines.push('');
  lines.push(`- 生成时间：${now.toLocaleString('zh-CN', { hour12: false })}`);
  lines.push(`- 扫描范围：\`frontend/src\`（共 ${scannedFiles} 个文件）`);
  lines.push(`- 问题总数：${findings.length}`);
  lines.push(`- 严重级别：高 ${summary.bySeverity.high} / 中 ${summary.bySeverity.medium} / 低 ${summary.bySeverity.low}`);
  lines.push('');
  lines.push('## 规则命中统计');

  for (const rule of AUDIT_RULES) {
    const count = summary.byRule.get(rule.id) || 0;
    lines.push(`- ${rule.description}：${count}`);
  }

  lines.push('');
  lines.push('## 明细清单');

  if (findings.length === 0) {
    lines.push('- 未发现违规或术语不一致文案。');
    lines.push('');
    lines.push('## 结论');
    lines.push('- 当前文案与词典规则保持一致，可继续按既有规范新增文案。');
    return `${lines.join('\n')}\n`;
  }

  for (const item of findings) {
    const relativePath = path.relative(repoDir, item.filePath).split(path.sep).join('/');
    lines.push(`- [${item.severity.toUpperCase()}] ${item.description}`);
    lines.push(`  文件：\`${relativePath}:${item.line}\``);
    lines.push(`  文案：\`${item.text}\``);
    lines.push(`  建议：${item.suggestion}`);
  }

  lines.push('');
  lines.push('## 结论');
  lines.push('- 建议优先修复高优先级问题（模糊表达、技术暴露）。');
  lines.push('- 中低优先级问题可在组件迭代时统一替换，保持术语稳定。');

  return `${lines.join('\n')}\n`;
}

async function main() {
  const files = await walkFiles(sourceDir);
  const allFindings = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');
    const lineIndex = createLineIndex(content);
    const literals = extractStringLiterals(content).map((item) => ({
      ...item,
      line: getLineNumber(lineIndex, item.index),
    }));

    const findings = auditLiterals(filePath, literals);
    allFindings.push(...findings);
  }

  const deduplicated = sortFindings(
    Array.from(
      new Map(allFindings.map((item) => [`${item.filePath}:${item.line}:${item.ruleId}:${item.text}`, item])).values()
    )
  );

  if (isCheckMode) {
    console.log('文案巡检检查模式：仅校验，不写入报告');
    console.log(`扫描文件：${files.length}`);
    console.log(`发现问题：${deduplicated.length}`);
    if (deduplicated.length > 0) {
      console.log('请运行 npm run copy:audit 生成明细报告并修复问题。');
      process.exitCode = 1;
    }
    return;
  }

  const report = formatReport(deduplicated, files.length);
  await fs.writeFile(reportPath, report, 'utf8');

  console.log(`文案巡检完成，报告已生成：${path.relative(repoDir, reportPath)}`);
  console.log(`扫描文件：${files.length}`);
  console.log(`发现问题：${deduplicated.length}`);
}

main().catch((error) => {
  console.error('文案巡检失败：', error);
  process.exitCode = 1;
});
