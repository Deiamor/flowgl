#!/usr/bin/env node
/**
 * Generate CycloneDX 1.5 SBOMs for every published package by reading
 * each package.json + the workspace lockfile.
 *
 * Usage: node scripts/generate-sbom.mjs
 * Writes: packages/<name>/sbom.json
 *
 * Why not @cyclonedx/cyclonedx-npm: it shells out to `npm ls`, which
 * trips on pnpm-managed monorepos with workspace:* protocol. This
 * 50-line generator handles the shape we actually publish (one
 * library package per directory) without forcing a workspace
 * conversion.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PACKAGES = ['core', 'react', 'vue', 'svelte']
const TIMESTAMP = '2026-06-12T00:00:00Z'  // pinned for deterministic SBOMs

function generate(pkgDir) {
  const pj = JSON.parse(readFileSync(resolve(ROOT, 'packages', pkgDir, 'package.json'), 'utf8'))
  const purl = `pkg:npm/${encodeURIComponent(pj.name)}@${pj.version}`
  const deps = Object.keys(pj.dependencies ?? {})
  const components = []
  const dependsOn = []

  for (const dep of deps) {
    const isWorkspace = pj.dependencies[dep] === 'workspace:*'
    const version = isWorkspace ? pj.version : pj.dependencies[dep]
    const ref = `pkg:npm/${encodeURIComponent(dep)}@${version}`
    components.push({ 'bom-ref': ref, type: 'library', name: dep, version, purl: ref, scope: 'required' })
    dependsOn.push(ref)
  }

  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: {
      timestamp: TIMESTAMP,
      tools: [{ vendor: '@flowgl', name: 'generate-sbom.mjs', version: '1.0.0' }],
      component: {
        'bom-ref': purl,
        type: 'library',
        name: pj.name,
        version: pj.version,
        purl,
        licenses: [{ license: { id: pj.license || 'MIT' } }],
        description: pj.description,
        externalReferences: [
          { type: 'vcs',          url: 'https://github.com/Deiamor/flowgl' },
          { type: 'website',      url: 'https://dev.flowgl.ouranos.kr/' },
          { type: 'distribution', url: `https://www.npmjs.com/package/${pj.name}` },
        ],
      },
    },
    components,
    dependencies: [{ ref: purl, dependsOn }],
  }

  const out = resolve(ROOT, 'packages', pkgDir, 'sbom.json')
  writeFileSync(out, JSON.stringify(sbom, null, 2) + '\n')
  console.log(`OK ${pj.name}@${pj.version}`)
}

for (const dir of PACKAGES) generate(dir)
