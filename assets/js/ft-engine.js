// Fate Tutor engine loader.
//
// The engines are Rust, compiled to WebAssembly. They run on the visitor's own
// device: birth details are not sent anywhere.
//
// Usage:  const engine = await FTEngine.load(url);  engine.call({cmd: "reading", ...})
(function (root) {
  "use strict";

  function wrap(instance) {
    const ex = instance.exports;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder("utf-8");

    function call(request) {
      const bytes = encoder.encode(JSON.stringify(request));
      const inPtr = ex.ft_alloc(bytes.length);
      new Uint8Array(ex.memory.buffer, inPtr, bytes.length).set(bytes);
      const outPtr = ex.ft_call(inPtr, bytes.length);
      ex.ft_free(inPtr, bytes.length);
      // The answer is 4 bytes of length followed by UTF-8 JSON. Memory may have
      // grown during the call, so the buffer is looked up again here.
      const length = new DataView(ex.memory.buffer).getUint32(outPtr, true);
      const text = decoder.decode(new Uint8Array(ex.memory.buffer, outPtr + 4, length));
      ex.ft_free(outPtr, 4 + length);
      const answer = JSON.parse(text);
      if (!answer.ok) {
        throw new Error(answer.error);
      }
      return answer.data;
    }

    return {
      call: call,
      callRaw: function (text) {
        const bytes = encoder.encode(text);
        const inPtr = ex.ft_alloc(bytes.length);
        new Uint8Array(ex.memory.buffer, inPtr, bytes.length).set(bytes);
        const outPtr = ex.ft_call(inPtr, bytes.length);
        ex.ft_free(inPtr, bytes.length);
        const length = new DataView(ex.memory.buffer).getUint32(outPtr, true);
        const out = decoder.decode(new Uint8Array(ex.memory.buffer, outPtr + 4, length));
        ex.ft_free(outPtr, 4 + length);
        return out;
      },
      reading: function (request) {
        return call(Object.assign({ cmd: "reading" }, request));
      },
      places: function (q, limit) {
        return call({ cmd: "place", q: q, limit: limit || 8 });
      },
      version: function () {
        return call({ cmd: "version" });
      },
    };
  }

  const FTEngine = {
    // In a browser: pass the URL of ft.wasm.
    load: async function (url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("could not load the engine (" + response.status + ")");
      }
      const result = await WebAssembly.instantiate(await response.arrayBuffer(), {});
      return wrap(result.instance);
    },
    // In Node (used by the checker bot): pass the bytes of ft.wasm.
    fromBytes: async function (bytes) {
      const result = await WebAssembly.instantiate(bytes, {});
      return wrap(result.instance);
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = FTEngine;
  } else {
    root.FTEngine = FTEngine;
  }
})(typeof self !== "undefined" ? self : this);
