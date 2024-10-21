import type React from "react";
import { createContext, useContext } from "react";

import type { ModelProviderWithModelsListOut } from "@/client/models/ModelProviderWithModelsListOut";
const ModelContext = createContext<ModelProviderWithModelsListOut | null>(null);

export const ModelProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: any;
}) => <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;

export const useModelProviderContext = () => useContext(ModelContext);
