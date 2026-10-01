import { Plugin } from "vite";

/**
 * Remove preconnect hints to services run by monkeytype from self hosted builds,
 * so browsers don't open connections to them.
 */
export function selfHostedHtml(options: { isSelfHosted: boolean }): Plugin {
  return {
    name: "self-hosted-html",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        if (!options.isSelfHosted) return html;
        return html.replace(/\s*<link\s+rel="preconnect"[^>]*>/g, "");
      },
    },
  };
}
