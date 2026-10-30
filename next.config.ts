import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "1";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const githubBase = isGitHubPages && repositoryName ? `/${repositoryName}` : "";

const config: NextConfig = {
  output: isGitHubPages ? "export" : undefined,
  trailingSlash: true,
  // vinext currently skips prerendering `/` when basePath is set. Pages already
  // mounts the artifact at /<repository>, so only static asset URLs need it.
  assetPrefix: githubBase || undefined,
};

export default config;
