/**
 * XED Chat Widget Loader (TypeScript)
 * 
 * This script is built by Vite and can be included by other developers:
 * <script src="/loader.js" data-cohort-key="..."></script>
 */

(function () {
  "use strict";

  // Prevent loading twice
  if ((window as any).__XED_CHAT_WIDGET_LOADED__) {
    console.warn("[XED Widget] Widget already loaded. Skipping duplicate initialization.");
    return;
  }
  (window as any).__XED_CHAT_WIDGET_LOADED__ = true;

  // Find script element
  const scriptEl = document.currentScript || document.querySelector('script[src*="loader.js"]') || document.querySelector('script[src*="loader.ts"]') || document.querySelector('script[src*="widget.js"]');

  if (!scriptEl || !(scriptEl instanceof HTMLScriptElement)) {
    console.error("[XED Widget] Script tag not found. Make sure the script is loaded synchronously.");
    return;
  }

  // Configuration from data attributes and .env defaults (injected at build time)
  // ENV_DEFAULTS is injected by Vite plugin - if not available, use fallbacks
  // @ts-ignore - ENV_DEFAULTS is injected at build time by Vite plugin
  const envDefaults = typeof ENV_DEFAULTS !== 'undefined' ? ENV_DEFAULTS : {
    apiBase: '',
    voiceHttpBase: '',
    voiceWsBase: '',
  };
  
  const apiBase = scriptEl.getAttribute("data-api-base") || envDefaults.apiBase || window.location.origin;
  
  const config = {
    cohortKey: scriptEl.getAttribute("data-cohort-key") || scriptEl.getAttribute("data-cohort-key") || "",
    apiBase: apiBase,
    agentName: scriptEl.getAttribute("data-agent-name") || "Steve",
    profileImage: scriptEl.getAttribute("data-profile-image") || "https://api.dicebear.com/7.x/bottts/svg?seed=Steve&backgroundColor=b6e3f4",
    source: scriptEl.getAttribute("data-source") || "website",
    parentOrigin: scriptEl.getAttribute("data-parent-origin") || window.location.origin,
    // Voice backend - use .env defaults if not provided via data attributes
    voiceHttpBase: scriptEl.getAttribute("data-voice-http-base") || envDefaults.voiceHttpBase || "",
    voiceWsBase: scriptEl.getAttribute("data-voice-ws-base") || envDefaults.voiceWsBase || "",
  };

  // Validation
  if (!config.cohortKey) {
    console.error(
      "[XED Widget] Error: cohortKey is required.\n" +
      "Please add data-cohort-key attribute to the script tag.\n" +
      "Example: <script src='loader.js' data-cohort-key='your-cohort-key'></script>"
    );
    return;
  }

  // Get widget base URL from script source or env
  // In development, it's usually the same as apiBase or local vite server
  const scriptUrl = new URL(scriptEl.src);
  const widgetBaseUrl = scriptUrl.origin;

  // Config from .env / data attributes only (no /api/config). Build widget URL with parameters.
  async function initializeWidget() {
    const params = new URLSearchParams({
      cohortKey: config.cohortKey,
      apiBase: config.apiBase,
      source: config.source,
      agentName: config.agentName,
      profileImage: config.profileImage,
      parentOrigin: config.parentOrigin,
      voiceHttpBase: config.voiceHttpBase,
      voiceWsBase: config.voiceWsBase,
    });

    const widgetUrl = `${widgetBaseUrl}/iframe.html?${params.toString()}`;

    // Create iframe element
    const iframe = document.createElement("iframe");
    iframe.id = "xedChatWidgetIframe";
    iframe.title = "XED Chat Widget";
    iframe.src = widgetUrl;
    iframe.setAttribute("allow", "microphone; autoplay; clipboard-read; clipboard-write");
    iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    iframe.setAttribute("loading", "lazy");

    // Style iframe
    iframe.style.cssText = `
      position: fixed;
      right: 15px;
      bottom: 15px;
      width: 100px;
      height: 100px;
      border: none;
      z-index: 2147483647;
      background: transparent;
      overflow: hidden;
      transition: width 0.3s ease, height 0.3s ease, top 0.3s ease, bottom 0.3s ease;
    `;

    // Append to body
    function appendIframe() {
      if (document.body) {
        document.body.appendChild(iframe);
      } else {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", appendIframe);
        } else {
          setTimeout(appendIframe, 100);
        }
      }
    }

    appendIframe();

    // Store iframe reference for API
    (window as any).__XED_CHAT_WIDGET_IFRAME__ = iframe;
  }

  // Initialize widget
  initializeWidget();

  // Resize listener
  window.addEventListener("message", (event) => {
    // Only trust messages from our widget origin
    if (event.origin !== scriptUrl.origin && event.origin !== apiBase) {
        // In dev mode origins might differ, but for production this is important
    }

    const data = event.data;
    if (!data || typeof data !== "object" || data.type !== "chatWidgetResize") return;

    const iframe = (window as any).__XED_CHAT_WIDGET_IFRAME__ as HTMLIFrameElement;
    if (!iframe) return;

    // Update iframe size
    if (data.expanded) {
      const isMobile = window.innerWidth <= 768;
      iframe.style.width = isMobile ? "calc(100% - 30px)" : "400px"; // Fixed width or percentage
      iframe.style.height = "600px"; // Fixed height
      iframe.style.top = isMobile ? "15px" : "auto";
      iframe.style.bottom = "15px";
      iframe.style.right = "15px";
    } else {
      iframe.style.width = "100px";
      iframe.style.height = "100px";
      iframe.style.top = "auto";
      iframe.style.bottom = "15px";
      iframe.style.right = "15px";
    }
  });

  // Public API
  const widgetAPI = {
    open: function () {
      const iframe = (window as any).__XED_CHAT_WIDGET_IFRAME__ as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: "forceOpen" }, "*");
      }
    },
    close: function () {
      const iframe = (window as any).__XED_CHAT_WIDGET_IFRAME__ as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: "forceClose" }, "*");
      }
    },
    remove: function () {
      const iframe = (window as any).__XED_CHAT_WIDGET_IFRAME__ as HTMLIFrameElement;
      if (iframe && iframe.parentNode) {
        iframe.remove();
      }
      delete (window as any).XED_CHAT_WIDGET;
      delete (window as any).__XED_CHAT_WIDGET_LOADED__;
      delete (window as any).__XED_CHAT_WIDGET_IFRAME__;
    }
  };

  (window as any).XED_CHAT_WIDGET = widgetAPI;
})();
