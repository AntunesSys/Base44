
import React, { useState, useEffect } from "react";
import { DVPF } from "@/api/entities";
import { DVPFItem } from "@/api/entities";
import { Cliente } from "@/api/entities";
import { Especie } from "@/api/entities";
import { UploadFile } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, X, FileSpreadsheet, FileText, Upload, Download, Leaf } from "lucide-react";
import { format } from "date-fns";
import { Notificacao } from "@/api/entities";

export default function DVPFPage() {
  const [dvpfs, setDvpfs] = useState([]);
  const [dvpfItens, setDvpfItens] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [especies, setEspecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(null);
  
  const [currentDVPF, setCurrentDVPF] = useState({
    numero: "",
    data_emissao: new Date().toISOString().split('T')[0],
    data_validade: "",
    cliente_id: "",
    observacoes: "",
    arquivo_url: "",
    volume_total: 0,
    valor_total: 0
  });

  const [currentItem, setCurrentItem] = useState({
    especie_id: "",
    volume: 0,
    valor_unitario: 0,
    valor_total: 0
  });
  
  const [tempItems, setTempItems] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dvpfData, clientesData, especiesData] = await Promise.all([
        DVPF.list(),
        Cliente.list(),
        Especie.list()
      ]);
      
      setDvpfs(dvpfData);
      setClientes(clientesData);
      setEspecies(especiesData);
      
      // Carregar os itens DVPF
      if (dvpfData.length > 0) {
        const allItens = await DVPFItem.list();
        setDvpfItens(allItens);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentDVPF(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleItemInputChange = (e) => {
    const { name, value } = e.target;
    const numValue = name === "volume" || name === "valor_unitario" ? parseFloat(value) || 0 : value;
    
    setCurrentItem(prev => {
      const newItem = {
        ...prev,
        [name]: numValue
      };
      
      // Calcular valor total se volume e valor unitário existirem
      if (name === "volume" || name === "valor_unitario") {
        newItem.valor_total = (newItem.volume * newItem.valor_unitario).toFixed(2);
      }
      
      return newItem;
    });
  };

  const handleItemSelect = (field, value) => {
    setCurrentItem(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) return null;
    
    setUploading(true);
    try {
      const { file_url } = await UploadFile({ file: selectedFile });
      return file_url;
    } catch (error) {
      console.error("Erro ao fazer upload do arquivo:", error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const addTempItem = () => {
    // Validar item
    if (!currentItem.especie_id || currentItem.volume <= 0) {
      alert("Preencha a espécie e o volume corretamente");
      return;
    }
    
    // Encontrar espécie para exibir nome
    const especieObj = especies.find(esp => esp.id === currentItem.especie_id);
    
    const newItem = {
      ...currentItem,
      id: Date.now().toString(), // ID temporário
      especie_nome: especieObj ? especieObj.nome : "Desconhecido",
      especie_codigo: especieObj ? especieObj.codigo : "N/A"
    };
    
    setTempItems(prev => [...prev, newItem]);
    
    // Resetar form do item
    setCurrentItem({
      especie_id: "",
      volume: 0,
      valor_unitario: 0,
      valor_total: 0
    });
    
    // Fechar diálogo
    setIsItemDialogOpen(false);
  };

  const removeTempItem = (tempId) => {
    setTempItems(prev => prev.filter(item => item.id !== tempId));
  };

  const calculateTotals = () => {
    let volTotal = 0;
    let valTotal = 0;
    
    tempItems.forEach(item => {
      volTotal += parseFloat(item.volume);
      valTotal += parseFloat(item.valor_total);
    });
    
    setCurrentDVPF(prev => ({
      ...prev,
      volume_total: volTotal,
      valor_total: valTotal
    }));
  };

  useEffect(() => {
    calculateTotals();
  }, [tempItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (tempItems.length === 0) {
      alert("Adicione pelo menos um item à DVPF");
      return;
    }
    
    try {
      let arquivo_url = currentDVPF.arquivo_url;
      
      if (selectedFile) {
        arquivo_url = await uploadFile();
      }
      
      // Criar ou atualizar DVPF
      let dvpfId;
      if (isEditing) {
        const { id, ...dvpfData } = currentDVPF;
        await DVPF.update(id, { ...dvpfData, arquivo_url });
        dvpfId = id;
        
        // Remover itens antigos
        const oldItems = dvpfItens.filter(item => item.dvpf_id === dvpfId);
        for (const item of oldItems) {
          await DVPFItem.delete(item.id);
        }
      } else {
        const newDVPF = await DVPF.create({
          ...currentDVPF,
          arquivo_url
        });
        dvpfId = newDVPF.id;
      }
      
      // Adicionar novos itens
      for (const item of tempItems) {
        const { id, especie_nome, especie_codigo, ...itemData } = item;
        await DVPFItem.create({
          ...itemData,
          dvpf_id: dvpfId
        });
      }
      
      // Código existente para fechar diálogo e limpar form
      setIsDialogOpen(false);
      resetForm();
      loadData();
      
      // Adicionar notificação sobre novo DVPF
      try {
        // Buscar nome do cliente para a mensagem
        const cliente = clientes.find(c => c.id === currentDVPF.cliente_id);
        const clienteNome = cliente ? cliente.nome : "Cliente não encontrado";
        
        await Notificacao.create({
          titulo: isEditing ? "DVPF Atualizada" : "Nova DVPF Cadastrada",
          mensagem: isEditing 
            ? `DVPF ${currentDVPF.numero} do cliente ${clienteNome} foi atualizada com ${tempItems.length} espécies, totalizando ${parseFloat(currentDVPF.volume_total).toFixed(3)}m³.`
            : `Nova DVPF ${currentDVPF.numero} do cliente ${clienteNome} foi cadastrada com ${tempItems.length} espécies, totalizando ${parseFloat(currentDVPF.volume_total).toFixed(3)}m³.`,
          data: new Date().toISOString(),
          tipo: "informacao",
          lida: false
        });
      } catch (notifError) {
        console.error("Erro ao criar notificação:", notifError);
      }
    } catch (error) {
      console.error("Erro ao salvar DVPF:", error);
    }
  };

  const handleViewDetails = async (dvpf) => {
    if (detailsVisible === dvpf.id) {
      setDetailsVisible(null);
      return;
    }
    
    setDetailsVisible(dvpf.id);
  };

  const handleEdit = async (dvpf) => {
    setCurrentDVPF(dvpf);
    setIsEditing(true);
    
    // Carregar itens do DVPF
    const itens = dvpfItens.filter(item => item.dvpf_id === dvpf.id);
    
    // Transformar em formato temporário com nomes/códigos de espécie
    const tempItemsWithNames = await Promise.all(
      itens.map(async (item) => {
        const especieObj = especies.find(esp => esp.id === item.especie_id);
        return {
          ...item,
          id: Date.now() + Math.random(), // ID temporário único
          especie_nome: especieObj ? especieObj.nome : "Desconhecido",
          especie_codigo: especieObj ? especieObj.codigo : "N/A"
        };
      })
    );
    
    setTempItems(tempItemsWithNames);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este DVPF?")) {
      try {
        // Excluir todos os itens relacionados
        const itensToDelete = dvpfItens.filter(item => item.dvpf_id === id);
        for (const item of itensToDelete) {
          await DVPFItem.delete(item.id);
        }
        
        // Excluir o DVPF
        await DVPF.delete(id);
        loadData();
      } catch (error) {
        console.error("Erro ao excluir DVPF:", error);
      }
    }
  };

  const resetForm = () => {
    setCurrentDVPF({
      numero: "",
      data_emissao: new Date().toISOString().split('T')[0],
      data_validade: "",
      cliente_id: "",
      observacoes: "",
      arquivo_url: "",
      volume_total: 0,
      valor_total: 0
    });
    setTempItems([]);
    setIsEditing(false);
    setSelectedFile(null);
  };

  const getClienteName = (clienteId) => {
    const cliente = clientes.find(c => c.id === clienteId);
    return cliente ? cliente.nome : "Cliente não encontrado";
  };

  // Filtragem de DVPFs
  const filteredDVPFs = dvpfs.filter(dvpf =>
    dvpf.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getClienteName(dvpf.cliente_id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <h1 className="text-2xl font-bold text-gray-800">DVPFs</h1>
        <Button 
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo DVPF
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por número ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-full max-h-[70vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-32">Número</TableHead>
                    <TableHead className="w-48">Cliente</TableHead>
                    <TableHead className="w-28">Data Emissão</TableHead>
                    <TableHead className="w-28">Data Validade</TableHead>
                    <TableHead className="w-32 text-center">Volume Total (m³)</TableHead>
                    <TableHead className="w-32 text-center">Valor Total (R$)</TableHead>
                    <TableHead className="w-20 text-center">Status</TableHead>
                    <TableHead className="w-40 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDVPFs.length > 0 ? (
                    filteredDVPFs.map((dvpf) => {
                      const isVencido = dvpf.data_validade && new Date(dvpf.data_validade) < new Date();
                      
                      return (
                        <React.Fragment key={dvpf.id}>
                          <TableRow className="hover:bg-gray-50">
                            <TableCell className="font-medium">{dvpf.numero}</TableCell>
                            <TableCell className="text-sm">{getClienteName(dvpf.cliente_id)}</TableCell>
                            <TableCell className="text-sm">
                              {dvpf.data_emissao && format(new Date(dvpf.data_emissao), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell className="text-sm">
                              {dvpf.data_validade && format(new Date(dvpf.data_validade), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell className="text-center text-sm font-mono">
                              {dvpf.volume_total?.toFixed(3) || '0.000'}
                            </TableCell>
                            <TableCell className="text-center text-sm font-mono">
                              R$ {dvpf.valor_total?.toFixed(2) || '0.00'}
                            </TableCell>
                            <TableCell className="text-center">
                              {isVencido ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Vencido
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Válido
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewDetails(dvpf)}
                                  title="Ver detalhes"
                                >
                                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                                </Button>
                                {dvpf.arquivo_url && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(dvpf.arquivo_url, '_blank')}
                                    title="Ver arquivo"
                                  >
                                    <Download className="h-4 w-4 text-green-600" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(dvpf)}
                                  title="Editar"
                                >
                                  <Pencil className="h-4 w-4 text-amber-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(dvpf.id)}
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          
                          {/* Detalhes expandidos com rolagem */}
                          {detailsVisible === dvpf.id && (
                            <TableRow>
                              <TableCell colSpan={8} className="bg-gray-50 p-0">
                                <div className="p-4">
                                  <h3 className="font-medium text-gray-800 mb-3">
                                    Espécies incluídas no DVPF {dvpf.numero}
                                  </h3>
                                  
                                  <div className="overflow-x-auto">
                                    <div className="max-h-96 overflow-y-auto">
                                      <Table>
                                        <TableHeader className="sticky top-0 bg-gray-100">
                                          <TableRow>
                                            <TableHead className="w-20">Código</TableHead>
                                            <TableHead className="w-48">Espécie</TableHead>
                                            <TableHead className="w-32 text-center">Volume (m³)</TableHead>
                                            <TableHead className="w-32 text-center">Valor por m³ (R$)</TableHead>
                                            <TableHead className="w-32 text-center">Total (R$)</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {dvpfItens
                                            .filter(item => item.dvpf_id === dvpf.id)
                                            .map(item => {
                                              const especie = especies.find(e => e.id === item.especie_id);
                                              return (
                                                <TableRow key={item.id} className="text-sm">
                                                  <TableCell className="font-medium">{especie?.codigo || 'N/A'}</TableCell>
                                                  <TableCell>{especie?.nome || 'Espécie não encontrada'}</TableCell>
                                                  <TableCell className="text-center font-mono">
                                                    {item.volume?.toFixed(3) || '0.000'}
                                                  </TableCell>
                                                  <TableCell className="text-center font-mono">
                                                    R$ {item.valor_unitario?.toFixed(2) || '0.00'}
                                                  </TableCell>
                                                  <TableCell className="text-center font-mono">
                                                    R$ {item.valor_total?.toFixed(2) || '0.00'}
                                                  </TableCell>
                                                </TableRow>
                                              );
                                            })
                                          }
                                          
                                          {/* Linha de totais */}
                                          <TableRow className="bg-gray-200 font-medium text-sm">
                                            <TableCell colSpan={2} className="text-right">TOTAIS:</TableCell>
                                            <TableCell className="text-center font-mono">
                                              {dvpf.volume_total?.toFixed(3) || '0.000'}
                                            </TableCell>
                                            <TableCell></TableCell>
                                            <TableCell className="text-center font-mono">
                                              R$ {dvpf.valor_total?.toFixed(2) || '0.00'}
                                            </TableCell>
                                          </TableRow>
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                  
                                  {dvpf.observacoes && (
                                    <div className="mt-4 p-3 bg-white rounded border">
                                      <p className="text-sm font-medium text-gray-700">Observações:</p>
                                      <p className="text-gray-600 text-sm">{dvpf.observacoes}</p>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        {searchTerm 
                          ? "Nenhum DVPF encontrado com os critérios de busca."
                          : "Nenhum DVPF cadastrado ainda."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Dialog para criar/editar DVPF */}
      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        setIsDialogOpen(isOpen);
      }}>
        <DialogContent className="sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] xl:max-w-[60vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2 text-emerald-600" />
              {isEditing ? `Editar DVPF ${currentDVPF.numero}` : "Novo DVPF"}
            </DialogTitle>
            
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-grow p-1">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="numero">Número do DVPF *</Label>
                <Input
                  id="numero"
                  name="numero"
                  value={currentDVPF.numero}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="cliente_id">Cliente *</Label>
                <Select 
                  value={currentDVPF.cliente_id} 
                  onValueChange={(value) => setCurrentDVPF(prev => ({ ...prev, cliente_id: value }))}
                >
                  <SelectTrigger id="cliente_id">
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="data_emissao">Data de Emissão *</Label>
                <Input
                  id="data_emissao"
                  name="data_emissao"
                  type="date"
                  value={currentDVPF.data_emissao}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="data_validade">Data de Validade</Label>
                <Input
                  id="data_validade"
                  name="data_validade"
                  type="date"
                  value={currentDVPF.data_validade}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            
            <div className="space-y-2"> 
              <div className="flex justify-between items-center">
                <h3 className="text-md font-medium">Espécies incluídas</h3> 
                <Button 
                  type="button" 
                  size="sm" 
                  onClick={() => {
                    setCurrentItem({
                      especie_id: "",
                      volume: 0,
                      valor_unitario: 0,
                      valor_total: 0
                    });
                    setIsItemDialogOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Espécie
                </Button>
              </div>
              
              <div className="border rounded-md overflow-hidden max-h-[300px] overflow-y-auto"> 
                <Table className="text-xs"> 
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead className="px-2 py-1">Código</TableHead> 
                      <TableHead className="px-2 py-1">Espécie</TableHead>
                      <TableHead className="px-2 py-1">Volume (m³)</TableHead>
                      <TableHead className="px-2 py-1">Valor/m³</TableHead>
                      <TableHead className="px-2 py-1">Total</TableHead>
                      <TableHead className="w-[40px] px-1 py-1"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tempItems.length > 0 ? (
                      tempItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="px-2 py-1">{item.especie_codigo}</TableCell>
                          <TableCell className="px-2 py-1">{item.especie_nome}</TableCell>
                          <TableCell className="px-2 py-1">{parseFloat(item.volume).toFixed(3)}</TableCell>
                          <TableCell className="px-2 py-1">R$ {parseFloat(item.valor_unitario).toFixed(2)}</TableCell>
                          <TableCell className="px-2 py-1">R$ {parseFloat(item.valor_total).toFixed(2)}</TableCell>
                          <TableCell className="px-1 py-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6" 
                              type="button"
                              onClick={() => removeTempItem(item.id)}
                            >
                              <Trash2 className="h-3 w-3 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500 py-4">
                          Nenhuma espécie adicionada
                        </TableCell>
                      </TableRow>
                    )}
                    
                    {tempItems.length > 0 && (
                      <TableRow className="bg-gray-100 font-medium">
                        <TableCell colSpan={2} className="text-right px-2 py-1">TOTAIS:</TableCell>
                        <TableCell className="px-2 py-1">{parseFloat(currentDVPF.volume_total).toFixed(3)}</TableCell>
                        <TableCell className="px-2 py-1"></TableCell>
                        <TableCell className="px-2 py-1">R$ {parseFloat(currentDVPF.valor_total).toFixed(2)}</TableCell>
                        <TableCell className="px-2 py-1"></TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            
            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                name="observacoes"
                value={currentDVPF.observacoes}
                onChange={handleInputChange}
                rows={2} 
              />
            </div>
            
            <div>
              <Label htmlFor="arquivo">Anexar DVPF (PDF)</Label>
              <div className="flex items-center gap-2 mt-1"> 
                <Input
                  id="arquivo"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="flex-1 text-xs" 
                />
                {currentDVPF.arquivo_url && (
                  <Button 
                    type="button" 
                    variant="outline"
                    size="sm" 
                    onClick={() => window.open(currentDVPF.arquivo_url, '_blank')}
                  >
                    <Download className="h-3 w-3 mr-1" /> Ver atual
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1"> 
                {selectedFile 
                  ? `Selecionado: ${selectedFile.name}` 
                  : isEditing && currentDVPF.arquivo_url 
                    ? "Manter atual ou selecionar novo"
                    : "PDF da DVPF digitalizada"}
              </p>
            </div>
            
            <DialogFooter className="pt-4"> 
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={uploading || tempItems.length === 0}
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Enviando...
                  </>
                ) : (
                  isEditing ? "Atualizar" : "Cadastrar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para adicionar/editar item DVPF */}
      <Dialog open={isItemDialogOpen} onOpenChange={(isOpen) => {
          if(!isOpen) setCurrentItem(null); // Limpar currentItem ao fechar
          setIsItemDialogOpen(isOpen);
      }}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>{currentItem?.id ? "Editar Item DVPF" : "Adicionar Item DVPF"}</DialogTitle>
                 
            </DialogHeader>
            
          <div className="space-y-3 pt-2"> 
            <div>
              <Label htmlFor="item_especie_id">Espécie *</Label>
              <Select 
                value={currentItem.especie_id} 
                onValueChange={(value) => handleItemSelect("especie_id", value)}
              >
                <SelectTrigger id="item_especie_id">
                  <SelectValue placeholder="Selecione uma espécie" />
                </SelectTrigger>
                <SelectContent>
                  {especies.map((especie) => (
                    <SelectItem key={especie.id} value={especie.id}>
                      {especie.codigo} - {especie.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="volume">Volume (m³) *</Label>
              <Input
                id="volume"
                name="volume"
                type="number"
                step="0.001"
                min="0.001"
                value={currentItem.volume}
                onChange={handleItemInputChange}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="valor_unitario">Valor por m³ (R$) *</Label>
              <Input
                id="valor_unitario"
                name="valor_unitario"
                type="number"
                step="0.01"
                min="0.01"
                value={currentItem.valor_unitario}
                onChange={handleItemInputChange}
                required
              />
            </div>
            
            <div>
              <Label>Valor Total (R$)</Label>
              <Input
                value={parseFloat(currentItem.valor_total || 0).toFixed(2)}
                readOnly
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Calculado automaticamente
              </p>
            </div>
            
            <DialogFooter className="pt-3"> 
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsItemDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="button"
                onClick={addTempItem}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Adicionar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
