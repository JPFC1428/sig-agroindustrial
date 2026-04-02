import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getCurrentUser,
  loginWithPassword,
  logoutFromSession,
  updateCurrentUserPreferences,
} from "@/lib/auth-api";
import type { AccentColor, AuthUser, ThemePreference } from "@/lib/types";

type AuthContextValue = {
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthUser | null>;
  updatePreferences: (
    themePreference: ThemePreference,
    accentColor: AccentColor
  ) => Promise<AuthUser>;
  user: AuthUser | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refreshSession() {
    try {
      const nextUser = await getCurrentUser();
      setUser(nextUser);
      return nextUser;
    } catch {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const nextUser = await loginWithPassword(email, password);
    setUser(nextUser);
    return nextUser;
  }

  async function logout() {
    try {
      await logoutFromSession();
    } finally {
      setUser(null);
    }
  }

  async function updatePreferences(
    themePreference: ThemePreference,
    accentColor: AccentColor
  ) {
    const nextUser = await updateCurrentUserPreferences(
      themePreference,
      accentColor
    );
    setUser(nextUser);
    return nextUser;
  }

  useEffect(() => {
    void refreshSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        login,
        logout,
        refreshSession,
        updatePreferences,
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }

  return context;
}
