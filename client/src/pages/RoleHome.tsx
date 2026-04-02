import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultPathForRole } from "@/lib/access-control";

export default function RoleHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) {
      return;
    }

    setLocation(getDefaultPathForRole(user.rol));
  }, [setLocation, user]);

  return null;
}
