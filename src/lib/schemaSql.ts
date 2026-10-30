/**
 * Esquema SQL do Supabase importado diretamente de `supabase/schema.sql` via `?raw` do Vite.
 * Garante uma fonte única da verdade entre o arquivo SQL e a tela de configuração.
 */
import rawSchemaSql from '../../supabase/schema.sql?raw';

export const schemaSql: string = rawSchemaSql;
