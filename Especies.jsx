
import React, { useState, useEffect } from "react";
import { Especie } from "@/api/entities";
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
import { Plus, Search, Pencil, Trash2, TreePine, Download, Loader2 } from "lucide-react"; // Adicionado Download e Loader2
import { generateSpeciesReportPDF } from "@/api/functions"; // Nova função de backend

export default function Especies() {
  const [especies, setEspecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentEspecie, setCurrentEspecie] = useState({
    codigo: "",
    nome: "",
    nome_cientifico: "",
    volume_inicial: 0
  });
  const [isEditing, setIsEditing] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false); // Estado para loading do relatório

  useEffect(() => {
    loadEspecies();
  }, []);

  const loadEspecies = async () => {
    setLoading(true);
    try {
      const data = await Especie.list();
      setEspecies(data);
    } catch (error) {
      console.error("Erro ao carregar espécies:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Tratamento especial para o campo volume_inicial
    if (name === "volume_inicial") {
      setCurrentEspecie(prev => ({
        ...prev,
        [name]: value === "" ? 0 : parseFloat(value)
      }));
    } else {
      setCurrentEspecie(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await Especie.update(currentEspecie.id, currentEspecie);
      } else {
        await Especie.create(currentEspecie);
      }
      setIsDialogOpen(false);
      resetForm();
      loadEspecies();
    } catch (error) {
      console.error("Erro ao salvar espécie:", error);
    }
  };

  const handleEdit = (especie) => {
    setCurrentEspecie(especie);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir esta espécie?")) {
      try {
        await Especie.delete(id);
        loadEspecies();
      } catch (error) {
        console.error("Erro ao excluir espécie:", error);
      }
    }
  };

  const resetForm = () => {
    setCurrentEspecie({
      codigo: "",
      nome: "",
      nome_cientifico: "",
      volume_inicial: 0
    });
    setIsEditing(false);
  };

  const filteredEspecies = especies.filter(especie =>
    (especie.codigo?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (especie.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (especie.nome_cientifico?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const handleGenerateSpeciesPDFReport = async () => {
    setGeneratingReport(true);
    try {
      const response = await generateSpeciesReportPDF(); // Não precisa passar dados, a função busca

      if (response.status === 200 && response.data) {
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        // Pegar o nome do arquivo do header Content-Disposition se disponível
        const contentDisposition = response.headers?.['content-disposition'];
        let fileName = `relatorio_especies_${new Date().toISOString().split('T')[0]}.pdf`;
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/i);
            if (fileNameMatch && fileNameMatch.length === 2) {
                fileName = fileNameMatch[1];
            }
        }
        
        link.href = url;
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        console.error("Erro ao gerar relatório PDF:", response.data?.error || "Resposta inválida do servidor");
        alert(`Erro ao gerar relatório: ${response.data?.error || 'Tente novamente.'}`);
      }
    } catch (error) {
      console.error("Erro ao chamar a função de gerar relatório PDF:", error);
      alert("Ocorreu um erro ao tentar gerar o relatório. Verifique o console para mais detalhes.");
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <h1 className="text-2xl font-bold text-gray-800">Espécies</h1>
        <div className="flex gap-2">
          <Button 
            onClick={handleGenerateSpeciesPDFReport}
            variant="outline"
            className="border-indigo-600 text-indigo-700 hover:bg-indigo-50"
            disabled={generatingReport}
          >
            {generatingReport ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Relatório PDF
          </Button>
          <Button 
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={generatingReport}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Espécie
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por código, nome ou nome científico..."
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
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Nome Científico</TableHead>
                  <TableHead>Volume Inicial (m³)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEspecies.length > 0 ? (
                  filteredEspecies.map((especie) => (
                    <TableRow key={especie.id}>
                      <TableCell className="font-medium">{especie.codigo}</TableCell>
                      <TableCell>{especie.nome}</TableCell>
                      <TableCell className="hidden md:table-cell italic">{especie.nome_cientifico || '-'}</TableCell>
                      <TableCell>{especie.volume_inicial?.toFixed(3) || '0.000'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(especie)}
                          >
                            <Pencil className="h-4 w-4 text-amber-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(especie.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      {searchTerm 
                        ? "Nenhuma espécie encontrada com os critérios de busca."
                        : "Nenhuma espécie cadastrada ainda."}
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
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <TreePine className="h-5 w-5 mr-2 text-emerald-600" />
              {isEditing ? "Editar Espécie" : "Nova Espécie"}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-grow p-1">
            <div className="space-y-3">
              <div>
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  name="codigo"
                  value={currentEspecie.codigo}
                  onChange={handleInputChange}
                  required
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="nome">Nome Comum *</Label>
                <Input
                  id="nome"
                  name="nome"
                  value={currentEspecie.nome}
                  onChange={handleInputChange}
                  required
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="nome_cientifico">Nome Científico</Label>
                <Input
                  id="nome_cientifico"
                  name="nome_cientifico"
                  value={currentEspecie.nome_cientifico || ""}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="volume_inicial">Volume Inicial (m³)</Label>
                <Input
                  id="volume_inicial"
                  name="volume_inicial"
                  type="number"
                  step="0.001"
                  min="0"
                  value={currentEspecie.volume_inicial || 0}
                  onChange={handleInputChange}
                  className="mt-1"
                />
                 <p className="text-xs text-gray-500 mt-1">
                  Este volume é um saldo inicial opcional para a espécie.
                </p>
              </div>
            </div>
            
            <DialogFooter className="pt-4">
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
