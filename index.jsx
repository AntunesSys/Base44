import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import Clientes from "./Clientes";

import Veiculos from "./Veiculos";

import Especies from "./Especies";

import DVPF from "./DVPF";

import Exploradores from "./Exploradores";

import Romaneadores from "./Romaneadores";

import Entradas from "./Entradas";

import Saidas from "./Saidas";

import Relatorios from "./Relatorios";

import Notificacoes from "./Notificacoes";

import Configuracoes from "./Configuracoes";

import Layout from "./Layout";

import RecalculateVolumes from "./RecalculateVolumes";

import EntradaSEMA from "./EntradaSEMA";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    Clientes: Clientes,
    
    Veiculos: Veiculos,
    
    Especies: Especies,
    
    DVPF: DVPF,
    
    Exploradores: Exploradores,
    
    Romaneadores: Romaneadores,
    
    Entradas: Entradas,
    
    Saidas: Saidas,
    
    Relatorios: Relatorios,
    
    Notificacoes: Notificacoes,
    
    Configuracoes: Configuracoes,
    
    Layout: Layout,
    
    RecalculateVolumes: RecalculateVolumes,
    
    EntradaSEMA: EntradaSEMA,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Clientes" element={<Clientes />} />
                
                <Route path="/Veiculos" element={<Veiculos />} />
                
                <Route path="/Especies" element={<Especies />} />
                
                <Route path="/DVPF" element={<DVPF />} />
                
                <Route path="/Exploradores" element={<Exploradores />} />
                
                <Route path="/Romaneadores" element={<Romaneadores />} />
                
                <Route path="/Entradas" element={<Entradas />} />
                
                <Route path="/Saidas" element={<Saidas />} />
                
                <Route path="/Relatorios" element={<Relatorios />} />
                
                <Route path="/Notificacoes" element={<Notificacoes />} />
                
                <Route path="/Configuracoes" element={<Configuracoes />} />
                
                <Route path="/Layout" element={<Layout />} />
                
                <Route path="/RecalculateVolumes" element={<RecalculateVolumes />} />
                
                <Route path="/EntradaSEMA" element={<EntradaSEMA />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}