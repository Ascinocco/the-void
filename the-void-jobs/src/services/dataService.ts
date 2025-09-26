import { type SupabaseClient } from "@supabase/supabase-js";

interface DataServiceParams {
  supabase: SupabaseClient;
}

// @TODO: Tony - update data service with db queries
export class DataService {
  public readonly supabase: SupabaseClient;

  constructor({ supabase }: DataServiceParams) {
    this.supabase = supabase;
  }
}
