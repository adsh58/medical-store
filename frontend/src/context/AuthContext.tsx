"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserLogin, UserCreate } from "@/types";
import apiClient from "@/lib/api-client";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: UserLogin) => Promise<void>;
  logout: () => void;
  registerUser: (data: UserCreate) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Restore session on mount
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem("access_token");
      if (token) {
        try {
          const res = await apiClient.get<User>("/auth/me");
          setUser(res.data);
        } catch (err) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  const login = async (credentials: UserLogin) => {
    try {
      const res = await apiClient.post<{ access_token: string; refresh_token: string }>("/auth/login", credentials);
      localStorage.setItem("access_token", res.data.access_token);
      localStorage.setItem("refresh_token", res.data.refresh_token);
      
      const userRes = await apiClient.get<User>("/auth/me");
      setUser(userRes.data);
    } catch (err: any) {
      throw new Error(err.response?.data?.error || "Login credentials authentication failed");
    }
  };

  const registerUser = async (data: UserCreate) => {
    try {
      await apiClient.post("/auth/register", data);
    } catch (err: any) {
      throw new Error(err.response?.data?.error || "Registration failed");
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, registerUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
