// providers/claude-intercept.js - Runs in MAIN world at document_start to capture blob downloads
(() => {
  if (window.__hermesInterceptorInstalled) return;
  window.__hermesInterceptorInstalled = true;

  // 1. Intercept URL.createObjectURL for direct blob downloads
  const _createObjectURL = URL.createObjectURL;
  URL.createObjectURL = function(blob) {
    const url = _createObjectURL.apply(this, arguments);
    try {
      if (blob && typeof blob === "object" && blob.size > 50) {
        const type = blob.type || "";
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            window.postMessage({
              type: "HERMES_BLOB_CAPTURED",
              dataUrl: reader.result,
              size: blob.size,
              mime: type
            }, "*");
          }
        };
        reader.readAsDataURL(blob);
      }
    } catch (e) {}
    return url;
  };

  // 2. Intercept window.fetch for API file content downloads
  const _fetch = window.fetch;
  window.fetch = async function(...args) {
    const resp = await _fetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || "";
      if (url.includes("/files/") || url.includes("/content") || url.includes("/artifacts/")) {
        const clone = resp.clone();
        clone.blob().then((blob) => {
          if (blob && blob.size > 50) {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (reader.result) {
                window.postMessage({
                  type: "HERMES_BLOB_CAPTURED",
                  dataUrl: reader.result,
                  size: blob.size,
                  mime: blob.type
                }, "*");
              }
            };
            reader.readAsDataURL(blob);
          }
        }).catch(() => {});
      }
    } catch (e) {}
    return resp;
  };
})();
