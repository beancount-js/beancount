export type FilterCommandOption = {
  value: string;
  label: string;
  accent?: string;
  /** Optional supporting text rendered below the option label. */
  description?: string;
  /** Optional decorative image, such as a merchant logo. */
  imageUrl?: string;
  keywords?: string[];
};

export type SearchableChoiceOption = {
  value: string;
  label: string;
  keywords?: string[];
};
