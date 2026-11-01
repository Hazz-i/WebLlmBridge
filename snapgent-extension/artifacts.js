// artifacts.js - Runs inside Claude artifact and visualizer sandboxes (*.claudemcpcontent.com, claude.site)
(() => {
  function capture() {
    // 1. Try canvas
    const canvases = document.querySelectorAll("canvas");
    for (const c of canvases) {
      try {
        if (c.width >= 60 && c.height >= 60) {
          const durl = c.toDataURL("image/png");
          if (durl && durl.length > 500) {
            chrome.runtime.sendMessage({ type: "claude_artifact_captured", image: durl });
            return;
          }
        }
      } catch (e) {}
    }

    // 2. Try SVG
    const svgs = document.querySelectorAll("svg");
    for (const svg of svgs) {
      const vb = svg.getAttribute("viewBox") || "";
      const isIcon = vb.includes("0 0 24 24") || vb.includes("0 0 16 16");
      const w = svg.clientWidth || svg.getAttribute("width") || 0;
      const h = svg.clientHeight || svg.getAttribute("height") || 0;
      if (!isIcon && (w > 60 || h > 60 || (!w && !h && vb))) {
        const s = new XMLSerializer().serializeToString(svg);
        chrome.runtime.sendMessage({ type: "claude_artifact_captured", svg: s });
        return;
      }
    }

    // 3. Try images
    const imgs = document.querySelectorAll("img");
    for (const img of imgs) {
      const src = img.currentSrc || img.src || "";
      if (src && !src.includes("avatar") && !src.includes("icon")) {
        chrome.runtime.sendMessage({ type: "claude_artifact_captured", image: src });
        return;
      }
    }
  }

  // Capture immediately and watch for async React mounts
  capture();
  setTimeout(capture, 500);
  setTimeout(capture, 1500);
  setTimeout(capture, 3000);

  const observer = new MutationObserver(() => {
    capture();
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
