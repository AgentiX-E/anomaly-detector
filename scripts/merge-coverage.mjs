#!/usr/bin/env node

/**
 * merge-coverage.mjs — combines coverage reports from all anomaly-detector packages
 * into a single monorepo-level report, matching the timesfm-ts pattern.
 *
 * Usage: node scripts/merge-coverage.mjs
 *
 * Reads coverage from:
 *   packages/anomaly-detector-core/coverage/
 *   packages/anomaly-detector-node/coverage/
 *   packages/anomaly-detector-web/coverage/
 *
 * Writes combined report to: coverage/ (repository root)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PACKAGES = ['anomaly-detector-core', 'anomaly-detector-node', 'anomaly-detector-web']
const COVERAGE_OUT = join(ROOT, 'coverage')

/** Ensure directory exists */
function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

/**
 * Copy a directory recursively.
 */
function copyDir(src, dest) {
  ensureDir(dest)
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry)
    const destPath = join(dest, entry)
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      writeFileSync(destPath, readFileSync(srcPath))
    }
  }
}

/**
 * Merge multiple lcov.info files into one.
 * Adjusts SF paths to include the package name for disambiguation.
 */
function mergeLcov(lcovFiles, prefixMap) {
  const lines = []
  for (const [i, file] of lcovFiles.entries()) {
    if (!existsSync(file)) continue
    const prefix = prefixMap[i]
    const content = readFileSync(file, 'utf-8')
    for (const line of content.split('\n')) {
      if (line.startsWith('SF:')) {
        const originalPath = line.slice(3)
        // Resolve the path to be relative to the monorepo root
        const pkgDir = join(ROOT, 'packages', prefix)
        const absolutePath = join(pkgDir, originalPath)
        lines.push(`SF:${prefix}/${originalPath}`)
      } else {
        lines.push(line)
      }
    }
  }
  return lines.join('\n')
}

/**
 * Build a combined index.html linking to each package's detailed report
 * and showing aggregate coverage stats.
 */
function buildIndexHtml() {
  // Collect per-package stats from lcov files
  const pkgStats = []
  for (const pkg of PACKAGES) {
    const lcovPath = join(ROOT, 'packages', pkg, 'coverage', 'lcov.info')
    let linesFound = 0, linesHit = 0
    let branchesFound = 0, branchesHit = 0
    let functionsFound = 0, functionsHit = 0

    if (existsSync(lcovPath)) {
      const content = readFileSync(lcovPath, 'utf-8')
      for (const line of content.split('\n')) {
        if (line.startsWith('LF:')) linesFound += Number(line.slice(3))
        if (line.startsWith('LH:')) linesHit += Number(line.slice(3))
        if (line.startsWith('BRF:')) branchesFound += Number(line.slice(4))
        if (line.startsWith('BRH:')) branchesHit += Number(line.slice(4))
        if (line.startsWith('FNF:')) functionsFound += Number(line.slice(4))
        if (line.startsWith('FNH:')) functionsHit += Number(line.slice(4))
      }
    }

    const linePct = linesFound > 0 ? ((linesHit / linesFound) * 100).toFixed(1) : 'N/A'
    const branchPct = branchesFound > 0 ? ((branchesHit / branchesFound) * 100).toFixed(1) : 'N/A'
    const funcPct = functionsFound > 0 ? ((functionsHit / functionsFound) * 100).toFixed(1) : 'N/A'

    pkgStats.push({
      name: pkg,
      lines: `${linePct}%`,
      branches: `${branchPct}%`,
      functions: `${funcPct}%`,
      linesRatio: `${linesHit}/${linesFound}`,
      branchesRatio: `${branchesHit}/${branchesFound}`,
      functionsRatio: `${functionsHit}/${functionsFound}`,
    })
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>@agentix-e/anomaly-detector — Coverage Report</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a2e; }
  h1 { border-bottom: 2px solid #2563eb; padding-bottom: .5rem; }
  h2 { margin-top: 2rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #e5e7eb; padding: .6rem .8rem; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  tr:hover { background: #f9fafb; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .green { color: #16a34a; font-weight: 600; }
  .yellow { color: #ca8a04; font-weight: 600; }
  code { background: #f3f4f6; padding: .15rem .3rem; border-radius: 3px; font-size: .9em; }
</style>
</head>
<body>
<h1>@agentix-e/anomaly-detector — Coverage Report</h1>

<p>Combined coverage report for all anomaly-detector packages.</p>

<h2>Per-Package Coverage</h2>
<table>
<tr>
  <th>Package</th>
  <th>Lines</th>
  <th>Branches</th>
  <th>Functions</th>
  <th>Report</th>
</tr>
${pkgStats.map(s => `
<tr>
  <td><code>@agentix-e/${s.name}</code></td>
  <td class="${parseFloat(s.lines) >= 95 ? 'green' : parseFloat(s.lines) >= 80 ? 'yellow' : ''}">${s.lines} <small>(${s.linesRatio})</small></td>
  <td class="${parseFloat(s.branches) >= 95 ? 'green' : parseFloat(s.branches) >= 80 ? 'yellow' : ''}">${s.branches} <small>(${s.branchesRatio})</small></td>
  <td class="${parseFloat(s.functions) >= 95 ? 'green' : parseFloat(s.functions) >= 80 ? 'yellow' : ''}">${s.functions} <small>(${s.functionsRatio})</small></td>
  <td><a href="${s.name}/lcov-report/index.html">lcov →</a></td>
</tr>`).join('')}
</table>

<h2>How Coverage Works</h2>
<ul>
  <li><strong>anomaly-detector-core</strong>: The core engine with detection, forecasting, calibration, attribution, drift detection, and visualization. Target: &ge;95%.</li>
  <li><strong>anomaly-detector-node</strong>: Node.js TimesFM adapter — thin wrapper using dynamic <code>import()</code>. Tests cover adapter creation, configuration, and graceful degradation.</li>
  <li><strong>anomaly-detector-web</strong>: Browser TimesFM adapter — standalone module using dynamic <code>import()</code> with bundler-safe variable paths. Tests cover adapter creation, configuration, and browser compatibility.</li>
</ul>

</body>
</html>`
}

// ── Main ──

function main() {
  ensureDir(COVERAGE_OUT)

  // 1. Copy per-package lcov-report directories
  for (const pkg of PACKAGES) {
    const src = join(ROOT, 'packages', pkg, 'coverage', 'lcov-report')
    const dest = join(COVERAGE_OUT, pkg, 'lcov-report')
    if (existsSync(src)) {
      copyDir(src, dest)
      console.log(`[merge-coverage] Copied ${pkg}/lcov-report`)
    } else {
      console.log(`[merge-coverage] WARNING: ${pkg}/coverage/lcov-report not found (tests may have failed)`)
    }
  }

  // 2. Merge lcov.info files
  const lcovFiles = PACKAGES.map(p => join(ROOT, 'packages', p, 'coverage', 'lcov.info'))
  const mergedLcov = mergeLcov(lcovFiles, PACKAGES)
  writeFileSync(join(COVERAGE_OUT, 'lcov.info'), mergedLcov)
  console.log('[merge-coverage] Merged lcov.info')

  // 3. Build combined index.html
  const indexHtml = buildIndexHtml()
  writeFileSync(join(COVERAGE_OUT, 'index.html'), indexHtml)
  console.log('[merge-coverage] Built combined index.html')

  console.log('[merge-coverage] ✅ Done')
}

main()
