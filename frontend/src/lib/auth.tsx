import { useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient, supabaseConfigMessage } from "@/lib/supabase";
import { AuthContext, type AuthContextValue } from "@/lib/auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setIsLoading(false);
      return;
    }

    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setIsLoading(false);
      }
    });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    isLoading,
    async signIn(email, password) {
      const client = getSupabaseClient();
      if (!client) throw new Error(supabaseConfigMessage);
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signUp(email, password) {
      const client = getSupabaseClient();
      if (!client) throw new Error(supabaseConfigMessage);
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) throw error;
      return Boolean(data.session);
    },
    async signOut() {
      const client = getSupabaseClient();
      if (!client) throw new Error(supabaseConfigMessage);
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
