export const recentUserAgents = [
  // Chrome - Latest versions (137.x, 136.x)
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",

  // Edge - Latest versions
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0",

  // Firefox - Latest versions (138.x, 137.x)
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:138.0) Gecko/20100101 Firefox/138.0",
  "Mozilla/5.0 (X11; Linux x86_64; rv:138.0) Gecko/20100101 Firefox/138.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",

  // Safari - Latest versions (18.5, 18.2)
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",

  // Opera - Latest version
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 OPR/117.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 OPR/117.0.0.0",

  // Mobile User Agents - Recent Chrome Mobile
  "Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
];

/**
 * Get a random user agent from the recent user agents list
 * @returns A random user agent string
 */
export const getRandomUserAgent = (): string => {
  const randomIndex = Math.floor(Math.random() * recentUserAgents.length);
  return recentUserAgents[randomIndex];
};

/**
 * Get a random desktop user agent (excludes mobile)
 * @returns A random desktop user agent string
 */
export const getRandomDesktopUserAgent = (): string => {
  const desktopUserAgents = recentUserAgents.filter(
    (ua) =>
      !ua.includes("Mobile") &&
      !ua.includes("iPhone") &&
      !ua.includes("iPad") &&
      !ua.includes("Android")
  );
  const randomIndex = Math.floor(Math.random() * desktopUserAgents.length);
  return desktopUserAgents[randomIndex];
};

/**
 * Get a random mobile user agent
 * @returns A random mobile user agent string
 */
export const getRandomMobileUserAgent = (): string => {
  const mobileUserAgents = recentUserAgents.filter(
    (ua) =>
      ua.includes("Mobile") ||
      ua.includes("iPhone") ||
      ua.includes("iPad") ||
      ua.includes("Android")
  );
  const randomIndex = Math.floor(Math.random() * mobileUserAgents.length);
  return mobileUserAgents[randomIndex];
};

/**
 * Get a user agent for a specific browser
 * @param browser The browser type ('chrome', 'firefox', 'safari', 'edge', 'opera')
 * @returns A random user agent string for the specified browser
 */
export const getUserAgentByBrowser = (
  browser: "chrome" | "firefox" | "safari" | "edge" | "opera"
): string => {
  let filteredUserAgents: string[];

  switch (browser.toLowerCase()) {
    case "chrome":
      filteredUserAgents = recentUserAgents.filter(
        (ua) =>
          ua.includes("Chrome") && !ua.includes("Edg") && !ua.includes("OPR")
      );
      break;
    case "firefox":
      filteredUserAgents = recentUserAgents.filter((ua) =>
        ua.includes("Firefox")
      );
      break;
    case "safari":
      filteredUserAgents = recentUserAgents.filter(
        (ua) => ua.includes("Safari") && !ua.includes("Chrome")
      );
      break;
    case "edge":
      filteredUserAgents = recentUserAgents.filter((ua) => ua.includes("Edg"));
      break;
    case "opera":
      filteredUserAgents = recentUserAgents.filter((ua) => ua.includes("OPR"));
      break;
    default:
      filteredUserAgents = recentUserAgents;
  }

  if (filteredUserAgents.length === 0) {
    return getRandomUserAgent();
  }

  const randomIndex = Math.floor(Math.random() * filteredUserAgents.length);
  return filteredUserAgents[randomIndex];
};
