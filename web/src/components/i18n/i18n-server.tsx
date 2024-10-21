"use client";

import type React from "react";

import useAuth from "@/hooks/useAuth";

import I18N from "./i18n";
import { ToastProvider } from "./toast";

export type II18NServerProps = {
  children: React.ReactNode;
};

const I18NServer = ({ children }: II18NServerProps) => {
  const { currentUser } = useAuth();
  const locale = currentUser?.language!;

  return (
    <I18N {...{ locale }}>
      <ToastProvider>{children}</ToastProvider>
    </I18N>
  );
};

export default I18NServer;
