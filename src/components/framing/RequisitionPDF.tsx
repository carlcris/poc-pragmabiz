import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { registerPdfFont } from "@/lib/framing/pdfFont";
import type { CutListRow, RequisitionRow } from "@/lib/framing/documents";

/**
 * The job requisition and cut list as real PDFs.
 *
 * These replaced an html2canvas screenshot of the on-screen form. That approach
 * rasterised the panel and produced two visible defects: every ruled field had
 * its underline drawn *through* the text rather than beneath it, and word
 * spacing collapsed ("CHOPANDJOIN", "Preparedby") because html2canvas 1.4.1
 * mis-measures the `next/font` Inter face the app loads through a CSS variable.
 *
 * Drawing the forms here instead gives selectable vector text that prints
 * sharply at any size, and takes the SAME domain rows the screen does
 * (`requisitionRow` / `cutListRows`), so the paper and the PDF cannot disagree
 * about what is on the job.
 */

registerPdfFont();

const INK = "#171717";
const RULE = "#404040";
const MUTED = "#737373";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    fontFamily: "ArialUnicode",
    color: INK,
    backgroundColor: "#ffffff",
  },
  title: { fontSize: 15, textAlign: "center", letterSpacing: 0.4 },
  shopLine: {
    fontSize: 7.5,
    textAlign: "center",
    color: MUTED,
    marginTop: 2,
    marginBottom: 14,
    letterSpacing: 0.6,
  },

  headerGrid: { flexDirection: "row", gap: 24, marginBottom: 12 },
  headerCol: { flex: 1 },
  field: { flexDirection: "row", alignItems: "flex-end", marginBottom: 6 },
  // Fixed width, not intrinsic: react-pdf has no CSS grid, so without a shared
  // label column "Customer:" and "Address:" push their values to different x
  // and the rules come out ragged — the same defect the on-screen form had.
  fieldLabel: { width: 46, fontSize: 8, marginRight: 6 },
  // The rule is the bottom border of the value box, so it sits *under* the
  // text — the defect that made the rasterised version look struck through.
  fieldValue: {
    flex: 1,
    fontSize: 8.5,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingBottom: 2,
    minHeight: 12,
  },
  fieldPlaceholder: { color: "#a3a3a3" },

  table: { borderWidth: 1.5, borderColor: INK },
  tr: { flexDirection: "row" },
  th: {
    borderRightWidth: 1,
    borderRightColor: INK,
    borderBottomWidth: 1.5,
    borderBottomColor: INK,
    padding: 5,
    fontSize: 8,
    textAlign: "center",
  },
  td: {
    borderRightWidth: 1,
    borderRightColor: INK,
    padding: 5,
    justifyContent: "center",
  },
  colActual: { width: 52 },
  colQty: { width: 34 },
  colUnit: { width: 38 },
  colSize: { width: 122 },
  colArticle: { flex: 1, borderRightWidth: 0 },

  eyebrow: {
    fontSize: 6.5,
    color: MUTED,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  sizePair: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  // Fixed width, not minWidth: the two boxes are a matched pair, and letting
  // each size to its own content drew "10" and "8" on rules of different
  // lengths.
  sizeBox: {
    width: 42,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingBottom: 1,
    textAlign: "center",
    fontSize: 9,
  },
  ghost: { color: MUTED, fontSize: 7.5, marginTop: 2 },
  borderNotes: {
    marginTop: 4,
    paddingTop: 3,
    borderTopWidth: 0.5,
    borderTopColor: "#d4d4d4",
  },
  dimensionBlock: { marginBottom: 4 },

  totals: { flexDirection: "row", justifyContent: "flex-end", gap: 28, marginTop: 10 },
  totalCell: { alignItems: "flex-end" },
  totalLabel: { fontSize: 7, color: MUTED, letterSpacing: 0.5 },
  totalValue: { fontSize: 10, marginTop: 2 },

  signRow: { flexDirection: "row", gap: 28, marginTop: 36 },
  signCell: { flex: 1 },
  signName: { fontSize: 8.5, textAlign: "center", minHeight: 11 },
  signRule: { borderTopWidth: 1, borderTopColor: RULE, paddingTop: 3 },
  signLabel: { fontSize: 7.5, color: MUTED, textAlign: "center" },
});

/**
 * The embedded font subset has no U+20B1 (₱), so react-pdf silently drops the
 * glyph *and* the character after it — "₱92.64" printed as "$2.64". The rest of
 * the app's PDFs already write "PHP" for the same reason (see QuotationPDF), so
 * the screen's peso sign is swapped for that here rather than on screen, where
 * the real glyph renders fine.
 */
