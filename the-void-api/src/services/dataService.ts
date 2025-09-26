import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { EnvConfig } from "../utils/env";

class DataService {
  public readonly supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      EnvConfig.getRequired("SUPABASE_URL"),
      EnvConfig.getRequired("SUPABASE_SERVICE_ROLE_KEY")
    );
  }
}

export const dataService = new DataService();
