"use client";

import type { ReactNode } from "react";
import { useContext } from "use-context-selector";

import I18NContext from "@/contexts/i18n";

export type II18NHocProps = {
  children: ReactNode;
};

const withI18N = (Component: any) => {
  const WithI18N = (props: any) => {
    const { i18n } = useContext(I18NContext);

    return <Component {...props} i18n={i18n} />;
  };

  WithI18N.displayName = `withI18N(${
    Component.displayName || Component.name || "Component"
  })`;

  return WithI18N;
};

export default withI18N;