function pdfMoney(text: string): string {
  return text.replace(/₱\s*/g, "PHP ");
}

function Field({
  label,
  value,
  placeholder,
  labelWidth,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  /** Overrides the shared label column, for a longer label in its own column. */
  labelWidth?: number;
}) {
  const empty = !value;
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, ...(labelWidth ? [{ width: labelWidth }] : [])]}>
        {label}
      </Text>
      <Text style={[styles.fieldValue, ...(empty ? [styles.fieldPlaceholder] : [])]}>
        {value || placeholder || " "}
      </Text>
    </View>
  );
}

/**
 * A labelled "L X W" pair on rules — the artwork size, and the mat cut beneath
 * it. Both are measurements the bench cuts to, so they get the same treatment;
 * printing the mat cut as a sentence made it read like a note instead.
 */
function DimensionPair({
  label,
  lengthIn,
  widthIn,
}: {
  label: string;
  lengthIn: string;
  widthIn: string;
}) {
  return (
    <View style={styles.dimensionBlock}>
      <Text style={styles.eyebrow}>{label}</Text>
      <View style={styles.sizePair}>
        <Text style={styles.sizeBox}>{lengthIn}</Text>
        <Text style={{ fontSize: 8 }}>X</Text>
        <Text style={styles.sizeBox}>{widthIn}</Text>
      </View>
    </View>
  );
}

export type RequisitionPDFLabels = {
  title: string;
  shopLine: string;
  customer: string;
  address: string;
  noAddress: string;
  transactionNo: string;
  autoGenerated: string;
  actualQty: string;
  qty: string;
  unit: string;
  articleDescription: string;
  artworkSize: string;
  matSize: string;
  totalCuts: string;
  totalSales: string;
  preparedBy: string;
  receivedBy: string;
};

