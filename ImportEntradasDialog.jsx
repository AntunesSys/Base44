
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function ImportEntradasDialog({ isOpen, onClose }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Entradas e Itens (Removido)</DialogTitle>
          <DialogDescription>
            Esta funcionalidade foi removida.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p>A funcionalidade de importação de entradas foi removida desta versão.</p>
        </div>
        
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
        
      </DialogContent>
    </Dialog>
  );
}
