import React, { useState, useEffect } from "react";
import { Configuracao } from "@/api/entities";
import { User } from "@/api/entities"; // Já existe
import { VersaoSistema } from "@/api/entities"; // NOVO
import { UploadFile } from "@/api/integrations";
import { criarVersaoBackup } from "@/api/functions"; // NOVO
import { restaurarVersao } from "@/api/functions"; // NOVO
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // NOVO
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // NOVO
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, // NOVO (pode precisar renomear se houver conflito, mas Dialog de shadcn é o mesmo)
  DialogContent as VersionDialogContent, // Renomear para evitar conflito com AlertDialogContent
  DialogFooter as VersionDialogFooter,
  DialogHeader as VersionDialogHeader,
  DialogTitle as VersionDialogTitle,
  DialogDescription as VersionDialogDescription,
} from "@/components/ui/dialog"; // NOVO para dialogs de versão
import {
  Select, // NOVO
  SelectContent as VersionSelectContent, // Renomear para evitar conflito
  SelectItem as VersionSelectItem,
  SelectTrigger as VersionSelectTrigger,
  SelectValue as VersionSelectValue,
} from "@/components/ui/select"; // NOVO para selects de versão
import {
  Settings,
  Upload,
  Download,
  Save,
  Image,
  Palette,
  Database,
  AlertCircle,
  Trash2,
  Loader2,
  ShieldAlert,
  History, // NOVO
  CheckCircle, // NOVO
  Clock, // NOVO
  User as UserIcon, // NOVO
  FileText, // NOVO
  RotateCcw, // NOVO
  Plus, // NOVO
  Shield, // NOVO
  AlertTriangle // NOVO (já existia em alerta, mas usado em ícones de versão)
} from "lucide-react";
import { format } from "date-fns"; // NOVO

// Entidades para exclusão (já existentes)
import { Cliente } from "@/api/entities";
import { Veiculo } from "@/api/entities";
import { Especie } from "@/api/entities";
import { DVPF } from "@/api/entities";
import { DVPFItem } from "@/api/entities";
import { Explorador } from "@/api/entities";
import { Romaneador } from "@/api/entities";
import { Entrada } from "@/api/entities";
import { EntradaItem } from "@/api/entities";
import { Saida } from "@/api/entities";
import { SaidaItem } from "@/api/entities";


