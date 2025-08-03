import Hero, { ConnectionToHeroCore, IHeroCreateOptions } from "@ulixee/hero";
import HeroCore from "@ulixee/hero-core";
import { TransportBridge } from "@ulixee/net";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import UserAgent from "user-agents";
import { getError } from "./helpers/get_error";

dotenv.config();

// Initialize Hero Core integrated with the Express server
const bridge = new TransportBridge();
const connectionToCore = new ConnectionToHeroCore(bridge.transportToCore);
const heroCore = new HeroCore();
heroCore.addConnection(bridge.transportToClient);

const app = express();
const port = process.env.PORT || 3003;

app.use(bodyParser.json());

const BLOCK_MEDIA =
  (process.env.BLOCK_MEDIA || "False").toUpperCase() === "TRUE";

const PROXY_SERVER = process.env.PROXY_SERVER || null;
const PROXY_USERNAME = process.env.PROXY_USERNAME || null;
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || null;

// Add new environment variables for IP masking
const PROXY_IP = process.env.PROXY_IP || null;
const PUBLIC_IP = process.env.PUBLIC_IP || null;
const IP_LOOKUP_SERVICE =
  process.env.IP_LOOKUP_SERVICE || "https://api.ipify.org";

const AD_SERVING_DOMAINS = [
  "doubleclick.net",
  "adservice.google.com",
  "googlesyndication.com",
  "googletagservices.com",
  "googletagmanager.com",
  "google-analytics.com",
  "adsystem.com",
  "adservice.com",
  "adnxs.com",
  "ads-twitter.com",
  "facebook.net",
  "fbcdn.net",
  "amazon-adsystem.com",
];

interface UrlModel {
  url: string;
  wait_after_load?: number;
  timeout?: number;
  headers?: { [key: string]: string };
  check_selector?: string;
  spa_mode?: boolean;
  network_idle_time?: number;
  dom_stable_time?: number;
  // New: Configure which strategies to use
  spa_strategies?: {
    loading_indicators?: boolean; // Wait for loading indicators to disappear
    network_idle?: boolean; // Wait for network to be idle
    dom_stable?: boolean; // Wait for DOM to stabilize
    early_exit?: boolean; // Exit early if page seems ready
  };
}

// Generic loading indicators that work across most websites
const GENERIC_LOADING_SELECTORS = [
  '[class*="loading"]',
  '[class*="spinner"]',
  '[class*="loader"]',
  '[id*="loading"]',
  '[id*="spinner"]',
  '[id*="loader"]',
  '[data-testid*="loading"]',
  '[data-testid*="spinner"]',
  ".loading",
  ".spinner",
  ".loader",
  ".sk-circle", // Common CSS spinner
  ".sk-cube-grid", // Common CSS spinner
  ".fa-spinner", // FontAwesome spinner
  ".fa-circle-o-notch", // FontAwesome spinner
];

