const elements = {
  activityMark: document.querySelector("#activity-mark"),
  convertButton: document.querySelector("#convert-button"),
  copyButton: document.querySelector("#copy-button"),
  documentStage: document.querySelector("#document-stage"),
  lab: document.querySelector("#lab"),
  layoutDetail: document.querySelector("#layout-detail"),
  markdownOutput: document.querySelector("#markdown-output code"),
  metricEngine: document.querySelector("#metric-engine"),
  metricHash: document.querySelector("#metric-hash"),
  metricSource: document.querySelector("#metric-source"),
  metricTime: document.querySelector("#metric-time"),
  previewImage: document.querySelector("#preview-image"),
  runMessage: document.querySelector("#run-message"),
  runState: document.querySelector("#run-state"),
  sampleList: document.querySelector("#sample-list"),
  selectedDescription: document.querySelector("#selected-description"),
  selectedEyebrow: document.querySelector("#selected-eyebrow"),
  selectedTitle: document.querySelector("#selected-title"),
};

const state = {
  samples: [],
  selectedId: null,
  busy: false,
};

function selectedSample() {
  return state.samples.find((sample) => sample.id === state.selectedId);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1_000) return `${bytes} B`;
  return `${(bytes / 1_000).toFixed(1)} KB`;
}

function setRunState(kind, label, message) {
  elements.runState.dataset.state = kind;
  elements.runState.textContent = label;
  elements.runMessage.textContent = message;
  elements.activityMark.dataset.state = kind;
}

function resetOutput(sample) {
  elements.markdownOutput.textContent = `# ${sample.title}\n\nRun the selected fixture to reveal its actual Markdown output here.`;
  elements.copyButton.hidden = true;
  elements.metricTime.textContent = "-";
  elements.metricSource.textContent = "-";
  elements.metricHash.textContent = "-";
  setRunState("idle", "Not run", "Ready for a fixed-corpus conversion.");
}

function selectSample(sampleId) {
  if (state.busy) return;
  const sample = state.samples.find((item) => item.id === sampleId);
  if (!sample) return;

  state.selectedId = sample.id;
  document.documentElement.dataset.tone = sample.tone;
  elements.selectedEyebrow.textContent = sample.eyebrow;
  elements.selectedTitle.textContent = sample.title;
  elements.selectedDescription.textContent = sample.description;
  elements.layoutDetail.textContent = sample.layout;
  elements.previewImage.src = sample.previewUrl;
  elements.previewImage.alt = `Rendered first page of ${sample.title}`;
  elements.documentStage.dataset.orientation = sample.id === "field-brief" ? "landscape" : "portrait";
  elements.convertButton.disabled = false;
  elements.convertButton.querySelector("span:first-child").textContent = "Convert this sample";

  for (const button of elements.sampleList.querySelectorAll("button")) {
    const isSelected = button.dataset.sampleId === sample.id;
    button.classList.toggle("selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }

  resetOutput(sample);
}

function renderSamples() {
  elements.sampleList.replaceChildren();

  state.samples.forEach((sample, index) => {
    const button = document.createElement("button");
    button.className = "sample-card";
    button.type = "button";
    button.dataset.sampleId = sample.id;
    button.setAttribute("aria-pressed", "false");

    const number = document.createElement("span");
    number.className = "sample-number";
    number.textContent = String(index + 1).padStart(2, "0");

    const copy = document.createElement("span");
    copy.className = "sample-copy";
    const label = document.createElement("span");
    label.className = "sample-label";
    label.textContent = sample.eyebrow;
    const title = document.createElement("strong");
    title.textContent = sample.title;
    const layout = document.createElement("span");
    layout.className = "sample-layout";
    layout.textContent = sample.layout;
    copy.append(label, title, layout);

    const arrow = document.createElement("span");
    arrow.className = "sample-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "+";

    button.append(number, copy, arrow);
    button.addEventListener("click", () => selectSample(sample.id));
    elements.sampleList.append(button);
  });
}

function setBusy(busy) {
  state.busy = busy;
  elements.lab.setAttribute("aria-busy", String(busy));
  elements.convertButton.disabled = busy;
  elements.convertButton.classList.toggle("busy", busy);
  elements.convertButton.querySelector("span:first-child").textContent = busy
    ? "Converting locally"
    : "Run it again";
  for (const button of elements.sampleList.querySelectorAll("button")) {
    button.disabled = busy;
  }
}

async function runConversion() {
  const sample = selectedSample();
  if (!sample || state.busy) return;

  setBusy(true);
  elements.copyButton.hidden = true;
  elements.markdownOutput.textContent = `# Conversion in progress\n\nThe request is running against ${sample.title}.`;
  setRunState(
    "running",
    "Running",
    "The local server is processing this allowlisted PDF.",
  );

  try {
    const response = await fetch(`/api/convert/${sample.id}`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Conversion failed.");

    elements.markdownOutput.textContent = payload.markdown;
    elements.copyButton.hidden = false;
    elements.metricEngine.textContent = `${payload.run.engine} ${payload.run.engineVersion}`;
    elements.metricTime.textContent = `${payload.run.elapsedMs} ms`;
    elements.metricSource.textContent = `${formatBytes(payload.run.sourceBytes)} - ${payload.run.markdownCharacters.toLocaleString()} chars`;
    elements.metricHash.textContent = payload.run.sourceSha256;
    setRunState(
      "complete",
      "Complete",
      `Returned ${payload.run.markdownCharacters.toLocaleString()} Markdown characters from the real local run.`,
    );
  } catch (error) {
    elements.markdownOutput.textContent = `# Conversion unavailable\n\n${error.message}`;
    setRunState("error", "Needs attention", error.message);
  } finally {
    setBusy(false);
  }
}

async function copyMarkdown() {
  try {
    await navigator.clipboard.writeText(elements.markdownOutput.textContent);
    elements.copyButton.textContent = "Copied";
    window.setTimeout(() => {
      elements.copyButton.textContent = "Copy";
    }, 1_500);
  } catch {
    elements.copyButton.textContent = "Select text";
    elements.markdownOutput.parentElement.focus?.();
  }
}

async function initialize() {
  try {
    const response = await fetch("/api/samples");
    if (!response.ok) throw new Error("Could not load the sample corpus.");
    const payload = await response.json();
    state.samples = payload.samples;
    elements.metricEngine.textContent = `${payload.engine.name} ${payload.engine.version}`;
    renderSamples();
    selectSample(state.samples[0].id);
  } catch (error) {
    const message = document.createElement("p");
    message.className = "load-error";
    message.textContent = error.message;
    elements.sampleList.replaceChildren(message);
    elements.selectedTitle.textContent = "The local demo is unavailable";
    setRunState("error", "Offline", error.message);
  }
}

elements.convertButton.addEventListener("click", runConversion);
elements.copyButton.addEventListener("click", copyMarkdown);

initialize();