export default function ConfiguracoesPage() {
  // Estados para Configurações Gerais e Dados (já existentes)
  const [config, setConfig] = useState({
    nome_empresa: "FlorestGestão",
    tema_cor: "#047857",
    logo_url: "",
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(false); // Renomeado para evitar conflito
  const [errorConfig, setErrorConfig] = useState(null); // Renomeado
  const [successConfig, setSuccessConfig] = useState(null); // Renomeado
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionLogs, setDeletionLogs] = useState([]);

  // Estados para Controle de Versões (NOVOS)
  const [versoes, setVersoes] = useState([]);
  const [loadingVersoes, setLoadingVersoes] = useState(true);
  const [currentUser, setCurrentUser] = useState(null); // Para permissões de restauração
  const [isCreateVersionDialogOpen, setIsCreateVersionDialogOpen] = useState(false);
  const [isRestoreVersionDialogOpen, setIsRestoreVersionDialogOpen] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState(false);
  const [errorVersoes, setErrorVersoes] = useState(null);
  const [successVersoes, setSuccessVersoes] = useState(null);
  const [newVersion, setNewVersion] = useState({
    descricao: "",
    tipo: "manual"
  });
  const [restoreFile, setRestoreFile] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [activeTab, setActiveTab] = useState("geral"); // Para controlar aba ativa


  useEffect(() => {
    loadConfig(); // Carrega configurações gerais
    // A lógica de carregar usuário e versões será chamada quando a aba for ativada
  }, []);

  useEffect(() => {
    if (activeTab === 'versoes') {
      loadVersoesData(); // Carrega dados das versões quando a aba for selecionada
    }
  }, [activeTab]);

  const loadConfig = async () => {
    setLoadingConfig(true);
    try {
      const configs = await Configuracao.list();
      if (configs.length > 0) {
        setConfig(configs[0]);
      }
      const user = await User.me(); // Carrega usuário para permissões gerais
      setCurrentUser(user);
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      setErrorConfig("Erro ao carregar configurações da empresa.");
    }
    setLoadingConfig(false);
  };

  // Funções de Configurações Gerais e Dados (já existentes)
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSaveConfig = async () => {
    setLoadingConfig(true);
    setErrorConfig(null);
    setSuccessConfig(null);
    try {
      let logo_url = config.logo_url;
      if (selectedFile) {
        const uploadResult = await UploadFile({ file: selectedFile });
        logo_url = uploadResult.file_url;
      }
      const configData = { ...config, logo_url };
      if (config.id) {
        await Configuracao.update(config.id, configData);
      } else {
        await Configuracao.create(configData);
      }
      setSuccessConfig("Configurações salvas com sucesso! Recarregue a página para ver todas as mudanças.");
      loadConfig();
      document.documentElement.style.setProperty('--primary-color', config.tema_cor);
    } catch (error) {
      setErrorConfig("Erro ao salvar configurações");
      console.error(error);
    } finally {
      setLoadingConfig(false);
    }
  };
  
  const addDeletionLog = (message) => {
    setDeletionLogs(prevLogs => [...prevLogs, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const deleteAllRecords = async (entity, entityName, addProgress) => {
    const DELAY_BETWEEN_DELETES_MS = 150;
    let totalRecordsInEntity = 0;
    let successfullyDeletedCount = 0;
    let failedToDeleteCount = 0;
    try {
      addProgress(`Iniciando exclusão de ${entityName}...`);
      const records = await entity.list();
      totalRecordsInEntity = records.length;
      addProgress(`Encontrados ${totalRecordsInEntity} registros em ${entityName}.`);
      if (totalRecordsInEntity === 0) {
        addProgress(`${entityName} já está vazio.`);
        return;
      }
      for (let i = 0; i < totalRecordsInEntity; i++) {
        const record = records[i];
        try {
          await entity.delete(record.id);
          successfullyDeletedCount++;
          if ((successfullyDeletedCount % 10 === 0) || (i === totalRecordsInEntity - 1)) {
            addProgress(`Excluídos ${successfullyDeletedCount} de ${totalRecordsInEntity} de ${entityName}... (ID: ${record.id})`);
          }
          if (DELAY_BETWEEN_DELETES_MS > 0) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_DELETES_MS));
          }
        } catch (itemError) {
          failedToDeleteCount++;
          console.error(`Erro ao excluir item ID ${record.id} de ${entityName}:`, itemError);
          addProgress(`ERRO ao excluir item ID ${record.id} de ${entityName}: ${itemError.message}. Tentativas com falha: ${failedToDeleteCount}.`);
          if (itemError.message && itemError.message.toLowerCase().includes("network error") && failedToDeleteCount > 5) {
             addProgress(`Muitos erros de rede consecutivos. Interrompendo a exclusão de ${entityName}.`);
             throw new Error(`Muitos erros de rede ao excluir ${entityName}.`);
          }
        }
      }
      if (successfullyDeletedCount > 0) addProgress(`Exclusão de ${entityName} concluída. ${successfullyDeletedCount} registros excluídos.`);
      if (failedToDeleteCount > 0) addProgress(`${failedToDeleteCount} registros de ${entityName} não puderam ser excluídos.`);
      if (successfullyDeletedCount === 0 && failedToDeleteCount === 0 && totalRecordsInEntity > 0) addProgress(`Nenhum registro processado em ${entityName}.`);
    } catch (e) {
      console.error(`Erro crítico durante exclusão de ${entityName}:`, e);
      addProgress(`ERRO GERAL ao processar ${entityName}: ${e.message}.`);
    }
  };
  
  const handleDeleteCadastros = async () => {
    setIsDeleting(true);
    setErrorConfig(null); setSuccessConfig(null); setDeletionLogs([]);
    addDeletionLog("Iniciando exclusão de dados de Cadastro...");
    try {
      await deleteAllRecords(Cliente, "Clientes", addDeletionLog);
      await deleteAllRecords(Veiculo, "Veículos", addDeletionLog);
      await deleteAllRecords(Especie, "Espécies", addDeletionLog);
      await deleteAllRecords(DVPFItem, "Itens de DVPF", addDeletionLog);
      await deleteAllRecords(DVPF, "DVPFs", addDeletionLog);
      await deleteAllRecords(Explorador, "Exploradores", addDeletionLog);
      await deleteAllRecords(Romaneador, "Romaneadores", addDeletionLog);
      setSuccessConfig("Todos os dados de Cadastro foram excluídos com sucesso!");
      addDeletionLog("SUCESSO: Todos os dados de Cadastro foram excluídos.");
    } catch (e) {
      setErrorConfig(`Erro ao excluir dados de Cadastro: ${e.message}.`);
      addDeletionLog(`FALHA GERAL: ${e.message}`);
    } finally { setIsDeleting(false); }
  };

  const handleDeleteEntradas = async () => {
    setIsDeleting(true);
    setErrorConfig(null); setSuccessConfig(null); setDeletionLogs([]);
    addDeletionLog("Iniciando exclusão de dados de Entrada...");
    try {
      await deleteAllRecords(EntradaItem, "Itens de Entrada", addDeletionLog);
      await deleteAllRecords(Entrada, "Entradas", addDeletionLog);
      setSuccessConfig("Todos os dados de Entrada foram excluídos com sucesso!");
      addDeletionLog("SUCESSO: Todos os dados de Entrada foram excluídos.");
    } catch (e) {
      setErrorConfig(`Erro ao excluir dados de Entrada: ${e.message}.`);
      addDeletionLog(`FALHA GERAL: ${e.message}`);
    } finally { setIsDeleting(false); }
  };

  const handleDeleteSaidas = async () => {
    setIsDeleting(true);
    setErrorConfig(null); setSuccessConfig(null); setDeletionLogs([]);
    addDeletionLog("Iniciando exclusão de dados de Saída...");
    try {
      await deleteAllRecords(SaidaItem, "Itens de Saída", addDeletionLog);
      await deleteAllRecords(Saida, "Saídas", addDeletionLog);
      setSuccessConfig("Todos os dados de Saída foram excluídos com sucesso!");
      addDeletionLog("SUCESSO: Todos os dados de Saída foram excluídos.");
    } catch (e) {
      setErrorConfig(`Erro ao excluir dados de Saída: ${e.message}.`);
      addDeletionLog(`FALHA GERAL: ${e.message}`);
    } finally { setIsDeleting(false); }
  };

  // Funções para Controle de Versões (NOVAS - adaptadas de ControleVersoes.js)
  const loadVersoesData = async () => {
    setLoadingVersoes(true);
    setErrorVersoes(null);
    try {
      // currentUser já deve estar carregado por loadConfig
      const versoesData = await VersaoSistema.list('-data_criacao');
      setVersoes(versoesData);
    } catch (error) {
      console.error("Erro ao carregar dados de versões:", error);
      setErrorVersoes("Erro ao carregar versões do sistema");
    } finally {
      setLoadingVersoes(false);
    }
  };

  const handleCreateVersion = async (e) => {
    e.preventDefault();
    if (!newVersion.descricao.trim()) {
      setErrorVersoes("Descrição é obrigatória");
      return;
    }
    setCreatingVersion(true);
    setErrorVersoes(null);
    setSuccessVersoes(null);
    try {
      const response = await criarVersaoBackup({
        descricao: newVersion.descricao.trim(),
        tipo: newVersion.tipo
      });
      if (response.status === 200) {
        const blob = new Blob([response.data], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`;
        link.click();
        window.URL.revokeObjectURL(url);
        setSuccessVersoes("Versão criada e backup baixado com sucesso!");
        setIsCreateVersionDialogOpen(false);
        resetCreateVersionForm();
        loadVersoesData(); // Recarrega apenas os dados das versões
      } else {
        throw new Error(response.data?.error || "Erro ao criar versão");
      }
    } catch (error) {
      console.error("Erro ao criar versão:", error);
      setErrorVersoes(`Erro ao criar versão: ${error.message}`);
    } finally {
      setCreatingVersion(false);
    }
  };

  const handleRestoreVersion = async (e) => {
    e.preventDefault();
    if (!restoreFile) {
      setErrorVersoes("Selecione um arquivo de backup");
      return;
    }
    if (!confirmRestore) {
      setErrorVersoes("Você deve confirmar que entende que esta ação irá substituir todos os dados atuais");
      return;
    }
    setRestoringVersion(true);
    setErrorVersoes(null);
    setSuccessVersoes(null);
    try {
      const formData = new FormData();
      formData.append('backup_file', restoreFile);
      formData.append('confirmar', 'true');
      const response = await restaurarVersao(formData);
      if (response.status === 200) {
        const result = response.data;
        setSuccessVersoes(`Restauração concluída! ${result.detalhes?.totalSucesso || 0} registros restaurados. A página será recarregada.`);
        setIsRestoreVersionDialogOpen(false);
        resetRestoreVersionForm();
        loadVersoesData();
        setTimeout(() => { window.location.reload(); }, 3000);
      } else {
        throw new Error(response.data?.error || "Erro ao restaurar versão");
      }
    } catch (error) {
      console.error("Erro ao restaurar versão:", error);
      setErrorVersoes(`Erro ao restaurar versão: ${error.message}`);
    } finally {
      setRestoringVersion(false);
    }
  };

  const resetCreateVersionForm = () => {
    setNewVersion({ descricao: "", tipo: "manual" });
  };

  const resetRestoreVersionForm = () => {
    setRestoreFile(null);
    setConfirmRestore(false);
  };

  const getVersionStatusIcon = (status) => {
    switch (status) {
      case 'ativa': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'arquivada': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'corrompida': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getVersionTipoIcon = (tipo) => {
    switch (tipo) {
      case 'manual': return <UserIcon className="h-4 w-4 text-blue-600" />;
      case 'automatica': return <RotateCcw className="h-4 w-4 text-purple-600" />;
      case 'critica': return <Shield className="h-4 w-4 text-red-600" />;
      default: return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
      </div>

      {/* Mensagens de feedback gerais para Configurações (pode ser melhorado para ser específico da aba) */}
      {errorConfig && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro nas Configurações</AlertTitle>
          <AlertDescription>{errorConfig}</AlertDescription>
        </Alert>
      )}
      {successConfig && (
        <Alert className="bg-green-50 border-green-200">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Sucesso nas Configurações</AlertTitle>
          <AlertDescription className="text-green-700">{successConfig}</AlertDescription>
        </Alert>
      )}
      {/* Mensagens de feedback para Versões (serão mostradas dentro da aba) */}


      <Tabs defaultValue="geral" onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3"> {/* Alterado para 3 colunas */}
          <TabsTrigger value="geral">
            <Settings className="w-4 h-4 mr-2" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="dados">
            <Database className="w-4 h-4 mr-2" />
            Gerenciar Dados
          </TabsTrigger>
          <TabsTrigger value="versoes"> {/* NOVA ABA */}
            <History className="w-4 h-4 mr-2" />
            Controle de Versões
          </TabsTrigger>
        </TabsList>

        {/* Aba Geral (Conteúdo existente) */}
        <TabsContent value="geral" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Gerais</CardTitle>
              <CardDescription>
                Personalize a aparência e as informações do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome do Sistema</Label>
                <Input
                  name="nome_empresa"
                  value={config.nome_empresa}
                  onChange={handleInputChange}
                  placeholder="Nome do sistema"
                />
              </div>
              <div>
                <Label>Cor do Tema</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    name="tema_cor"
                    value={config.tema_cor}
                    onChange={handleInputChange}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={config.tema_cor}
                    onChange={handleInputChange}
                    name="tema_cor"
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label>Logomarca</Label>
                <div className="space-y-2">
                  {config.logo_url && (
                    <div className="w-40 h-40 rounded-lg border overflow-hidden">
                      <img
                        src={config.logo_url}
                        alt="Logo"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <Input
                    type="file"
                    onChange={handleFileChange}
                    accept="image/*"
                  />
                </div>
              </div>
              <Button
                onClick={handleSaveConfig}
                disabled={loadingConfig || isDeleting}
                className="w-full"
              >
                {loadingConfig ? (
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar Configurações Gerais
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Gerenciar Dados (Conteúdo existente) */}
        <TabsContent value="dados" className="space-y-6">
          <Card className="border-red-500">
            <CardHeader>
              <CardTitle className="text-red-700 flex items-center">
                <ShieldAlert className="w-5 h-5 mr-2" />
                Zona de Perigo - Excluir Dados
              </CardTitle>
              <CardDescription className="text-red-600">
                As ações nesta seção são IRREVERSÍVEIS e resultarão na perda permanente de dados.
                Use com extrema cautela. Recomenda-se criar uma versão de backup antes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full" disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Excluir Dados de CADASTRO
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Exclusão Total de Cadastros?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação é IRREVERSÍVEL. Todos os dados de Clientes, Veículos, Espécies, DVPFs, Itens de DVPF, Exploradores e Romaneadores serão permanentemente excluídos.
                      <br /><br /><strong>Tem certeza absoluta que deseja continuar?</strong>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteCadastros}
                      disabled={isDeleting}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Sim, Excluir Cadastros
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full" disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Excluir Dados de ENTRADA
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Exclusão Total de Entradas?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação é IRREVERSÍVEL. Todos os dados de Entradas e seus respectivos Itens de Entrada serão permanentemente excluídos.
                      <br /><br /><strong>Tem certeza absoluta que deseja continuar?</strong>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteEntradas}
                      disabled={isDeleting}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Sim, Excluir Entradas
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full" disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Excluir Dados de SAÍDA
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Exclusão Total de Saídas?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação é IRREVERSÍVEL. Todos os dados de Saídas e seus respectivos Itens de Saída serão permanentemente excluídos.
                      <br /><br /><strong>Tem certeza absoluta que deseja continuar?</strong>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteSaidas}
                      disabled={isDeleting}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Sim, Excluir Saídas
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
            {deletionLogs.length > 0 && (
              <CardFooter className="mt-4">
                <div className="w-full p-3 bg-gray-50 rounded border max-h-60 overflow-y-auto text-xs text-gray-600">
                  <h4 className="font-medium text-gray-700 mb-2">Logs de Exclusão:</h4>
                  {deletionLogs.map((log, index) => (
                    <p key={index}>{log}</p>
                  ))}
                </div>
              </CardFooter>
            )}
          </Card>
        </TabsContent>

        {/* Aba Controle de Versões (NOVO CONTEÚDO) */}
        <TabsContent value="versoes" className="space-y-6">
          {errorVersoes && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erro nas Versões</AlertTitle>
              <AlertDescription>{errorVersoes}</AlertDescription>
            </Alert>
          )}
          {successVersoes && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Sucesso nas Versões</AlertTitle>
              <AlertDescription className="text-green-700">{successVersoes}</AlertDescription>
            </Alert>
          )}

          {loadingVersoes ? (
            <div className="flex items-center justify-center min-h-[30vh]">
              <Loader2 className="h-12 w-12 animate-spin text-emerald-700" />
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                <h2 className="text-xl font-semibold text-gray-700">Gerenciar Versões do Sistema</h2>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setIsRestoreVersionDialogOpen(true)}
                    variant="outline"
                    className="border-blue-600 text-blue-700 hover:bg-blue-50"
                    disabled={!currentUser || currentUser.role !== 'admin' || creatingVersion || restoringVersion}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Restaurar Versão
                  </Button>
                  <Button 
                    onClick={() => setIsCreateVersionDialogOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={creatingVersion || restoringVersion}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Versão de Backup
                  </Button>
                </div>
              </div>
              
              <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center">
                      <Database className="h-5 w-5 mr-2 text-blue-600" /> Total de Versões
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-700">{versoes.length}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-green-600" /> Versões Ativas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-700">
                      {versoes.filter(v => v.status === 'ativa').length}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center">
                      <History className="h-5 w-5 mr-2 text-amber-600" /> Última Versão
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-medium text-amber-700">
                      {versoes.length > 0 
                        ? format(new Date(versoes[0].data_criacao), 'dd/MM/yyyy HH:mm')
                        : 'Nenhuma versão'}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {currentUser && currentUser.role !== 'admin' && (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertTitle>Permissões Limitadas</AlertTitle>
                  <AlertDescription>
                    Você pode criar versões de backup, mas apenas administradores podem restaurar versões.
                  </AlertDescription>
                </Alert>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Versões</CardTitle>
                  <CardDescription>
                    Todas as versões criadas do sistema, ordenadas da mais recente para a mais antiga.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Versão</TableHead>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Criado por</TableHead>
                          <TableHead>Descrição</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {versoes.length > 0 ? (
                          versoes.map((versao) => (
                            <TableRow key={versao.id}>
                              <TableCell className="font-medium font-mono text-sm">{versao.numero_versao}</TableCell>
                              <TableCell className="text-sm">{format(new Date(versao.data_criacao), 'dd/MM/yyyy HH:mm:ss')}</TableCell>
                              <TableCell><div className="flex items-center">{getVersionTipoIcon(versao.tipo)}<span className="ml-2 text-sm capitalize">{versao.tipo}</span></div></TableCell>
                              <TableCell><div className="flex items-center">{getVersionStatusIcon(versao.status)}<span className="ml-2 text-sm capitalize">{versao.status}</span></div></TableCell>
                              <TableCell className="text-sm">{versao.usuario_criacao || 'Sistema'}</TableCell>
                              <TableCell className="text-sm max-w-xs truncate" title={versao.descricao}>{versao.descricao}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">Nenhuma versão criada ainda</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog para Criar Versão (NOVO) */}
      <Dialog open={isCreateVersionDialogOpen} onOpenChange={setIsCreateVersionDialogOpen}>
        <VersionDialogContent className="sm:max-w-md">
          <VersionDialogHeader>
            <VersionDialogTitle className="flex items-center">
              <Save className="h-5 w-5 mr-2 text-emerald-600" /> Criar Nova Versão de Backup
            </VersionDialogTitle>
            <VersionDialogDescription>
              Isso criará um backup completo de todos os dados do sistema e o arquivo será baixado.
            </VersionDialogDescription>
          </VersionDialogHeader>
          <form onSubmit={handleCreateVersion} className="space-y-4">
            <div>
              <Label htmlFor="version_tipo">Tipo de Versão</Label>
              <VersionSelect 
                value={newVersion.tipo} 
                onValueChange={(value) => setNewVersion(prev => ({...prev, tipo: value}))}
              >
                <VersionSelectTrigger id="version_tipo"><VersionSelectValue /></VersionSelectTrigger>
                <VersionSelectContent>
                  <VersionSelectItem value="manual">Manual</VersionSelectItem>
                  <VersionSelectItem value="critica">Crítica</VersionSelectItem>
                </VersionSelectContent>
              </VersionSelect>
            </div>
            <div>
              <Label htmlFor="version_descricao">Descrição *</Label>
              <Textarea
                id="version_descricao"
                value={newVersion.descricao}
                onChange={(e) => setNewVersion(prev => ({...prev, descricao: e.target.value}))}
                placeholder="Descreva as mudanças ou motivo desta versão..."
                rows={3}
                required
              />
            </div>
            <VersionDialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateVersionDialogOpen(false)} disabled={creatingVersion}>Cancelar</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={creatingVersion}>
                {creatingVersion ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</> : <><Save className="h-4 w-4 mr-2" />Criar e Baixar</>}
              </Button>
            </VersionDialogFooter>
          </form>
        </VersionDialogContent>
      </Dialog>

      {/* Dialog para Restaurar Versão (NOVO) */}
      <Dialog open={isRestoreVersionDialogOpen} onOpenChange={setIsRestoreVersionDialogOpen}>
        <VersionDialogContent className="sm:max-w-md">
          <VersionDialogHeader>
            <VersionDialogTitle className="flex items-center text-red-600">
              <AlertTriangle className="h-5 w-5 mr-2" /> Restaurar Versão do Sistema
            </VersionDialogTitle>
            <VersionDialogDescription className="text-red-600">
              <strong>ATENÇÃO:</strong> Esta ação irá substituir TODOS os dados atuais pelos dados do backup. Esta operação é IRREVERSÍVEL! Recomenda-se criar uma versão de backup dos dados atuais primeiro.
            </VersionDialogDescription>
          </VersionDialogHeader>
          <form onSubmit={handleRestoreVersion} className="space-y-4">
            <div>
              <Label htmlFor="backup_file">Arquivo de Backup (.json) *</Label>
              <Input id="backup_file" type="file" accept=".json" onChange={(e) => setRestoreFile(e.target.files[0])} required />
            </div>
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="confirm_restore_version" checked={confirmRestore} onChange={(e) => setConfirmRestore(e.target.checked)} className="rounded" />
              <Label htmlFor="confirm_restore_version" className="text-sm">Eu entendo que esta ação é irreversível e substituirá os dados atuais.</Label>
            </div>
            <VersionDialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRestoreVersionDialogOpen(false)} disabled={restoringVersion}>Cancelar</Button>
              <Button type="submit" variant="destructive" disabled={restoringVersion || !confirmRestore || !restoreFile}>
                {restoringVersion ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Restaurando...</> : <><Upload className="h-4 w-4 mr-2" />Restaurar Sistema</>}
              </Button>
            </VersionDialogFooter>
          </form>
        </VersionDialogContent>
      </Dialog>
    </div>
  );
}