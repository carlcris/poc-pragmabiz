export const toProperCase = (value?: string | null) => {
  if (!value) return "";
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
};

export default toProperCase;
