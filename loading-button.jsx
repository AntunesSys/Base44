import React from "react";
import { Button } from "@/components/ui/button";

export function LoadingButton({ 
  children, 
  loading = false, 
  icon = null,
  loadingText = "Carregando...",
  ...props 
}) {
  return (
    <Button disabled={loading} {...props}>
      {loading ? (
        <>
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-b-transparent border-current"></div>
          {loadingText}
        </>
      ) : (
        <>
          {icon && <span className="mr-2">{icon}</span>}
          {children}
        </>
      )}
    </Button>
  );
}