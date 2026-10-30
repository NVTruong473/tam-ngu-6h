import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "1";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const githubBase = isGitHubPages && repositoryName ? `/${repositoryName}` : "";

const config: NextConfig = {
  output: isGitHubPages ? "export" : undefined,
  trailingSlash: true,
  basePath: githubBase,
  assetPrefix: githubBase || undefined,
};

export default config;
