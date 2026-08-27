export type TxnType = 'expense' | 'income';
export type TxnSource = 'chat' | 'quick' | 'backfill' | 'manual' | 'import';

export type Category = {
  id: string;
  user_id: string;
  /** Stable slug ('food', 'other', 'salary'). The parser's fallbacks key off this. */
  key: string;
  name: string;
  icon: string;
  color: string;
  kind: TxnType;
  keywords: string;
  sort: number;
  archived: boolean;
};

export type Account = {
  id: string;
  user_id: string;
  key: string;
  name: string;
  kind: string;
  icon: string;
  sort: number;
  archived: boolean;
};

export type Txn = {
  id: string;
  user_id: string;
  amount_minor: number;
  type: TxnType;
  category_id: string | null;
  account_id: string | null;
  method: string | null;
  occurred_at: string;
  local_date: string;
  note: string | null;
  raw_input: string | null;
  source: TxnSource;
  confidence: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Budget = {
  id: string;
  user_id: string;
  category_id: string | null;
  amount_minor: number;
};

export type Alias = {
  id: string;
  user_id: string;
  keyword: string;
  category_id: string;
  hits: number;
  last_used_at: string;
};

export type ChatMessage = {
  id: string;
  user_id: string;
  role: 'user' | 'app';
  kind: 'text' | 'txn' | 'answer' | 'note';
  text: string;
  txn_id: string | null;
  payload: unknown;
  created_at: string;
};

/** A transaction joined with the display fields of its category. */
export type TxnView = Txn & {
  cat_name: string;
  cat_icon: string;
  cat_color: string;
  cat_key: string;
};

export type NewTxn = {
  amount_minor: number;
  type: TxnType;
  category_id: string;
  account_id?: string | null;
  method?: string | null;
  local_date: string;
  note?: string | null;
  raw_input?: string | null;
  source?: TxnSource;
  confidence?: number;
};
