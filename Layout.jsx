
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/api/entities";
import { Notificacao } from "@/api/entities";
import { Configuracao } from "@/api/entities";
import { 
  Menu, X, ChevronDown, User as UserIcon, Truck, FileText, 
  LogIn, LogOut, FileBarChart2, Bell, Settings, Layers, TreePine, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


export default function Layout({ children, currentPageName }) {
  const [isOpen, setIsOpen] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(true); // Único estado de loading
  const [subMenuOpen, setSubMenuOpen] = useState("");
  const [configuracao, setConfiguracao] = useState(null);
  const [layoutError, setLayoutError] = useState(null); // Estado para erros de layout

  // Efeito para carregar usuário e notificações (uma vez na montagem inicial)
  useEffect(() => {
    async function loadUserAndNotifications() {
      try {
        const user = await User.me();
        setUserInfo(user);
        
        const notifications = await Notificacao.filter({ lida: false });
        setNotificacoes(notifications);
      } catch (error) {
        console.warn("Layout: Erro ao carregar usuário ou notificações:", error);
        if (error.response && error.response.status === 429) {
          setLayoutError("Muitas solicitações ao servidor (usuário/notificações). Tente novamente em alguns minutos.");
        } else {
          setLayoutError("Erro ao carregar dados do usuário ou notificações.");
        }
      }
    }
    loadUserAndNotifications();
  }, []);

  // Efeito para carregar configurações (uma vez na montagem inicial)
  useEffect(() => {
    async function loadConfigs() {
      if (!configuracao) { // Só carrega se não tiver
        try {
          const configs = await Configuracao.list();
          if (configs.length > 0) {
            setConfiguracao(configs[0]);
            // applyTheme será chamado pelo próximo efeito
          }
        } catch (error) {
          console.warn("Layout: Erro ao carregar configurações:", error);
           if (error.response && error.response.status === 429) {
            setLayoutError("Muitas solicitações ao servidor (configurações). Tente novamente em alguns minutos.");
          } else if (!layoutError) { // Só define erro de config se não houver erro de user/notif
            setLayoutError("Erro ao carregar configurações do sistema.");
          }
        }
      }
    }
    
    // setLoading(true) no início do ciclo de vida do Layout
    // setLoading(false) após todas as chamadas principais
    Promise.allSettled([loadConfigs()]).finally(() => {
        setLoading(false);
    });

  }, []); // Array de dependência vazio para executar apenas uma vez

  // Efeito para aplicar o tema sempre que a configuração mudar
  useEffect(() => {
    if (configuracao) {
      applyTheme(configuracao);
    }
  }, [configuracao]); // Executa quando 'configuracao' muda


  const applyTheme = (config) => {
    // ... keep existing code (applyTheme)
  };

  const toggleSubmenu = (menu) => {
    // ... keep existing code (toggleSubmenu)
  };

  const closeMenu = () => {
    // ... keep existing code (closeMenu)
  };

  const systemName = configuracao?.nome_empresa || "FlorestGestão";
  const primaryColor = configuracao?.tema_cor || "#047857"; // Verde esmeralda como padrão
  const logoUrl = configuracao?.logo_url;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-green-50 to-teal-50">
      {/* ... keep existing code (style jsx global) */}
      {/* ... keep existing code (Sidebar) */}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ... keep existing code (Header) */}
        
        {/* Main Content Area */}
        <main className="flex-1 p-6 overflow-x-hidden">
          <div className="max-w-screen-2xl mx-auto">
            {layoutError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro de Carregamento</AlertTitle>
                <AlertDescription>
                  {layoutError}
                </AlertDescription>
              </Alert>
            )}
            {loading && !layoutError ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700"></div>
                </div>
            ) : children}
          </div>
        </main>
        
        {/* ... keep existing code (Footer) */}
      </div>
    </div>
  );
}
