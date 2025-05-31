
import React, { useState, useEffect } from "react";
import { Explorador } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, X, User } from "lucide-react";

export default function Exploradores() {
  const [exploradores, setExploradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentExplorador, setCurrentExplorador] = useState({
    nome: "",
    numero_contato: ""
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadExploradores();
  }, []);

  const loadExploradores = async () => {
    setLoading(true);
    try {
      const data = await Explorador.list();
      setExploradores(data);
    } catch (error) {
      console.error("Erro ao carregar exploradores:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentExplorador(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await Explorador.update(currentExplorador.id, currentExplorador);
      } else {
        await Explorador.create(currentExplorador);
      }
      setIsDialogOpen(false);
      resetForm();
      loadExploradores();
    } catch (error) {
      console.error("Erro ao salvar explorador:", error);
    }
  };

  const handleEdit = (explorador) => {
    setCurrentExplorador(explorador);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este explorador?")) {
      try {
        await Explorador.delete(id);
        loadExploradores();
      } catch (error) {
        console.error("Erro ao excluir explorador:", error);
      }
    }
  };

  const resetForm = () => {
    setCurrentExplorador({
      nome: "",
      numero_contato: ""
    });
    setIsEditing(false);
  };

  const filteredExploradores = exploradores.filter(explorador =>
    (explorador.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (explorador.numero_contato?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <h1 className="text-2xl font-bold text-gray-800">Exploradores</h1>
        <Button 
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Explorador
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome ou contato..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Número de Contato</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExploradores.length > 0 ? (
                  filteredExploradores.map((explorador) => (
                    <TableRow key={explorador.id}>
                      <TableCell className="font-medium">{explorador.nome}</TableCell>
                      <TableCell>{explorador.numero_contato || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(explorador)}
                          >
                            <Pencil className="h-4 w-4 text-amber-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(explorador.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                      {searchTerm 
                        ? "Nenhum explorador encontrado com os critérios de busca."
                        : "Nenhum explorador cadastrado ainda."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

    <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        setIsDialogOpen(isOpen);
    }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
                <User className="h-5 w-5 mr-2 text-emerald-600" />
                {isEditing ? "Editar Explorador" : "Novo Explorador"}
            </DialogTitle>
            {/* O botão X padrão do DialogContent já existe */}
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  name="nome"
                  value={currentExplorador.nome}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="numero_contato">Número de Contato</Label>
                <Input
                  id="numero_contato"
                  name="numero_contato"
                  value={currentExplorador.numero_contato}
                  onChange={handleInputChange}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                {isEditing ? "Atualizar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
