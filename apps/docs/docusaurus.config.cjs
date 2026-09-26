module.exports = {
  title: "SEC EDGAR Client",
  tagline: "Public SEC data with visible lineage",
  url: "https://rayterion.github.io",
  baseUrl: "/sec_edgar_api/",
  trailingSlash: false,
  onBrokenLinks: "throw",
  markdown: { mermaid: true, hooks: { onBrokenMarkdownLinks: "throw" } },
  themes: ["@docusaurus/theme-mermaid"],
  favicon: undefined,
  organizationName: "rayterion",
  projectName: "sec_edgar_api",
  presets: [
    [
      "classic",
      {
        docs: { routeBasePath: "/", sidebarPath: "./sidebars.cjs" },
        blog: false,
        theme: { customCss: "./src/css/custom.css" },
      },
    ],
  ],
  themeConfig: {
    navbar: {
      title: "SEC EDGAR Client",
      items: [{ to: "/", label: "Docs", position: "left" }],
    },
    footer: {
      style: "dark",
      copyright: "Unofficial SEC EDGAR client. MIT licensed.",
    },
  },
};