export function RequisitionPDF({
  rows,
  labels,
  totalSales,
  customerName,
  customerAddress,
  transactionNumber,
  preparedBy,
}: {
  rows: RequisitionRow[];
  labels: RequisitionPDFLabels;
  totalSales: string;
  customerName?: string;
  customerAddress?: string;
  transactionNumber?: string;
  preparedBy?: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{labels.title}</Text>
        <Text style={styles.shopLine}>{labels.shopLine}</Text>

        <View style={styles.headerGrid}>
          <View style={styles.headerCol}>
            <Field label={labels.customer} value={customerName} />
            <Field label={labels.address} value={customerAddress} placeholder={labels.noAddress} />
          </View>
          <View style={styles.headerCol}>
            <Field
              label={labels.transactionNo}
              value={transactionNumber}
              placeholder={labels.autoGenerated}
              labelWidth={70}
            />
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, styles.colActual]}>{labels.actualQty}</Text>
            <Text style={[styles.th, styles.colQty]}>{labels.qty}</Text>
            <Text style={[styles.th, styles.colUnit]}>{labels.unit}</Text>
            <Text style={[styles.th, styles.colSize]}> </Text>
            <Text style={[styles.th, styles.colArticle]}>{labels.articleDescription}</Text>
          </View>

          {rows.map((row, index) => (
            <View
              key={index}
              style={[
                styles.tr,
                ...(index < rows.length - 1
                  ? [{ borderBottomWidth: 1, borderBottomColor: INK }]
                  : []),
              ]}
            >
              {/* Left blank on purpose: the bench writes the actual cut count
                  here by hand when the job comes back. */}
              <View style={[styles.td, styles.colActual]} />
              <Text style={[styles.td, styles.colQty, { textAlign: "center" }]}>
                {row.quantity}
              </Text>
              <Text style={[styles.td, styles.colUnit, { textAlign: "center" }]}>{row.unit}</Text>

              <View style={[styles.td, styles.colSize]}>
                {/* Mat cut is a second ruled pair, not a run-on line: it is a
                    measurement the bench cuts to, so it reads like the artwork
                    size above it rather than like a note. Mirrors the on-screen
                    form's DimensionPair. */}
                <DimensionPair
                  label={labels.artworkSize}
                  lengthIn={row.artwork.lengthIn}
                  widthIn={row.artwork.widthIn}
                />
                {row.matOuter ? (
                  <DimensionPair
                    label={labels.matSize}
                    lengthIn={row.matOuter.lengthIn}
                    widthIn={row.matOuter.widthIn}
                  />
                ) : null}
                {row.matBorders.length > 0 ? (
                  <View style={styles.borderNotes}>
                    {row.matBorders.map((border, borderIndex) => (
                      <Text key={borderIndex} style={styles.ghost}>
                        {border.label ? `${border.label} ` : ""}
                        {border.text}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>

              <View style={[styles.td, styles.colArticle]}>
                {row.articles.map((block, blockIndex) => (
                  <View key={blockIndex} style={blockIndex > 0 ? { marginTop: 5 } : undefined}>
                    <Text style={styles.eyebrow}>{block.heading}</Text>
                    {block.lines.map((line, lineIndex) => (
                      // Emphasis is a property of the block (the moulding line
                      // is bold); `bullet` indents a mat layer beneath it.
                      <Text
                        key={lineIndex}
                        style={{
                          fontSize: 8.5,
                          // Emphasis by colour, not weight: the family has a
                          // single registered face, so a bold request would
                          // fall back to Helvetica and lose CJK glyphs.
                          color: block.emphasis ? INK : "#404040",
                          marginLeft: line.bullet ? 7 : 0,
                        }}
                      >
                        {line.bullet ? `\u00b7 ${line.text}` : line.text}
                      </Text>
                    ))}
                  </View>
                ))}
                {row.instructions ? (
                  // No italic either — the family has one registered face, so
                  // any style request falls back to Helvetica and loses CJK.
                  // Colour sets the bench note apart from the spec above it.
                  <Text style={{ fontSize: 8, marginTop: 5, color: "#525252" }}>
                    {row.instructions}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalCell}>
            <Text style={styles.totalLabel}>{labels.totalCuts}</Text>
            <Text style={styles.totalValue}>
              {rows.reduce((total, row) => total + row.quantity, 0)}
            </Text>
          </View>
          <View style={styles.totalCell}>
            <Text style={styles.totalLabel}>{labels.totalSales}</Text>
            <Text style={styles.totalValue}>{pdfMoney(totalSales)}</Text>
          </View>
        </View>

        <View style={styles.signRow}>
          <View style={styles.signCell}>
            <Text style={styles.signName}>{preparedBy ?? " "}</Text>
            <View style={styles.signRule}>
              <Text style={styles.signLabel}>{labels.preparedBy}</Text>
            </View>
          </View>
          <View style={styles.signCell}>
            <Text style={styles.signName}> </Text>
            <View style={styles.signRule}>
              <Text style={styles.signLabel}>{labels.receivedBy}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export type CutListPDFLabels = {
  title: string;
  material: string;
  spec: string;
  perCut: string;
  total: string;
};

export function CutListPDF({
  rows,
  labels,
  fitWarning,
}: {
  rows: CutListRow[];
  labels: CutListPDFLabels;
  fitWarning: string | null;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={[styles.title, { marginBottom: 12 }]}>{labels.title}</Text>

        <View style={{ borderBottomWidth: 1.5, borderBottomColor: INK, flexDirection: "row" }}>
          <Text style={{ flex: 1, fontSize: 8, paddingBottom: 4 }}>{labels.material}</Text>
          <Text style={{ flex: 2, fontSize: 8, paddingBottom: 4 }}>{labels.spec}</Text>
          <Text style={{ width: 60, fontSize: 8, textAlign: "right", paddingBottom: 4 }}>
            {labels.perCut}
          </Text>
          <Text style={{ width: 60, fontSize: 8, textAlign: "right", paddingBottom: 4 }}>
            {labels.total}
          </Text>
        </View>

        {rows.map((row) => (
          <View
            key={row.key}
            style={{
              flexDirection: "row",
              borderBottomWidth: 0.5,
              borderBottomColor: "#d4d4d4",
              paddingVertical: 4,
            }}
          >
            <Text style={{ flex: 1, fontSize: 8.5 }}>{row.material}</Text>
            <Text style={{ flex: 2, fontSize: 8.5 }}>{row.spec}</Text>
            <Text style={{ width: 60, fontSize: 8.5, textAlign: "right" }}>{row.perCut}</Text>
            <Text style={{ width: 60, fontSize: 8.5, textAlign: "right" }}>{row.total}</Text>
          </View>
        ))}

        {fitWarning ? (
          <Text style={{ marginTop: 12, fontSize: 8.5, color: "#b91c1c" }}>{fitWarning}</Text>
        ) : null}
      </Page>
    </Document>
  );
}
