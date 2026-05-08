export interface Book {
  id: string;
  md5: string;
  title: string;
  author?: string;
  coverUrl?: string;
  year?: string;
  languages?: string;
  format?: string;
  size?: string;
  pages?: number;
  tags?: string[];
  publisher?: string;
  description?: string;
  zlibId?: number;
  zlibHash?: string;
  isLocal?: boolean;
}

export interface Filters {
  q: string;
  lang: string;
  content: string;
  category: string;
  page: number;
  popular: boolean;
}

export interface PaginationData {
  page: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Category {
  id: string;
  subcategories: string[];
}

export interface ContentType {
  id: string;
  name: string;
}

export interface Language {
  code: string;
  name: string;
}
