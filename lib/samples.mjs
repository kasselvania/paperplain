export const samples = Object.freeze([
  Object.freeze({
    id: "field-brief",
    title: "Alder Creek Field Brief",
    eyebrow: "Research brief",
    description:
      "A landscape field note with metric cards, a compact timeline, and three observation columns.",
    layout: "Landscape / mixed regions",
    fileName: "alder-creek-field-brief.pdf",
    previewName: "alder-creek-field-brief-1.png",
    pageCount: 1,
    tone: "moss",
  }),
  Object.freeze({
    id: "studio-invoice",
    title: "Copper & Pine Invoice",
    eyebrow: "Structured invoice",
    description:
      "A clean invoice with client details, ruled line items, totals, and short payment notes.",
    layout: "Portrait / bordered table",
    fileName: "copper-and-pine-invoice.pdf",
    previewName: "copper-and-pine-invoice-1.png",
    pageCount: 1,
    tone: "copper",
  }),
  Object.freeze({
    id: "block-bulletin",
    title: "Juniper Block Bulletin",
    eyebrow: "Community bulletin",
    description:
      "A two-column neighborhood bulletin with a masthead, short stories, a schedule, and a callout.",
    layout: "Portrait / two columns",
    fileName: "juniper-block-bulletin.pdf",
    previewName: "juniper-block-bulletin-1.png",
    pageCount: 1,
    tone: "sun",
  }),
]);

export const samplesById = new Map(samples.map((sample) => [sample.id, sample]));

export function publicSample(sample) {
  return {
    id: sample.id,
    title: sample.title,
    eyebrow: sample.eyebrow,
    description: sample.description,
    layout: sample.layout,
    pageCount: sample.pageCount,
    tone: sample.tone,
    pdfUrl: `/samples/${sample.fileName}`,
    previewUrl: `/previews/${sample.previewName}`,
  };
}
