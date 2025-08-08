import Hero, { ConnectionToHeroCore, IHeroCreateOptions } from "@ulixee/hero";
import HeroCore from "@ulixee/hero-core";
import { TransportBridge } from "@ulixee/net";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import UserAgent from "user-agents";
import { getError } from "./helpers/get_error";
import { retry } from "./helpers/retry";

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
  (process.env.BLOCK_MEDIA || "false").toLowerCase() === "true";

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
  block_media?: boolean;
}

const scrapePage = async (
  hero: Hero,
  url: string,
  waitAfterLoad: number,
  timeout: number,
  checkSelector: string | undefined
) => {
  console.log(`Navigating to ${url}`);

  const startTime = Date.now();
  const resource = await hero.goto(url, { timeoutMs: timeout });

  const elapsedTime = Date.now() - startTime;
  const remainingTimeout = timeout - elapsedTime;
  try {
    await hero.waitForPaintingStable({ timeoutMs: remainingTimeout });
  } catch (error: any) {
    console.log("Painting stable check failed:", error.message);
  }

  if (waitAfterLoad > 0) {
    await hero.waitForMillis(waitAfterLoad);
  }

  if (checkSelector) {
    try {
      const elapsedTime = Date.now() - startTime;
      const remainingTimeout = timeout - elapsedTime;
      await hero.waitForElement(hero.document.querySelector(checkSelector), {
        timeoutMs: remainingTimeout,
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
    elapsedTime: Date.now() - startTime,
  };
};

const getHeroOptions = () => {
  const viewport = { width: 1280, height: 800 };

  const options: IHeroCreateOptions = {
    userAgent: new UserAgent().toString(),
    viewport,
    blockedResourceTypes: BLOCK_MEDIA
      ? ["BlockImages", "BlockFonts", "BlockIcons", "BlockMedia"]
      : undefined,
    blockedResourceUrls: AD_SERVING_DOMAINS.map((domain) => `*${domain}*`),
    noChromeSandbox: true,
    showChromeInteractions: true,
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
    const hero = new Hero({
      ...getHeroOptions(),
      showChrome: false,
      connectionToCore,
    });
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
  const startTime = Date.now();

  const {
    url,
    wait_after_load = 0,
    timeout = 15000,
    headers,
    check_selector,
    block_media = BLOCK_MEDIA,
  }: UrlModel = req.body;

  console.log(`================= Scrape Request =================`);
  console.log(`URL: ${url}`);
  console.log(`Wait After Load: ${wait_after_load}`);
  console.log(`Timeout: ${timeout}`);
  console.log(`Headers: ${headers ? JSON.stringify(headers) : "None"}`);
  console.log(`Check Selector: ${check_selector ? check_selector : "None"}`);
  console.log(`Block Media: ${block_media}`);
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
  if (block_media) {
    heroOptions.blockedResourceTypes = [
      "BlockImages",
      "BlockFonts",
      "BlockIcons",
      "BlockMedia",
    ];
  }
  const hero = new Hero({ ...heroOptions, connectionToCore });
  const metadata = await hero.meta;
  console.log("User-Agent:", metadata.userAgentString);

  let result: Awaited<ReturnType<typeof scrapePage>>;
  try {
    console.log("Attempting to scrape with Hero");
    result = await retry(
      ({ remainingTimeout }) =>
        scrapePage(
          hero,
          url,
          wait_after_load,
          remainingTimeout,
          check_selector
        ),
      {
        maxRetry: 3,
        retryInterval: 500,
        functionName: "scrapePage",
        timeout,
      }
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
    console.log(`✅ Scrape successful! (${Date.now() - startTime}ms)`);
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
