import { useAuthStore } from "../store/authStore.ts";
import { useNavigate } from "react-router";

export function useAuth() {
  const { user, token, setAuth, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const logout = () => {
    clearAuth();
    navigate("/login");
  };

  return { user, token, isAuthenticated: !!token, setAuth, logout };
}
