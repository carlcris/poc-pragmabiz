export type ReportItemOption = {
  id: string;
  code: string;
  name: string;
};

export type ReportItemOptionsResponse = {
  data: ReportItemOption[];
  hasMore: boolean;
};
