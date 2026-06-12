import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'flowgl',
  description: 'GPU-accelerated flowchart library — WebGL2, zero dependencies, framework-agnostic.',
  cleanUrls: true,
  lastUpdated: true,
  appearance: 'dark',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/mark.svg' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'flowgl' }],
    ['meta', { property: 'og:description', content: 'GPU-accelerated flowchart library — WebGL2, zero dependencies, framework-agnostic.' }],
    ['meta', { property: 'og:image', content: '/og-card.svg' }],
    ['meta', { property: 'og:url', content: 'https://docs.flowgl.ouranos.kr/' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],
  themeConfig: {
    logo: { light: '/logo.svg', dark: '/logo-dark.svg', alt: 'flowgl' },
    siteTitle: false,
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Deiamor/flowgl' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/@flowgl/core' },
    ],
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/Deiamor/flowgl/edit/master/docs/:path',
      text: 'Suggest an edit',
    },
    lastUpdated: { text: 'Last updated', formatOptions: { dateStyle: 'medium' } },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 flowgl maintainers',
    },
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/flowchart' },
      { text: 'Cookbook', link: '/cookbook/' },
      { text: 'Examples', link: '/examples/' },
      { text: 'Benchmarks', link: '/benchmarks' },
      { text: 'Showcase', link: '/showcase' },
      { text: 'Community', link: '/community' },
      {
        text: '0.9.1',
        items: [
          { text: 'Changelog', link: 'https://github.com/Deiamor/flowgl/blob/master/CHANGELOG.md' },
          { text: 'Roadmap', link: 'https://github.com/Deiamor/flowgl/blob/master/ROADMAP.md' },
          { text: 'Semver policy', link: 'https://github.com/Deiamor/flowgl/blob/master/SEMVER.md' },
          { text: 'Contributing', link: 'https://github.com/Deiamor/flowgl/blob/master/CONTRIBUTING.md' },
        ],
      },
      { text: 'Demo', link: 'https://dev.flowgl.ouranos.kr/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Getting started',
          items: [
            { text: 'Why flowgl', link: '/guide/why-flowgl' },
            { text: 'Install & first chart', link: '/guide/getting-started' },
            { text: 'Vanilla JS / TS', link: '/guide/vanilla' },
            { text: 'React', link: '/guide/react' },
            { text: 'Vue', link: '/guide/vue' },
            { text: 'Svelte', link: '/guide/svelte' },
          ],
        },
        {
          text: 'Core concepts',
          items: [
            { text: 'Renderers (WebGL2 + Canvas2D)', link: '/guide/renderers' },
            { text: 'Labels (CJK + multi-line)', link: '/guide/labels' },
            { text: 'Accessibility', link: '/guide/accessibility' },
            { text: 'Performance & atlas', link: '/guide/performance' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API reference',
          items: [
            { text: 'FlowChart', link: '/api/flowchart' },
          ],
        },
      ],
      '/cookbook/': [
        {
          text: 'Cookbook',
          items: [
            { text: 'Index', link: '/cookbook/' },
            { text: 'Auto-connect on drag', link: '/cookbook/auto-connect' },
            { text: 'Wire to state store', link: '/cookbook/state-store' },
            { text: 'Custom HTML node', link: '/cookbook/html-node' },
            { text: 'Animated layout', link: '/cookbook/animated-layout' },
            { text: 'Export → PDF via SVG', link: '/cookbook/svg-to-pdf' },
            { text: 'Server-side render (SSR)', link: '/cookbook/ssr' },
            { text: 'Validating untrusted JSON', link: '/cookbook/untrusted-json' },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Gallery', link: '/examples/' },
          ],
        },
      ],
    },
  },
})
