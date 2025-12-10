import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../constants';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const checkTableExists = async (tableName: string): Promise<boolean> => {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.warn(`Error checking table ${tableName}:`, error.message);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
};
