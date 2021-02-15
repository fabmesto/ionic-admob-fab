export interface acquistoModel {
  product_id: string;
  date_start?: string;
  date_end?: string;
  date_check?: string,
  time_check_ms: number;
  time_start_ms: number;
  time_end_ms: number;
  transaction_id: string;
  auto_renewing: boolean;
  token: string;
}
