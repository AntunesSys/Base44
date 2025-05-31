
import React, { useState, useEffect } from "react";
import { Veiculo } from "@/api/entities";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Pencil, Trash2, X, Truck, User, FileText } from "lucide-react";

export default function Veiculos() {
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentVeiculo, setCurrentVeiculo] = useState({
    proprietario: "",
    cpf_cnpj: "",
    placa_cavalo: "",
    placa_carreta: "",
    placa_dolly: "",
    placa_julieta: "",
    nome_motorista: "",
    cpf_motorista: "",
    contato_motorista: ""
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadVeiculos();
  }, []);

  const loadVeiculos = async () => {
    setLoading(true);
    try {
      const data = await Veiculo.list();
      setVeiculos(data);
    } catch (error) {
      console.error("Erro ao carregar veículos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentVeiculo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await Veiculo.update(currentVeiculo.id, currentVeiculo);
      } else {
        await Veiculo.create(currentVeiculo);
      }
      setIsDialogOpen(false);
      resetForm();
      loadVeiculos();
    } catch (error) {
      console.error("Erro ao salvar veículo:", error);
    }
  };

  const handleEdit = (veiculo) => {
    setCurrentVeiculo(veiculo);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este veículo?")) {
      try {
        await Veiculo.delete(id);
        loadVeiculos();
      } catch (error) {
        console.error("Erro ao excluir veículo:", error);
      }
    }
  };

  const resetForm = () => {
    setCurrentVeiculo({
      proprietario: "",
      cpf_cnpj: "",
      placa_cavalo: "",
      placa_carreta: "",
      placa_dolly: "",
      placa_julieta: "",
      nome_motorista: "",
      cpf_motorista: "",
      contato_motorista: ""
    });
    setIsEditing(false);
  };

  const filteredVeiculos = veiculos.filter(veiculo =>
    (veiculo.proprietario?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (veiculo.placa_cavalo?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (veiculo.nome_motorista?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <h1 className="text-2xl font-bold text-gray-800">Veículos</h1>
        <Button 
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Veículo
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por proprietário, placa ou motorista..."
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
                  <TableHead>Proprietário</TableHead>
                  <TableHead>Placa Cavalo</TableHead>
                  <TableHead className="hidden md:table-cell">Placa Carreta</TableHead>
                  <TableHead className="hidden lg:table-cell">Motorista</TableHead>
                  <TableHead className="hidden lg:table-cell">Contato</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVeiculos.length > 0 ? (
                  filteredVeiculos.map((veiculo) => (
                    <TableRow key={veiculo.id}>
                      <TableCell className="font-medium">{veiculo.proprietario}</TableCell>
                      <TableCell className="uppercase">{veiculo.placa_cavalo}</TableCell>
                      <TableCell className="hidden md:table-cell uppercase">{veiculo.placa_carreta || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell">{veiculo.nome_motorista || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell">{veiculo.contato_motorista || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(veiculo)}
                          >
                            <Pencil className="h-4 w-4 text-amber-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(veiculo.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {searchTerm 
                        ? "Nenhum veículo encontrado com os critérios de busca."
                        : "Nenhum veículo cadastrado ainda."}
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
        <DialogContent className="sm:max-w-lg md:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Truck className="h-5 w-5 mr-2 text-emerald-600" />
              {isEditing ? "Editar Veículo" : "Novo Veículo"}
            </DialogTitle>
             {/* O botão X padrão do DialogContent já existe */}
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
           
            <Tabs defaultValue="veiculo" className="w-full">
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="veiculo" className="flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Dados do Veículo
                </TabsTrigger>
                <TabsTrigger value="motorista" className="flex items-center gap-2">
                  <User className="h-4 w-4" /> Dados do Motorista
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="veiculo" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="proprietario">Proprietário *</Label>
                    <Input
                      id="proprietario"
                      name="proprietario"
                      value={currentVeiculo.proprietario}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="cpf_cnpj">CPF/CNPJ *</Label>
                    <Input
                      id="cpf_cnpj"
                      name="cpf_cnpj"
                      value={currentVeiculo.cpf_cnpj}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="placa_cavalo">Placa do Cavalo *</Label>
                    <Input
                      id="placa_cavalo"
                      name="placa_cavalo"
                      value={currentVeiculo.placa_cavalo}
                      onChange={handleInputChange}
                      required
                      className="uppercase"
                      maxLength={7}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="placa_carreta">Placa da Carreta</Label>
                    <Input
                      id="placa_carreta"
                      name="placa_carreta"
                      value={currentVeiculo.placa_carreta}
                      onChange={handleInputChange}
                      className="uppercase"
                      maxLength={7}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="placa_dolly">Placa do Dolly</Label>
                    <Input
                      id="placa_dolly"
                      name="placa_dolly"
                      value={currentVeiculo.placa_dolly}
                      onChange={handleInputChange}
                      className="uppercase"
                      maxLength={7}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="placa_julieta">Placa da Julieta</Label>
                    <Input
                      id="placa_julieta"
                      name="placa_julieta"
                      value={currentVeiculo.placa_julieta}
                      onChange={handleInputChange}
                      className="uppercase"
                      maxLength={7}
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="motorista" className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="nome_motorista">Nome do Motorista</Label>
                  <Input
                    id="nome_motorista"
                    name="nome_motorista"
                    value={currentVeiculo.nome_motorista}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cpf_motorista">CPF do Motorista</Label>
                    <Input
                      id="cpf_motorista"
                      name="cpf_motorista"
                      value={currentVeiculo.cpf_motorista}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="contato_motorista">Contato do Motorista</Label>
                    <Input
                      id="contato_motorista"
                      name="contato_motorista"
                      value={currentVeiculo.contato_motorista}
                      onChange={handleInputChange}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
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
