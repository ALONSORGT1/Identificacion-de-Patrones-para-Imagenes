/* Nexo Visión: original pixels + deterministic vector annotations. No generated replacement photo. */
(() => {
  "use strict";
  const API_URL =
    "https://identificacion-de-patrones-para-ima.vercel.app/api/analyze";
  const $ = (id) => document.getElementById(id);
  const palette = [
    "#e14c3c",
    "#167be2",
    "#9e46d6",
    "#dd8800",
    "#008a68",
    "#db3485",
  ];
  let current = null,
    result = null,
    controller = null,
    loading = false,
    version = 0,
    userCancelled = false;
  function status(text, error = false) {
    $("status").textContent = text;
    $("status").classList.toggle("error", error);
  }
  function update() {
    $("charCount").textContent = `${$("message").value.length} / 1000`;
    $("analyzeButton").disabled =
      loading || !current || !$("message").value.trim();
    [
      "chooseFile",
      "showUrl",
      "replaceImage",
      "newAnalysis",
      "mobileNew",
      "imageFile",
    ].forEach((id) => ($(id).disabled = loading));
    $("urlForm").querySelector("button").disabled = loading;
    $("cancel").hidden = !loading || !controller;
    $("analyzeButton").textContent = loading
      ? "Procesando…"
      : "Analizar imagen ↗";
  }
  function panel(open) {
    $("imagePanel").hidden = !open;
    $("showPanel").setAttribute("aria-expanded", String(open));
  }
  async function request(body, signal) {
    let response;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      if (e.name === "AbortError") throw e;
      throw new Error(
        "No se pudo conectar. Revisa Internet y que el servidor permita el origen de esta página.",
      );
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        data.error ||
          {
            413: "La imagen es demasiado grande.",
            429: "Límite de consultas alcanzado.",
            504: "El análisis tardó demasiado.",
          }[response.status] ||
          "El servidor no pudo completar la solicitud.",
      );
    return data;
  }
  function imageFrom(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error("No se pudo abrir la imagen. Usa JPG, PNG o WebP."));
      img.src = src;
    });
  }
  function scaledData(img) {
    const scale = Math.min(
      1,
      2048 / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.9);
    if (data.length > 3_800_000)
      throw new Error(
        "La imagen tiene demasiado detalle. Usa un recorte más pequeño.",
      );
    return data;
  }
  async function selectImage(src, name, rev) {
    const img = await imageFrom(src);
    if (img.naturalWidth * img.naturalHeight > 24_000_000)
      throw new Error(
        "La imagen supera los 24 megapíxeles. Reduce su tamaño antes de subirla.",
      );
    const analysis = scaledData(img);
    if (rev !== version) {
      if (src.startsWith("blob:")) URL.revokeObjectURL(src);
      return;
    }
    if (current?.src.startsWith("blob:")) URL.revokeObjectURL(current.src);
    current = { src, img, analysis, name };
    result = null;
    $("originalImage").src = src;
    $("thumbnail").src = src;
    $("imageName").textContent = name;
    $("imageSize").textContent =
      `${img.naturalWidth} × ${img.naturalHeight} px · Lista para analizar`;
    $("dropZone").hidden = true;
    $("selectedImage").hidden = false;
    $("welcome").hidden = true;
    $("comparison").hidden = false;
    $("panelEmpty").hidden = true;
    $("annotatedFigure").hidden = true;
    $("resultSummary").hidden = true;
    $("conversation").replaceChildren();
    status("Imagen lista. Escribe qué quieres identificar.");
    update();
    if (window.innerWidth > 680) panel(true);
    $("message").focus();
  }
  async function loadFile(file) {
    if (!file || loading) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      return status("Usa un archivo JPG, PNG o WebP.", true);
    if (file.size > 12_000_000)
      return status("La imagen supera los 12 MB.", true);
    loading = true;
    update();
    const rev = ++version;
    const src = URL.createObjectURL(file);
    try {
      status("Preparando imagen…");
      await selectImage(src, file.name, rev);
    } catch (e) {
      URL.revokeObjectURL(src);
      status(e.message, true);
    } finally {
      loading = false;
      update();
    }
  }
  $("chooseFile").onclick = () => $("imageFile").click();
  $("imageFile").onchange = () => {
    loadFile($("imageFile").files[0]);
    $("imageFile").value = "";
  };
  $("replaceImage").onclick = () => {
    $("dropZone").hidden = false;
    $("dropZone").scrollIntoView({ block: "center" });
  };
  $("showUrl").onclick = () => {
    const open = $("urlForm").hidden;
    $("urlForm").hidden = !open;
    $("showUrl").setAttribute("aria-expanded", String(open));
    if (open) $("imageUrl").focus();
  };
  $("urlForm").onsubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    loading = true;
    userCancelled = false;
    controller = new AbortController();
    const rev = ++version;
    update();
    status("Descargando imagen…");
    const timer = setTimeout(() => controller?.abort(), 75000);
    try {
      const data = await request(
        { action: "load_url", url: $("imageUrl").value.trim() },
        controller.signal,
      );
      await selectImage(data.image, "Imagen desde URL", rev);
    } catch (e) {
      status(
        e.name === "AbortError"
          ? userCancelled
            ? "Carga cancelada."
            : "La descarga tardó demasiado."
          : e.message,
        true,
      );
    } finally {
      clearTimeout(timer);
      loading = false;
      controller = null;
      update();
    }
  };
  ["dragenter", "dragover"].forEach((name) =>
    $("dropZone").addEventListener(name, (e) => {
      e.preventDefault();
      if (!loading) $("dropZone").classList.add("dragging");
    }),
  );
  ["dragleave", "drop"].forEach((name) =>
    $("dropZone").addEventListener(name, (e) => {
      e.preventDefault();
      $("dropZone").classList.remove("dragging");
    }),
  );
  $("dropZone").addEventListener("drop", (e) =>
    loadFile(e.dataTransfer.files[0]),
  );
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
  $("message").addEventListener("input", update);
  $("message").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    if (!event.repeat && !$("analyzeButton").disabled) {
      $("analyzeForm").requestSubmit();
    }
  });
  document.querySelectorAll("[data-prompt]").forEach(
    (button) =>
      (button.onclick = () => {
        $("message").value = button.dataset.prompt;
        update();
        $("message").focus();
      }),
  );
  function message(text, role) {
    const node = document.createElement("div");
    node.className = `message ${role}`;
    node.textContent = text;
    $("conversation").append(node);
    $("scrollArea").scrollTop = $("scrollArea").scrollHeight;
    return node;
  }
  function renderDetections(data) {
    const canvas = $("annotatedCanvas"),
      img = current.img;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const labels = Object.keys(data.counts),
      scale = Math.max(canvas.width, canvas.height) / 1000;
    for (const d of data.detections) {
      const [x1, y1, x2, y2] = d.box;
      const x = ((x1 + x2) / 2) * canvas.width,
        y = ((y1 + y2) / 2) * canvas.height;
      const radius = Math.max(
        8 * scale,
        Math.hypot((x2 - x1) * canvas.width, (y2 - y1) * canvas.height) / 2,
      );
      const color = palette[labels.indexOf(d.label) % palette.length];
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 5 * scale;
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 * scale;
      ctx.stroke();
      const bx = Math.min(canvas.width - 15 * scale, Math.max(15 * scale, x)),
        by = Math.min(
          canvas.height - 15 * scale,
          Math.max(15 * scale, y - radius),
        );
      ctx.beginPath();
      ctx.arc(bx, by, 13 * scale, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${13 * scale}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(d.id), bx, by);
    }
    canvas.setAttribute(
      "aria-label",
      `Imagen con ${data.count} objetos identificados, marcados con círculos numerados.`,
    );
    $("totalCount").textContent = data.count;
    $("categories").replaceChildren();
    labels.forEach((label, index) => {
      const row = document.createElement("div");
      row.className = "category";
      const name = document.createElement("span"),
        dot = document.createElement("i"),
        count = document.createElement("strong");
      dot.style.background = palette[index % palette.length];
      name.append(dot, document.createTextNode(label));
      count.textContent = data.counts[label];
      row.append(name, count);
      $("categories").append(row);
    });
    $("annotatedFigure").hidden = false;
    $("resultSummary").hidden = false;
  }
  $("analyzeForm").onsubmit = async (event) => {
    event.preventDefault();
    if (loading || !current || !$("message").value.trim()) return;
    const prompt = $("message").value.trim();
    loading = true;
    userCancelled = false;
    controller = new AbortController();
    update();
    message(prompt, "user");
    const pending = message(
      "Examinando la imagen y localizando los objetos…",
      "assistant",
    );
    status(
      "Analizando… Las imágenes con muchos objetos pueden tardar unos minutos.",
    );
    result = null;
    $("annotatedFigure").hidden = true;
    $("resultSummary").hidden = true;
    const timer = setTimeout(() => controller?.abort(), 275000);
    try {
      const data = await request(
        { message: prompt, image: current.analysis },
        controller.signal,
      );
      result = { ...data, prompt };
      renderDetections(data);
      pending.replaceChildren();
      const title = document.createElement("strong");
      title.textContent = `${data.count} ${data.count === 1 ? "objeto identificado" : "objetos identificados"}`;
      pending.append(
        title,
        document.createTextNode(
          Object.entries(data.counts)
            .map(([name, count]) => `${name}: ${count}`)
            .join("\n") +
            (data.note ? "\n\n" + data.note : "") +
            "\n\nRevisa los círculos numerados en la imagen.",
        ),
      );
      const view = document.createElement("button");
      view.textContent = "Ver imagen marcada ↗";
      view.onclick = () => {
        renderDetections(data);
        result = { ...data, prompt };
        panel(true);
      };
      pending.append(view);
      if ($("message").value.trim() === prompt) $("message").value = "";
      status("Análisis listo. Puedes pedir otro conteo sobre la misma imagen.");
      panel(true);
    } catch (e) {
      const text =
        e.name === "AbortError"
          ? userCancelled
            ? "Espera cancelada. El servidor podría terminar el análisis; cancelar no garantiza detener el consumo."
            : "Se agotó el tiempo de espera. Prueba un recorte con menos objetos."
          : e.message;
      pending.textContent = text;
      status(text, true);
      const retry = document.createElement("button");
      retry.textContent = "Preparar reintento";
      retry.onclick = () => {
        $("message").value = prompt;
        update();
        $("message").focus();
      };
      pending.append(retry);
    } finally {
      clearTimeout(timer);
      loading = false;
      controller = null;
      update();
      $("scrollArea").scrollTop = $("scrollArea").scrollHeight;
    }
  };
  $("cancel").onclick = () => {
    userCancelled = true;
    controller?.abort();
  };
  $("showPanel").onclick = () => panel($("imagePanel").hidden);
  $("closePanel").onclick = () => {
    panel(false);
    $("showPanel").focus();
  };
  $("newAnalysis").onclick = () => {
    if (loading) return;
    ++version;
    if (current?.src.startsWith("blob:")) URL.revokeObjectURL(current.src);
    current = null;
    result = null;
    $("conversation").replaceChildren();
    $("message").value = "";
    $("imageUrl").value = "";
    $("imageFile").value = "";
    ["selectedImage", "comparison", "annotatedFigure", "resultSummary"].forEach(
      (id) => ($(id).hidden = true),
    );
    ["welcome", "dropZone", "panelEmpty"].forEach(
      (id) => ($(id).hidden = false),
    );
    $("originalImage").removeAttribute("src");
    $("thumbnail").removeAttribute("src");
    $("zoomImage").removeAttribute("src");
    $("annotatedCanvas").width = 0;
    $("annotatedCanvas").height = 0;
    panel(false);
    status("Carga una imagen para comenzar.");
    update();
  };
  $("mobileNew").onclick = () => $("newAnalysis").click();
  function download(blob, name) {
    const src = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = src;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(src), 10000);
  }
  $("downloadImage").onclick = () => {
    if (result)
      $("annotatedCanvas").toBlob((blob) => {
        if (blob) download(blob, "nexo-imagen-marcada.png");
      }, "image/png");
  };
  $("downloadJson").onclick = () => {
    if (result)
      download(
        new Blob([JSON.stringify(result, null, 2)], {
          type: "application/json",
        }),
        "nexo-resultados.json",
      );
  };
  function zoom(src, title) {
    $("zoomImage").src = src;
    $("zoomTitle").textContent = title;
    $("zoomDialog").showModal();
  }
  $("zoomOriginal").onclick = () =>
    current && zoom(current.src, "Imagen original");
  $("zoomAnnotated").onclick = () =>
    result &&
    zoom(
      $("annotatedCanvas").toDataURL("image/png"),
      "Imagen con objetos identificados",
    );
  $("closeZoom").onclick = () => $("zoomDialog").close();
  update();
})();
