import { type SupabaseClient } from "@supabase/supabase-js";
import { type TavilyClient } from "@tavily/core";

interface DataServiceParams {
  supabase: SupabaseClient;
  tavily: TavilyClient;
}

// @TODO: Tony - update data service with db queries
export class DataService {
  public readonly supabase: SupabaseClient;
  public readonly tavily: TavilyClient;

  constructor({ supabase, tavily }: DataServiceParams) {
    this.supabase = supabase;
    this.tavily = tavily;
  }
}