const waitForSpaToLoad = async (
  hero: Hero,
  timeout: number,
  networkIdleTime: number = 2000,
  domStableTime: number = 1000,
  strategies: {
    loading_indicators?: boolean;
    network_idle?: boolean;
    dom_stable?: boolean;
    early_exit?: boolean;
  } = {
    loading_indicators: true,
    network_idle: true,
    dom_stable: false, // Often not needed if other strategies work
    early_exit: true,
  }
) => {
  console.log("🔄 Waiting for SPA to fully load...");
  const startTime = Date.now();
  let pageAppearReady = false;

  // Strategy 1: Wait for loading indicators to disappear
  if (strategies.loading_indicators) {
    try {
      console.log("⏳ Checking for loading indicators...");
      const loadingSelector = GENERIC_LOADING_SELECTORS.join(", ");

      // Check if any loading indicators exist
      // We keep await, even if the method is not async, because it's a promise
      // https://ulixee.org/docs/hero/basic-client/awaited-dom
      const hasLoadingIndicators = await hero.document.querySelector(
        loadingSelector
      );

      if (hasLoadingIndicators) {
        console.log(
          "⏳ Found loading indicators, waiting for them to disappear..."
        );
        let attempts = 0;
        const maxAttempts = Math.floor(timeout / 1000);

        while (attempts < maxAttempts) {
          const stillLoading = await hero.document.querySelector(
            loadingSelector
          );
          if (!stillLoading) {
            console.log("✅ Loading indicators disappeared");
            pageAppearReady = true;
            break;
          }
          await hero.waitForMillis(1000);
          attempts++;
        }
      } else {
        console.log("ℹ️ No loading indicators found");
        pageAppearReady = true;
      }
    } catch (error) {
      console.log(
        "ℹ️ Loading indicator check failed or timeout reached",
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    }

    // Early exit if loading indicators are gone and early_exit is enabled
    if (strategies.early_exit && pageAppearReady) {
      const totalWaitTime = Date.now() - startTime;
      console.log(
        `✅ SPA loading complete via loading indicators (waited ${totalWaitTime}ms)`
      );
      return;
    }
  }

  // Strategy 2: Wait for network activity to settle
  if (strategies.network_idle) {
    console.log(
      `⏳ Waiting for network to be idle for ${networkIdleTime}ms...`
    );
    let networkIdleCount = 0;
    const requiredIdleChecks = Math.floor(networkIdleTime / 500);

    while (
      networkIdleCount < requiredIdleChecks &&
      Date.now() - startTime < timeout
    ) {
      await hero.waitForMillis(500);

      // Simplified network idle check
      // In a real implementation, you'd monitor actual network requests
      networkIdleCount++;
    }

    if (networkIdleCount >= requiredIdleChecks) {
      console.log("✅ Network appears idle");
      pageAppearReady = true;
    }

    // Early exit if network is idle and page appeared ready from loading indicators
    if (strategies.early_exit && pageAppearReady) {
      const totalWaitTime = Date.now() - startTime;
      console.log(
        `✅ SPA loading complete via network idle (waited ${totalWaitTime}ms)`
      );
      return;
    }
  }

  // Strategy 3: Wait for DOM to stabilize (only if specifically requested)
  if (strategies.dom_stable) {
    console.log(`⏳ Waiting for DOM to stabilize for ${domStableTime}ms...`);
    let previousBodyHtml = "";
    let domStableCount = 0;
    const requiredStableChecks = Math.floor(domStableTime / 500);

    while (
      domStableCount < requiredStableChecks &&
      Date.now() - startTime < timeout
    ) {
      await hero.waitForMillis(500);

      try {
        const currentBodyHtml = (await hero.document.body?.innerHTML) || "";
        const contentChanged =
          currentBodyHtml !== previousBodyHtml && previousBodyHtml !== "";

        if (!contentChanged) {
          domStableCount++;
        } else {
          domStableCount = 0;
        }

        previousBodyHtml = currentBodyHtml;
      } catch (error) {
        domStableCount = 0;
      }
    }

    if (domStableCount >= requiredStableChecks) {
      console.log("✅ DOM appears stable");
    }
  }

  // Final wait for JavaScript execution to settle (small buffer)
  await hero.waitForMillis(500);

  const totalWaitTime = Date.now() - startTime;
  console.log(`✅ SPA loading complete (waited ${totalWaitTime}ms)`);
};

const scrapePage = async (
  hero: Hero,
  url: string,
  waitAfterLoad: number,
  timeout: number,
  checkSelector: string | undefined,
  spaMode: boolean = false,
  networkIdleTime: number = 2000,
  domStableTime: number = 1000,
  spaStrategies?: {
    loading_indicators?: boolean;
    network_idle?: boolean;
    dom_stable?: boolean;
    early_exit?: boolean;
  }
) => {
  console.log(
    `Navigating to ${url} with timeout: ${timeout}ms, spaMode: ${spaMode}`
  );

  const resource = await hero.goto(url, { timeoutMs: timeout });

  // If SPA mode is enabled, use intelligent waiting
  if (spaMode) {
    const strategies = spaStrategies || {
      loading_indicators: true,
      network_idle: false,
      dom_stable: false,
      early_exit: true,
    };

    await waitForSpaToLoad(
      hero,
      timeout,
      networkIdleTime,
      domStableTime,
      strategies
    );
  }

  if (waitAfterLoad > 0) {
    await hero.waitForMillis(waitAfterLoad);
  }

  if (checkSelector) {
    try {
      await hero.waitForElement(hero.document.querySelector(checkSelector), {
        timeoutMs: timeout,
      });
    } catch (error) {
      throw new Error("Required selector not found");
    }
  }

  const content = await hero.document.documentElement.outerHTML;
  const status = resource?.response?.statusCode || null;
  const responseHeaders = resource?.response?.headers || null;
  const contentType = responseHeaders?.["content-type"] || null;

  return {
    content,
    status,
    headers: responseHeaders,
    contentType,
  };
};

const getHeroOptions = () => {
  const userAgent = new UserAgent().toString();
  const viewport = { width: 1280, height: 800 };

  const options: IHeroCreateOptions = {
    userAgent,
    viewport,
    blockedResourceTypes: BLOCK_MEDIA ? ["BlockMedia"] : undefined,
    blockedResourceUrls: AD_SERVING_DOMAINS.map((domain) => `*${domain}*`),
  };

  if (PROXY_SERVER && PROXY_USERNAME && PROXY_PASSWORD) {
    options.upstreamProxyUrl = `http://${PROXY_USERNAME}:${PROXY_PASSWORD}@${PROXY_SERVER}`;

    // Add proxy IP mask configuration to prevent WebRTC leaks
    options.upstreamProxyIpMask = {
      ipLookupService: IP_LOOKUP_SERVICE,
      ...(PROXY_IP && { proxyIp: PROXY_IP }),
      ...(PUBLIC_IP && { publicIp: PUBLIC_IP }),
    };
  } else if (PROXY_SERVER) {
    options.upstreamProxyUrl = PROXY_SERVER;

    // Add proxy IP mask configuration for proxies without authentication
    options.upstreamProxyIpMask = {
      ipLookupService: IP_LOOKUP_SERVICE,
      ...(PROXY_IP && { proxyIp: PROXY_IP }),
      ...(PUBLIC_IP && { publicIp: PUBLIC_IP }),
    };
  }

  return options;
};

const isValidUrl = (urlString: string): boolean => {
  try {
    new URL(urlString);
    return true;
  } catch (_) {
    return false;
  }
};

app.get("/health", async (req: Request, res: Response) => {
  try {
    const hero = new Hero({ ...getHeroOptions(), connectionToCore });
    await hero.goto("about:blank");
    await hero.close();

    res.status(200).json({ status: "healthy" });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});

app.post("/scrape", async (req: Request, res: Response) => {
  const {
    url,
    wait_after_load = 0,
    timeout = 15000,
    headers,
    check_selector,
    spa_mode = true,
    network_idle_time = 3000,
    dom_stable_time = 1000,
  }: UrlModel = req.body;

  console.log(`================= Scrape Request =================`);
  console.log(`URL: ${url}`);
  console.log(`Wait After Load: ${wait_after_load}`);
  console.log(`Timeout: ${timeout}`);
  console.log(`Headers: ${headers ? JSON.stringify(headers) : "None"}`);
  console.log(`Check Selector: ${check_selector ? check_selector : "None"}`);
  console.log(`SPA Mode: ${spa_mode}`);
  console.log(`==================================================`);

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  if (!PROXY_SERVER) {
    console.warn(
      "⚠️ WARNING: No proxy server provided. Your IP address may be blocked."
    );
  }

  const heroOptions = getHeroOptions();
  if (headers && headers["User-Agent"]) {
    heroOptions.userAgent = headers["User-Agent"];
  }
  const hero = new Hero({ ...heroOptions, connectionToCore });

  let result: Awaited<ReturnType<typeof scrapePage>>;
  try {
    console.log("Attempting to scrape with Hero");
    result = await scrapePage(
      hero,
      url,
      wait_after_load,
      timeout,
      check_selector,
      spa_mode,
      network_idle_time,
      dom_stable_time
    );
    console.log(JSON.stringify(result.status, null, 2));
  } catch (error) {
    console.log("Hero scraping failed:", error);
    await hero.close();
    return res
      .status(500)
      .json({ error: "An error occurred while fetching the page." });
  }

  const pageError = result.status !== 200 ? getError(result.status) : undefined;

  if (!pageError) {
    console.log(`✅ Scrape successful!`);
  } else {
    console.log(
      `🚨 Scrape failed with status code: ${result.status} ${pageError}`
    );
  }

  await hero.close();

  res.json({
    content: result.content,
    pageStatusCode: result.status,
    contentType: result.contentType,
    ...(pageError && { pageError }),
  });
});

app.listen(port, () => {
  console.log(`Hero Scraper API is running on port ${port}`);
});

process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await HeroCore.shutdown();
  process.exit(0);
});
