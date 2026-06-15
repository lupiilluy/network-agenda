import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bell,
  Briefcase,
  Building2,
  Car,
  Check,
  CheckCircle,
  ChevronRight,
  Circle,
  Cloud,
  Compass,
  ContactRound,
  GraduationCap,
  HeartPulse,
  Home,
  LayoutGrid,
  Lock,
  LogIn,
  LogOut,
  Map,
  MapPin,
  Menu,
  MessageCircle,
  Navigation,
  Phone,
  Plus,
  Route,
  Scale,
  Search,
  Pencil,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserRound,
  UsersRound,
  X,
  Zap,
} from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8006'
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const GOOGLE_LOGIN_SCOPE = 'openid email profile'
const GOOGLE_CONTACTS_SCOPE = 'https://www.googleapis.com/auth/contacts.readonly'
const GOOGLE_ACCOUNT_PROFILE_SCOPE = `${GOOGLE_LOGIN_SCOPE} https://www.googleapis.com/auth/user.phonenumbers.read https://www.googleapis.com/auth/user.birthday.read`
const AUTH_STORAGE_KEY = 'network-agenda-user'
const AUTH_TTL_MS = 24 * 60 * 60 * 1000

const ROUTES = {
  DASHBOARD: '/dashboard',
  AGENDA: '/agenda',
  MAP: '/mapa',
  PUBLIC: '/rede',
  CHAT: '/chat',
  SETTINGS: '/configuracoes',
  DUPLICATES: '/duplicados',
  CRM: '/crm',
  PUBLIC_PROFILE: '/perfil-publico',
  CONTACT: '/contato',
  NEW: '/novo',
  LOGIN: '/login',
  REGISTER: '/cadastro',
  CONNECTIONS: '/admin/conexoes',
}

const CATS = [
  { id: 'home', label: 'Casa', col: '#10b981' },
  { id: 'legal', label: 'Juridico', col: '#3b82f6' },
  { id: 'business', label: 'Negocios', col: '#f59e0b' },
  { id: 'tech', label: 'Tech', col: '#06b6d4' },
]

const CONTACTS_SEED = [
  { id: 'c1', name: 'Joao Martins', svc: 'eletricista residencial', city: 'São Paulo', trust: 'Recomendado', src: 'Google', note: 'Emergencia e instalacao de chuveiro', cat: 'home' },
  { id: 'c2', name: 'Mariana Costa', svc: 'advogada trabalhista', city: 'Santo Andre', trust: 'Favorito', src: 'Manual', note: 'Contratos, rescisao e PME', cat: 'legal' },
  { id: 'c3', name: 'Renato Lima', svc: 'contador para MEI', city: 'Rio de Janeiro', trust: 'Confiavel', src: 'Importado', note: 'Abertura de empresa e DAS mensal', cat: 'business' },
  { id: 'c4', name: 'Aline Prado', svc: 'designer de site', city: 'São Paulo', trust: 'Novo', src: 'Indicacao', note: 'Landing pages e identidade visual', cat: 'tech' },
  { id: 'c5', name: 'Carlos Nogueira', svc: 'pintor e reformas', city: 'Osasco', trust: 'Recomendado', src: 'iCloud', note: 'Apartamento e acabamento', cat: 'home' },
]

const GROUPS_SEED = [
  { id: 'g1', name: 'Eletricistas SP', svc: 'eletricista · manutencao', people: 42, resp: '18 min', score: 4.8, cat: 'home' },
  { id: 'g2', name: 'Rede Juridica PME', svc: 'juridico · contratos', people: 28, resp: '1 h', score: 4.7, cat: 'legal' },
  { id: 'g3', name: 'Casa e Reforma', svc: 'pintura · reforma', people: 67, resp: '25 min', score: 4.6, cat: 'home' },
  { id: 'g4', name: 'Tech Negocios', svc: 'site · software · design', people: 35, resp: '45 min', score: 4.9, cat: 'tech' },
]

const TRUST_COL = { Favorito: '#f59e0b', Recomendado: '#06b6d4', Confiavel: '#10b981', Novo: '#64748b' }

function catCol(id) {
  return CATS.find((category) => category.id === id)?.col ?? '#64748b'
}

const categoryCatalog = [
  {
    id: 'home',
    label: 'Casa e manutenção',
    group: 'Serviços domésticos',
    icon: Home,
    color: '#059669',
    keywords: ['eletricista', 'encanador', 'pintor', 'pintura', 'reforma', 'pedreiro', 'marceneiro', 'limpeza', 'jardineiro', 'diarista', 'faxina', 'montador', 'chaveiro', 'vidraceiro', 'gesseiro'],
    synonyms: ['instalacao', 'reparo', 'emergencia', 'manutencao', 'residencial', 'obra', 'condominio'],
  },
  {
    id: 'legal',
    label: 'Jurídico',
    group: 'Serviços profissionais',
    icon: Scale,
    color: '#2563eb',
    keywords: ['advogado', 'advogada', 'jurídico', 'jurídica', 'trabalhista', 'contrato', 'contratos', 'civil', 'tributario', 'previdenciario', 'familia', 'cartorio'],
    synonyms: ['processo', 'direito', 'documentos', 'defesa', 'regularizacao'],
  },
  {
    id: 'health',
    label: 'Saúde',
    group: 'Cuidado pessoal',
    icon: HeartPulse,
    color: '#e11d48',
    keywords: ['medico', 'medica', 'dentista', 'psicologo', 'psicologa', 'fisioterapeuta', 'nutricionista', 'enfermeiro', 'enfermeira', 'fono', 'terapeuta', 'ortopedista', 'pediatra', 'dermato', 'hospital', 'drogaria', 'farmacia'],
    synonyms: ['consulta', 'tratamento', 'clinica', 'saude', 'exame', 'terapia', 'remedio'],
  },
  {
    id: 'business',
    label: 'Empresas e negócios',
    group: 'Operação',
    icon: Building2,
    color: '#ca8a04',
    keywords: ['consultor', 'consultoria', 'marketing', 'vendas', 'rh', 'recrutamento', 'gestor', 'gestora', 'administracao', 'comercial', 'coach', 'mentoria empresarial'],
    synonyms: ['empresa', 'gestão', 'estrategia', 'operacao', 'negocio', 'b2b'],
  },
  {
    id: 'tech',
    label: 'Tecnologia',
    group: 'Digital',
    icon: Briefcase,
    color: '#0891b2',
    keywords: ['programador', 'programadora', 'desenvolvedor', 'desenvolvedora', 'designer', 'ti', 'suporte', 'software', 'web', 'site', 'app', 'dados', 'dev', 'ux', 'ui', 'infra'],
    synonyms: ['sistema', 'automacao', 'produto digital', 'tecnologia', 'informatica'],
  },
  {
    id: 'education',
    label: 'Educação',
    group: 'Aulas e mentoria',
    icon: GraduationCap,
    color: '#7c3aed',
    keywords: ['professor', 'professora', 'aula', 'ingles', 'matematica', 'mentor', 'mentoria', 'instrutor', 'instrutora', 'escola', 'faculdade', 'tradutor', 'tradutora', 'creche'],
    synonyms: ['curso', 'reforco', 'aprendizado', 'ensino', 'educacao'],
  },
  {
    id: 'vehicle',
    label: 'Veículos',
    group: 'Mobilidade',
    icon: Car,
    color: '#475569',
    keywords: ['mecanico', 'auto', 'carro', 'moto', 'funilaria', 'guincho', 'motorista', 'uber', 'taxi', 'lavagem', 'estetica automotiva'],
    synonyms: ['oficina', 'revisao', 'transporte', 'veiculo', 'automotivo'],
  },
  {
    id: 'beauty',
    label: 'Beleza e estética',
    group: 'Cuidado pessoal',
    icon: Sparkles,
    color: '#db2777',
    keywords: ['cabeleireiro', 'cabeleireira', 'barbeiro', 'barbearia', 'manicure', 'pedicure', 'maquiador', 'maquiadora', 'esteticista', 'massagista', 'sobrancelha', 'cilios', 'depilacao', 'salao'],
    synonyms: ['beleza', 'estetica', 'unha', 'cabelo', 'make', 'spa'],
  },
  {
    id: 'food_events',
    label: 'Alimentação e eventos',
    group: 'Experiências',
    icon: Activity,
    color: '#ea580c',
    keywords: ['buffet', 'confeiteira', 'confeiteiro', 'bolo', 'doces', 'salgados', 'chef', 'cozinheira', 'cozinheiro', 'restaurante', 'bar', 'padaria', 'cerimonial', 'fotografo', 'fotografa', 'decorador', 'decoradora', 'dj', 'evento', 'eventos'],
    synonyms: ['festa', 'casamento', 'aniversario', 'comida', 'delivery', 'gastronomia'],
  },
  {
    id: 'real_estate',
    label: 'Imóveis',
    group: 'Moradia e patrimônio',
    icon: Building2,
    color: '#16a34a',
    keywords: ['corretor', 'corretora', 'imobiliaria', 'imovel', 'imoveis', 'aluguel', 'locacao', 'arquiteto', 'arquiteta', 'engenheiro civil', 'engenheira civil'],
    synonyms: ['apartamento', 'terreno', 'condominio', 'obra', 'projeto arquitetonico'],
  },
  {
    id: 'finance',
    label: 'Finanças e seguros',
    group: 'Planejamento',
    icon: Briefcase,
    color: '#0f766e',
    keywords: ['contador', 'contadora', 'contabilidade', 'financeiro', 'financas', 'seguro', 'seguros', 'corretor de seguros', 'banco', 'investimento', 'investimentos', 'mei', 'imposto'],
    synonyms: ['irpf', 'nota fiscal', 'dinheiro', 'credito', 'planejamento financeiro'],
  },
  {
    id: 'creative',
    label: 'Comunicação e conteúdo',
    group: 'Criativo',
    icon: Pencil,
    color: '#7c3aed',
    keywords: ['social media', 'redator', 'redatora', 'copywriter', 'jornalista', 'fotografo', 'fotografa', 'videomaker', 'editor', 'editora', 'branding', 'trafego', 'anuncios'],
    synonyms: ['conteudo', 'instagram', 'midia', 'comunicacao', 'marca', 'criativo'],
  },
  {
    id: 'travel',
    label: 'Viagens e lazer',
    group: 'Estilo de vida',
    icon: Compass,
    color: '#0284c7',
    keywords: ['agente de viagens', 'turismo', 'hotel', 'pousada', 'guia', 'personal trainer', 'academia', 'pilates', 'yoga', 'musica', 'banda'],
    synonyms: ['viagem', 'lazer', 'treino', 'fitness', 'passeio', 'hospedagem'],
  },
]

const generalCategory = {
  id: 'general',
  label: 'Serviços gerais',
  group: 'Rede útil',
  icon: UsersRound,
  color: '#64748b',
  keywords: [],
  synonyms: ['contato útil', 'indicação', 'network'],
}

const contactsSeed = [
  {
    id: 1,
    name: 'Joao Martins',
    phone: '11 99418-2300',
    service: 'eletricista residencial',
    note: 'Atende emergencia e instalacao de chuveiro',
    city: 'São Paulo',
    address: 'Avenida Paulista, São Paulo, SP',
    trust: 'Recomendado',
    source: 'Google Contacts',
    created_at: '2026-05-28 12:00:00',
  },
  {
    id: 2,
    name: 'Mariana Costa',
    phone: '11 98842-1204',
    service: 'advogada trabalhista',
    note: '',
    city: 'Santo Andre',
    address: 'Centro, Santo Andre, SP',
    trust: 'Favorito',
    source: 'Manual',
    created_at: '2026-05-27 12:00:00',
  },
  {
    id: 3,
    name: 'Renato Lima',
    phone: '21 99710-4331',
    service: 'contador para MEI',
    note: 'Abertura de empresa e imposto mensal',
    city: 'Rio de Janeiro',
    address: 'Centro, Rio de Janeiro, RJ',
    trust: 'Confiavel',
    source: 'Importado',
    created_at: '2026-05-25 12:00:00',
  },
  {
    id: 4,
    name: 'Aline Prado',
    phone: '11 97340-8932',
    service: 'designer de site',
    note: 'Landing pages e identidade simples',
    city: 'São Paulo',
    address: 'Pinheiros, São Paulo, SP',
    trust: 'Novo',
    source: 'Indicacao',
    created_at: '2026-05-23 12:00:00',
  },
  {
    id: 5,
    name: 'Carlos Nogueira',
    phone: '11 94420-6651',
    service: 'pintor e pequenas reformas',
    note: 'Apartamento, escritorio e acabamento',
    city: 'Osasco',
    address: 'Centro, Osasco, SP',
    trust: 'Recomendado',
    source: 'iCloud',
    created_at: '2026-05-20 12:00:00',
  },
]

const publicProfilesSeed = [
  {
    id: 101,
    name: 'Grupo de eletricistas verificados',
    service: 'eletricista, manutenção residencial, instalação',
    area: 'São Paulo e ABC',
    people: 42,
    response: '18 min',
    score: 4.8,
  },
  {
    id: 102,
    name: 'Rede jurídica para pequenos negócios',
    service: 'jurídico, contratos, trabalhista, societário',
    area: 'Online e presencial',
    people: 28,
    response: '1 h',
    score: 4.7,
  },
  {
    id: 103,
    name: 'Profissionais de casa e reforma',
    service: 'pintura, reforma, encanador, marceneiro',
    area: 'Grande São Paulo',
    people: 67,
    response: '25 min',
    score: 4.6,
  },
  {
    id: 104,
    name: 'Tecnologia para negócios locais',
    service: 'site, suporte, software, automação, design',
    area: 'Brasil',
    people: 35,
    response: '45 min',
    score: 4.9,
  },
]

const defaultUser = {
  name: 'Ana',
  id: null,
  birthDate: '1995-01-01',
  email: 'ana@network.local',
  password: '',
  phone: '11 99999-0000',
  cep: '01311-000',
  addressLine: 'Avenida Paulista',
  addressNumber: '',
  addressComplement: '',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  address: 'Avenida Paulista, São Paulo, SP',
  addressVisible: false,
  interests: ['home', 'tech'],
  isCollaborator: false,
  offeredServices: '',
  useDifferentServiceAddress: false,
  serviceCep: '',
  serviceAddressLine: '',
  serviceAddressNumber: '',
  serviceAddressComplement: '',
  serviceNeighborhood: '',
  serviceCity: '',
  serviceState: '',
  serviceAddress: '',
  serviceAddressVisible: true,
  publicVisible: false,
  publicDescription: '',
  publicDemand: '',
  publicSolves: '',
  publicTags: '',
  publicWhatsapp: '',
  publicInstagram: '',
  publicLinkedin: '',
  publicUrl: '',
  googleConnected: false,
  googleContactsImportedAt: '',
  googleProfileSyncedAt: '',
  role: 'user',
}

const adminUser = {
  name: 'Admin',
  id: null,
  birthDate: '1990-01-01',
  email: 'admin@network.local',
  password: '',
  phone: '11 90000-0000',
  cep: '01311-000',
  addressLine: 'Avenida Paulista',
  addressNumber: '',
  addressComplement: '',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  address: 'Avenida Paulista, São Paulo, SP',
  addressVisible: false,
  interests: ['home', 'business', 'tech'],
  isCollaborator: true,
  offeredServices: 'gestão da rede, curadoria, suporte',
  useDifferentServiceAddress: false,
  serviceCep: '',
  serviceAddressLine: '',
  serviceAddressNumber: '',
  serviceAddressComplement: '',
  serviceNeighborhood: '',
  serviceCity: '',
  serviceState: '',
  serviceAddress: '',
  serviceAddressVisible: true,
  publicVisible: true,
  publicDescription: 'Administração e curadoria de redes, perfis e oportunidades de networking.',
  publicDemand: 'Parcerias, eventos e comunidades para testar o Network Intelligence CRM.',
  publicSolves: 'Organização de contatos, conexões e inteligência de relacionamento.',
  publicTags: 'networking, comunidade, crm',
  publicWhatsapp: '',
  publicInstagram: '',
  publicLinkedin: '',
  publicUrl: '',
  googleConnected: false,
  googleContactsImportedAt: '',
  googleProfileSyncedAt: '',
  role: 'admin',
}

const fallbackCoordinates = {
  'sao paulo': { lat: -23.55052, lng: -46.633308 },
  'santo andre': { lat: -23.663889, lng: -46.538333 },
  osasco: { lat: -23.5329, lng: -46.7918 },
  'rio de janeiro': { lat: -22.906847, lng: -43.172897 },
  pinheiros: { lat: -23.5614, lng: -46.7016 },
  centro: { lat: -23.55052, lng: -46.633308 },
}

const crmStages = [
  { id: 'Novo', label: 'Novo', color: '#22d3ee' },
  { id: 'Conversa iniciada', label: 'Conversa', color: '#60a5fa' },
  { id: 'Follow-up', label: 'Follow-up', color: '#f59e0b' },
  { id: 'Oportunidade', label: 'Oportunidade', color: '#a78bfa' },
  { id: 'Ativo', label: 'Ativo', color: '#10b981' },
  { id: 'Pausado', label: 'Pausado', color: '#64748b' },
]

const crmPriorities = ['Alta', 'Média', 'Baixa']

const dddCoordinates = {
  11: { label: 'São Paulo e região', query: 'São Paulo, SP', lat: -23.55052, lng: -46.633308 },
  12: { label: 'Vale do Paraíba e litoral norte', query: 'São José dos Campos, SP', lat: -23.2237, lng: -45.9009 },
  13: { label: 'Baixada Santista', query: 'Santos, SP', lat: -23.9608, lng: -46.3336 },
  14: { label: 'Bauru e centro-oeste paulista', query: 'Bauru, SP', lat: -22.3145, lng: -49.0587 },
  15: { label: 'Sorocaba e região', query: 'Sorocaba, SP', lat: -23.5015, lng: -47.4526 },
  16: { label: 'Ribeirão Preto e região', query: 'Ribeirão Preto, SP', lat: -21.1775, lng: -47.8103 },
  17: { label: 'São José do Rio Preto e região', query: 'São José do Rio Preto, SP', lat: -20.8113, lng: -49.3758 },
  18: { label: 'Presidente Prudente e região', query: 'Presidente Prudente, SP', lat: -22.1207, lng: -51.3925 },
  19: { label: 'Campinas e região', query: 'Campinas, SP', lat: -22.9099, lng: -47.0626 },
  21: { label: 'Rio de Janeiro e região', query: 'Rio de Janeiro, RJ', lat: -22.9068, lng: -43.1729 },
  22: { label: 'Norte e Lagos do RJ', query: 'Campos dos Goytacazes, RJ', lat: -21.7622, lng: -41.3181 },
  24: { label: 'Sul fluminense', query: 'Volta Redonda, RJ', lat: -22.5202, lng: -44.0996 },
  27: { label: 'Vitória e região', query: 'Vitória, ES', lat: -20.3155, lng: -40.3128 },
  28: { label: 'Sul do Espírito Santo', query: 'Cachoeiro de Itapemirim, ES', lat: -20.8467, lng: -41.1129 },
  31: { label: 'Belo Horizonte e região', query: 'Belo Horizonte, MG', lat: -19.9167, lng: -43.9345 },
  32: { label: 'Juiz de Fora e Zona da Mata', query: 'Juiz de Fora, MG', lat: -21.7622, lng: -43.3434 },
  33: { label: 'Vale do Rio Doce e leste de Minas', query: 'Governador Valadares, MG', lat: -18.8545, lng: -41.9555 },
  34: { label: 'Triângulo Mineiro', query: 'Uberlândia, MG', lat: -18.9146, lng: -48.2754 },
  35: { label: 'Sul de Minas', query: 'Pouso Alegre, MG', lat: -22.2266, lng: -45.9389 },
  37: { label: 'Centro-oeste de Minas', query: 'Divinópolis, MG', lat: -20.1389, lng: -44.8839 },
  38: { label: 'Norte de Minas', query: 'Montes Claros, MG', lat: -16.7282, lng: -43.8578 },
  41: { label: 'Curitiba e região', query: 'Curitiba, PR', lat: -25.4284, lng: -49.2733 },
  42: { label: 'Ponta Grossa e centro-sul do Paraná', query: 'Ponta Grossa, PR', lat: -25.095, lng: -50.1619 },
  43: { label: 'Londrina e norte do Paraná', query: 'Londrina, PR', lat: -23.3045, lng: -51.1696 },
  44: { label: 'Maringá e noroeste do Paraná', query: 'Maringá, PR', lat: -23.4205, lng: -51.9331 },
  45: { label: 'Oeste do Paraná', query: 'Cascavel, PR', lat: -24.9555, lng: -53.4552 },
  46: { label: 'Sudoeste do Paraná', query: 'Pato Branco, PR', lat: -26.2292, lng: -52.6706 },
  47: { label: 'Joinville e norte de SC', query: 'Joinville, SC', lat: -26.3044, lng: -48.8487 },
  48: { label: 'Florianópolis e região', query: 'Florianópolis, SC', lat: -27.5949, lng: -48.5482 },
  49: { label: 'Oeste catarinense', query: 'Chapecó, SC', lat: -27.1004, lng: -52.6152 },
  51: { label: 'Porto Alegre e região', query: 'Porto Alegre, RS', lat: -30.0346, lng: -51.2177 },
  53: { label: 'Sul do Rio Grande do Sul', query: 'Pelotas, RS', lat: -31.7654, lng: -52.3376 },
  54: { label: 'Serra gaúcha', query: 'Caxias do Sul, RS', lat: -29.1678, lng: -51.1794 },
  55: { label: 'Centro-oeste do Rio Grande do Sul', query: 'Santa Maria, RS', lat: -29.6868, lng: -53.8149 },
  61: { label: 'Distrito Federal e entorno', query: 'Brasília, DF', lat: -15.7939, lng: -47.8828 },
  62: { label: 'Goiânia e região', query: 'Goiânia, GO', lat: -16.6869, lng: -49.2648 },
  63: { label: 'Tocantins', query: 'Palmas, TO', lat: -10.184, lng: -48.3336 },
  64: { label: 'Sul de Goiás', query: 'Rio Verde, GO', lat: -17.7923, lng: -50.9192 },
  65: { label: 'Cuiabá e região', query: 'Cuiabá, MT', lat: -15.6014, lng: -56.0979 },
  66: { label: 'Norte de Mato Grosso', query: 'Sinop, MT', lat: -11.8604, lng: -55.5091 },
  67: { label: 'Mato Grosso do Sul', query: 'Campo Grande, MS', lat: -20.4697, lng: -54.6201 },
  68: { label: 'Acre', query: 'Rio Branco, AC', lat: -9.9754, lng: -67.8249 },
  69: { label: 'Rondônia', query: 'Porto Velho, RO', lat: -8.7619, lng: -63.9039 },
  71: { label: 'Salvador e região', query: 'Salvador, BA', lat: -12.9777, lng: -38.5016 },
  73: { label: 'Sul da Bahia', query: 'Ilhéus, BA', lat: -14.793, lng: -39.046 },
  74: { label: 'Norte da Bahia', query: 'Juazeiro, BA', lat: -9.4162, lng: -40.5033 },
  75: { label: 'Feira de Santana e região', query: 'Feira de Santana, BA', lat: -12.2664, lng: -38.9663 },
  77: { label: 'Oeste da Bahia', query: 'Vitória da Conquista, BA', lat: -14.8615, lng: -40.8442 },
  79: { label: 'Sergipe', query: 'Aracaju, SE', lat: -10.9472, lng: -37.0731 },
  81: { label: 'Recife e região', query: 'Recife, PE', lat: -8.0476, lng: -34.877 },
  82: { label: 'Alagoas', query: 'Maceió, AL', lat: -9.6498, lng: -35.7089 },
  83: { label: 'Paraíba', query: 'João Pessoa, PB', lat: -7.1195, lng: -34.845 },
  84: { label: 'Rio Grande do Norte', query: 'Natal, RN', lat: -5.7793, lng: -35.2009 },
  85: { label: 'Fortaleza e região', query: 'Fortaleza, CE', lat: -3.7319, lng: -38.5267 },
  86: { label: 'Piauí', query: 'Teresina, PI', lat: -5.0919, lng: -42.8034 },
  87: { label: 'Sertão de Pernambuco', query: 'Petrolina, PE', lat: -9.3891, lng: -40.5027 },
  88: { label: 'Interior do Ceará', query: 'Juazeiro do Norte, CE', lat: -7.2291, lng: -39.3123 },
  89: { label: 'Sul do Piauí', query: 'Picos, PI', lat: -7.0772, lng: -41.467 },
  91: { label: 'Belém e região', query: 'Belém, PA', lat: -1.4558, lng: -48.5039 },
  92: { label: 'Manaus e região', query: 'Manaus, AM', lat: -3.119, lng: -60.0217 },
  93: { label: 'Oeste do Pará', query: 'Santarém, PA', lat: -2.4431, lng: -54.7083 },
  94: { label: 'Sudeste do Pará', query: 'Marabá, PA', lat: -5.3686, lng: -49.1178 },
  95: { label: 'Roraima', query: 'Boa Vista, RR', lat: 2.8235, lng: -60.6758 },
  96: { label: 'Amapá', query: 'Macapá, AP', lat: 0.0349, lng: -51.0694 },
  97: { label: 'Interior do Amazonas', query: 'Tefé, AM', lat: -3.3542, lng: -64.7114 },
  98: { label: 'São Luís e região', query: 'São Luís, MA', lat: -2.5307, lng: -44.3068 },
  99: { label: 'Interior do Maranhão', query: 'Imperatriz, MA', lat: -5.5185, lng: -47.4777 },
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  })

  if (!response.ok) {
    let message = `Erro da API: ${response.status}`
    try {
      const data = await response.json()
      message = data?.detail || message
    } catch {
      // Mantém a mensagem padrão quando a API não retorna JSON.
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

function classifyService(service) {
  const normalized = normalize(service)
  const match =
    categoryCatalog.find((category) => category.keywords.some((keyword) => textMatchesTerm(normalized, keyword))) ??
    categoryCatalog.find((category) => category.synonyms.some((keyword) => textMatchesTerm(normalized, keyword)))

  return match ?? generalCategory
}

function textMatchesTerm(text, term) {
  const normalizedText = ` ${normalize(text).replace(/[-_/]/g, ' ')} `
  const normalizedTerm = normalize(term).trim()
  if (!normalizedTerm) return false
  if (normalizedTerm.includes(' ')) return normalizedText.includes(` ${normalizedTerm} `)
  return normalizedText.split(/\s+/).includes(normalizedTerm)
}

const genericServiceMarkers = ['contato importado', 'google contacts', 'google people api', 'sem categoria', 'servico nao informado', 'serviço não informado', 'contato para revisar', 'contato']

function isGenericService(service) {
  const normalized = normalize(service).trim()
  return !normalized || genericServiceMarkers.some((marker) => normalized.includes(normalize(marker)))
}

function inferImportedService(data = {}) {
  const existing = String(data.service ?? '').trim()
  if (existing && !isGenericService(existing)) return existing

  const text = [data.name, data.service, data.occupation, data.organization, data.email, data.note, data.source].filter(Boolean).join(' ')
  const category = classifyService(text)
  if (category.id !== generalCategory.id) return category.label.toLowerCase()

  const emailDomain = String(data.email ?? '').split('@')[1]?.split('.')[0]
  if (emailDomain && !['gmail', 'hotmail', 'outlook', 'icloud', 'yahoo', 'live'].includes(normalize(emailDomain))) {
    return `contato corporativo - ${emailDomain}`
  }

  return 'contato para revisar'
}

function matchText(query, values) {
  const normalizedQuery = normalize(query).trim()
  if (!normalizedQuery) return true
  return values.some((value) => normalize(value).includes(normalizedQuery))
}

function getCategory(id) {
  if (id === 'all') return null
  return categoryCatalog.find((category) => category.id === id) ?? generalCategory
}

function categoryDetails(rawCategory, service = '') {
  const id = typeof rawCategory === 'string' ? rawCategory : rawCategory?.id
  return categoryCatalog.find((category) => category.id === id) ?? (id === 'general' ? generalCategory : classifyService(service))
}

function formatPhoneForLink(phone) {
  return String(phone ?? '').replace(/\D/g, '')
}

function initials(name) {
  return String(name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function contactAddress(contact) {
  return contact.address || contact.city || 'São Paulo, SP'
}

function distanceBetweenCoordinates(originCoords, destinationCoords) {
  const toRad = (value) => (value * Math.PI) / 180
  const earthKm = 6371
  const dLat = toRad(destinationCoords.lat - originCoords.lat)
  const dLng = toRad(destinationCoords.lng - originCoords.lng)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(originCoords.lat)) * Math.cos(toRad(destinationCoords.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistanceKm(distanceKm) {
  if (distanceKm === null || distanceKm === undefined || Number.isNaN(distanceKm)) return 'sem distância'
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`
}

function estimateFallbackDistance(origin, destination) {
  const originCoords = findFallbackCoordinate(origin)
  const destinationCoords = findFallbackCoordinate(destination)
  if (!originCoords || !destinationCoords) return null
  return formatDistanceKm(distanceBetweenCoordinates(originCoords, destinationCoords))
}

function fallbackDistanceKm(origin, destination) {
  const originCoords = findFallbackCoordinate(origin)
  const destinationCoords = findFallbackCoordinate(destination)
  if (!originCoords || !destinationCoords) return null
  return distanceBetweenCoordinates(originCoords, destinationCoords)
}

function findFallbackCoordinate(address) {
  const normalized = normalize(address)
  const key = Object.keys(fallbackCoordinates).find((item) => normalized.includes(item))
  return key ? fallbackCoordinates[key] : null
}

function extractDdd(phone) {
  let digits = onlyDigits(phone)
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2)
  if (digits.length < 10) return ''
  return digits.slice(0, 2)
}

function dddLocation(phone) {
  const ddd = extractDdd(phone)
  const location = ddd ? dddCoordinates[ddd] : null
  return location ? { ddd, ...location } : null
}

function isUsableMapAddress(address) {
  const normalized = normalize(address).trim()
  if (!normalized) return false
  return !['minha regiao', 'sem localizacao', 'brasil'].includes(normalized)
}

function resolveMapLocation(person, fallbackAddress = '') {
  const address = String(fallbackAddress || person?.address || person?.city || '').trim()
  const byDdd = dddLocation(person?.phone)
  if (isUsableMapAddress(address)) {
    const addressCoords = findFallbackCoordinate(address)
    const dddCoords = byDdd ? { lat: byDdd.lat, lng: byDdd.lng } : null
    return {
      source: addressCoords ? 'address' : byDdd ? 'address_ddd' : 'address',
      sourceLabel: addressCoords ? 'Endereço' : byDdd ? `Endereço + DDD ${byDdd.ddd}` : 'Endereço',
      label: address,
      query: address,
      coords: addressCoords || dddCoords,
    }
  }

  if (byDdd) {
    return {
      source: 'ddd',
      sourceLabel: `DDD ${byDdd.ddd}`,
      label: `DDD ${byDdd.ddd} - ${byDdd.label}`,
      query: byDdd.query,
      coords: { lat: byDdd.lat, lng: byDdd.lng },
    }
  }

  return {
    source: 'unknown',
    sourceLabel: 'Sem região',
    label: 'Sem localização',
    query: 'Brasil',
    coords: null,
  }
}

function geocodeKey(query) {
  return normalize(query).trim()
}

function withGeocodedLocation(location, geocodedLocations) {
  const key = geocodeKey(location?.query)
  const geocoded = key ? geocodedLocations[key] : null
  if (!geocoded) return location
  return {
    ...location,
    source: 'address_geo',
    sourceLabel: 'Endereço geocodificado',
    label: geocoded.address || location.label,
    query: geocoded.address || location.query,
    coords: { lat: geocoded.lat, lng: geocoded.lng },
  }
}

async function geocodeAddressQuery(query) {
  const results = await lookupAddressText(query)
  const result = results.find((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
  return result ? { ...result, lat: Number(result.lat), lng: Number(result.lng) } : null
}

function hasGraphTag(item) {
  const categoryId = item.category?.id ?? classifyService(item.service).id
  return categoryId && categoryId !== generalCategory.id && !isGenericService(item.service)
}

function crmHasTag(contact) {
  return hasGraphTag(contact)
}

function hasCrmActivity(contact) {
  const status = contact.crm_status === 'Conversa' ? 'Conversa iniciada' : (contact.crm_status || 'Novo')
  const priority = normalize(contact.crm_priority || 'Média')
  return status !== 'Novo' ||
    Boolean(contact.next_follow_up_at) ||
    Boolean(contact.last_contact_at) ||
    Boolean(contact.crm_note?.trim()) ||
    priority === 'alta' ||
    priority === 'baixa'
}

function targetContactServiceLabel(contact) {
  const category = contact.category ?? categoryDetails(null, contact.service)
  if (!category?.id || category.id === generalCategory.id || isGenericService(contact.service)) return 'Sem categoria'
  return String(contact.service || category.label || 'Sem categoria').trim() || 'Sem categoria'
}

function targetContactOptionValue(contact) {
  return `${contact.name} · ${targetContactServiceLabel(contact)}`
}

function parseCustomFields(value) {
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function serializeCustomFields(fields) {
  return JSON.stringify(fields ?? [])
}

function tagList(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function followUpInputValue(value) {
  if (!value) return ''
  return String(value).length === 10 ? `${value}T09:00` : String(value).slice(0, 16)
}

function todayInputDate() {
  return new Date().toISOString().slice(0, 10)
}

function formatFollowUp(value) {
  if (!value) return ''
  const normalized = String(value)
  if (normalized.length === 10) {
    const [year, month, day] = normalized.split('-')
    return `${day}/${month}/${year}`
  }
  const [datePart, timePart = ''] = normalized.split('T')
  const [year, month, day] = datePart.split('-')
  return `${day}/${month}/${year}${timePart ? ` às ${timePart.slice(0, 5)}` : ''}`
}

function followUpTimestamp(value) {
  if (!value) return 0
  const normalized = String(value).length === 10 ? `${value}T23:59` : String(value)
  const timestamp = new Date(normalized).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function isDue(date) {
  return Boolean(date) && followUpTimestamp(date) <= Date.now()
}

function crmStageDetails(status) {
  return crmStages.find((stage) => stage.id === status) ?? crmStages[0]
}

function effectiveCrmStatus(contact) {
  if (contact?.next_follow_up_at) return 'Follow-up'
  if (contact?.crm_status === 'Conversa') return 'Conversa iniciada'
  return contact?.crm_status || 'Novo'
}

function parsePath() {
  const path = window.location.pathname === '/' ? ROUTES.DASHBOARD : window.location.pathname
  if (path.startsWith('/categoria/')) {
    return { page: 'agenda', categoryId: decodeURIComponent(path.replace('/categoria/', '')) }
  }
  if (path.startsWith(`${ROUTES.CONTACT}/`)) {
    return { page: 'contact', contactId: decodeURIComponent(path.replace(`${ROUTES.CONTACT}/`, '')) }
  }
  if (path === '/grupos') {
    window.history.replaceState({}, '', ROUTES.PUBLIC)
    return { page: 'public', categoryId: null }
  }

  const pageByPath = {
    '/buscar': 'agenda',
    [ROUTES.DASHBOARD]: 'dashboard',
    [ROUTES.AGENDA]: 'agenda',
    [ROUTES.MAP]: 'map',
    [ROUTES.PUBLIC]: 'public',
    [ROUTES.CHAT]: 'chat',
    [ROUTES.SETTINGS]: 'settings',
    [ROUTES.DUPLICATES]: 'duplicates',
    [ROUTES.CRM]: 'crm',
    [ROUTES.PUBLIC_PROFILE]: 'publicProfile',
    [ROUTES.NEW]: 'new',
    [ROUTES.LOGIN]: 'login',
    [ROUTES.REGISTER]: 'register',
    [ROUTES.CONNECTIONS]: 'connections',
  }

  return { page: pageByPath[path] ?? 'agenda', categoryId: null }
}

function loadStoredUser() {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    const savedAt = parsed?.savedAt ?? 0
    const rawUser = parsed?.user ?? parsed
    if (!savedAt || Date.now() - savedAt > AUTH_TTL_MS) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }
    return normalizeUserDraft(rawUser)
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

function storeSessionUser(user) {
  const now = Date.now()
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      user,
      savedAt: now,
      expiresAt: now + AUTH_TTL_MS,
    }),
  )
}

function getStoredSessionExpiry() {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!stored) return 0
    return Number(JSON.parse(stored)?.expiresAt ?? 0)
  } catch {
    return 0
  }
}

function normalizeUserDraft(user) {
  const hasPersonalAddressDetails = [user?.addressLine, user?.addressNumber, user?.addressComplement, user?.neighborhood].some(Boolean)
  const hasServiceAddressDetails = [user?.serviceAddressLine, user?.serviceAddressNumber, user?.serviceAddressComplement, user?.serviceNeighborhood].some(Boolean)
  const personalAddress = hasPersonalAddressDetails
    ? composeAddress({
        addressLine: user?.addressLine,
        addressNumber: user?.addressNumber,
        addressComplement: user?.addressComplement,
        neighborhood: user?.neighborhood,
        city: user?.city,
        state: user?.state,
      })
    : ''
  const serviceAddress = hasServiceAddressDetails
    ? composeAddress({
        addressLine: user?.serviceAddressLine,
        addressNumber: user?.serviceAddressNumber,
        addressComplement: user?.serviceAddressComplement,
        neighborhood: user?.serviceNeighborhood,
        city: user?.serviceCity,
        state: user?.serviceState,
      })
    : ''

  return {
    ...defaultUser,
    ...(user ?? {}),
    id: user?.id ?? null,
    cep: formatCep(user?.cep ?? defaultUser.cep),
    addressLine: user?.addressLine ?? (user ? '' : defaultUser.addressLine),
    addressNumber: user?.addressNumber ?? '',
    addressComplement: user?.addressComplement ?? '',
    neighborhood: user?.neighborhood ?? (user ? '' : defaultUser.neighborhood),
    city: user?.city ?? (user ? '' : defaultUser.city),
    state: user?.state ?? (user ? '' : defaultUser.state),
    serviceCep: formatCep(user?.serviceCep ?? ''),
    serviceAddressLine: user?.serviceAddressLine ?? '',
    serviceAddressNumber: user?.serviceAddressNumber ?? '',
    serviceAddressComplement: user?.serviceAddressComplement ?? '',
    serviceNeighborhood: user?.serviceNeighborhood ?? '',
    serviceCity: user?.serviceCity ?? '',
    serviceState: user?.serviceState ?? '',
    address: personalAddress || user?.address || (user ? '' : defaultUser.address),
    serviceAddress: serviceAddress || user?.serviceAddress || '',
    interests: Array.isArray(user?.interests) ? user.interests : defaultUser.interests,
    isCollaborator: Boolean(user?.isCollaborator),
    addressVisible: Boolean(user?.addressVisible),
    useDifferentServiceAddress: Boolean(user?.useDifferentServiceAddress),
    serviceAddressVisible: user?.serviceAddressVisible ?? true,
    publicVisible: Boolean(user?.publicVisible),
    publicDescription: user?.publicDescription ?? '',
    publicDemand: user?.publicDemand ?? '',
    publicSolves: user?.publicSolves ?? '',
    publicTags: user?.publicTags ?? '',
    publicWhatsapp: user?.publicWhatsapp ?? '',
    publicInstagram: user?.publicInstagram ?? '',
    publicLinkedin: user?.publicLinkedin ?? '',
    publicUrl: user?.publicUrl ?? '',
    googleConnected: Boolean(user?.googleConnected),
    googleContactsImportedAt: user?.googleContactsImportedAt ?? '',
    googleProfileSyncedAt: user?.googleProfileSyncedAt ?? '',
    role: user?.role ?? 'user',
  }
}

function hasGoogleConnection(user) {
  return Boolean(user?.googleConnected || user?.googleProfileSyncedAt || user?.googleContactsImportedAt)
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function formatCep(value) {
  const digits = onlyDigits(value).slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function isValidCep(value) {
  return onlyDigits(value).length === 8
}

function composeAddress(data) {
  return [
    [data.addressLine, data.addressNumber].filter(Boolean).join(', '),
    data.addressComplement,
    data.neighborhood,
    [data.city, data.state].filter(Boolean).join(' - '),
  ]
    .filter(Boolean)
    .join(', ')
}

async function lookupCep(value) {
  const cep = onlyDigits(value)
  if (cep.length !== 8) {
    throw new Error('Informe um CEP com 8 digitos.')
  }

  let data = null
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
    if (response.ok) data = await response.json()
  } catch {
    data = null
  }
  if (!data) {
    const fallback = await lookupAddressText(cep)
    const option = fallback[0]
    if (!option) throw new Error('Não foi possível consultar o CEP. Preencha cidade e UF manualmente.')
    return {
      cep: formatCep(option.cep || cep),
      addressLine: option.address || '',
      neighborhood: '',
      city: option.city || '',
      state: option.state || '',
    }
  }
  if (data.erro) {
    const fallback = await lookupAddressText(cep)
    const option = fallback[0]
    if (!option) throw new Error('CEP não encontrado. Preencha cidade e UF manualmente.')
    return {
      cep: formatCep(option.cep || cep),
      addressLine: option.address || '',
      neighborhood: '',
      city: option.city || '',
      state: option.state || '',
    }
  }

  return {
    cep: formatCep(data.cep),
    addressLine: data.logradouro || '',
    neighborhood: data.bairro || '',
    city: data.localidade || '',
    state: data.uf || '',
  }
}

async function lookupAddressText(query) {
  const trimmed = String(query ?? '').trim()
  if (trimmed.length < 3) {
    throw new Error('Informe uma rua ou endereço.')
  }
  const response = await apiRequest(`/api/address/lookup?query=${encodeURIComponent(trimmed)}`)
  return Array.isArray(response?.results) ? response.results : response ? [response] : []
}

function userToApiPayload(user) {
  const normalized = normalizeUserDraft(user)
  return {
    name: normalized.name,
    birth_date: normalized.birthDate,
    email: normalized.email,
    password: normalized.password,
    phone: normalized.phone,
    cep: normalized.cep,
    address: normalized.address,
    address_line: normalized.addressLine,
    address_number: normalized.addressNumber,
    address_complement: normalized.addressComplement,
    neighborhood: normalized.neighborhood,
    city: normalized.city,
    state: normalized.state,
    address_visible: normalized.addressVisible,
    interests: normalized.interests,
    is_collaborator: normalized.isCollaborator,
    offered_services: normalized.offeredServices,
    use_different_service_address: normalized.useDifferentServiceAddress,
    service_cep: normalized.serviceCep,
    service_address: normalized.serviceAddress,
    service_address_line: normalized.serviceAddressLine,
    service_address_number: normalized.serviceAddressNumber,
    service_address_complement: normalized.serviceAddressComplement,
    service_neighborhood: normalized.serviceNeighborhood,
    service_city: normalized.serviceCity,
    service_state: normalized.serviceState,
    service_address_visible: normalized.serviceAddressVisible,
    public_visible: normalized.publicVisible,
    public_description: normalized.publicDescription,
    public_demand: normalized.publicDemand,
    public_solves: normalized.publicSolves,
    public_tags: normalized.publicTags,
    public_whatsapp: normalized.publicWhatsapp,
    public_instagram: normalized.publicInstagram,
    public_linkedin: normalized.publicLinkedin,
    public_url: normalized.publicUrl,
    google_connected: normalized.googleConnected,
    google_contacts_imported_at: normalized.googleContactsImportedAt,
    google_profile_synced_at: normalized.googleProfileSyncedAt,
    role: normalized.role,
  }
}

function apiUserToLocal(user) {
  if (!user) return null
  return normalizeUserDraft({
    name: user.name,
    id: user.id,
    birthDate: user.birth_date,
    email: user.email,
    password: '',
    phone: user.phone,
    cep: user.cep,
    address: user.address,
    addressLine: user.address_line,
    addressNumber: user.address_number,
    addressComplement: user.address_complement,
    neighborhood: user.neighborhood,
    city: user.city,
    state: user.state,
    addressVisible: user.address_visible,
    interests: user.interests,
    isCollaborator: user.is_collaborator,
    offeredServices: user.offered_services,
    useDifferentServiceAddress: user.use_different_service_address,
    serviceCep: user.service_cep,
    serviceAddress: user.service_address,
    serviceAddressLine: user.service_address_line,
    serviceAddressNumber: user.service_address_number,
    serviceAddressComplement: user.service_address_complement,
    serviceNeighborhood: user.service_neighborhood,
    serviceCity: user.service_city,
    serviceState: user.service_state,
    serviceAddressVisible: user.service_address_visible,
    publicVisible: user.public_visible,
    publicDescription: user.public_description,
    publicDemand: user.public_demand,
    publicSolves: user.public_solves,
    publicTags: user.public_tags,
    publicWhatsapp: user.public_whatsapp,
    publicInstagram: user.public_instagram,
    publicLinkedin: user.public_linkedin,
    publicUrl: user.public_url,
    googleConnected: user.google_connected,
    googleContactsImportedAt: user.google_contacts_imported_at,
    googleProfileSyncedAt: user.google_profile_synced_at,
    role: user.role,
  })
}

function isCadastroIncomplete(user) {
  const normalized = normalizeUserDraft(user)
  return !normalized.birthDate || !normalized.phone.trim() || !isValidCep(normalized.cep)
}

function contactOwnerId(owner) {
  return String(owner?.id ?? owner?.email ?? 'demo-user')
}

function parseImportedContacts(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[;,|]/).map((part) => part.trim())
      const base = {
        name: parts[0] || 'Contato importado',
        phone: parts[1] || '0000',
        service: parts[2] || '',
        city: parts[3] || 'Minha região',
        address: parts[4] || '',
        note: parts[5] || '',
        source: 'CSV',
      }
      return {
        ...base,
        service: inferImportedService(base),
      }
    })
    .filter((item) => item.name && item.phone)
    .slice(0, 200)
}

function googlePersonToContact(person, index) {
  const phone = person.phoneNumbers?.[0]?.canonicalForm || person.phoneNumbers?.[0]?.value || ''
  const name = person.names?.[0]?.displayName || person.emailAddresses?.[0]?.value || `Contato Google ${index + 1}`
  const email = person.emailAddresses?.[0]?.value || ''
  const occupation = person.occupations?.[0]?.value || ''
  const organization = [person.organizations?.[0]?.title, person.organizations?.[0]?.name].filter(Boolean).join(' - ')
  const address = person.addresses?.[0]?.formattedValue || ''
  const base = {
    name,
    occupation,
    organization,
    email,
    source: 'Google People API',
  }

  return {
    name,
    phone: phone || `google-${index + 1}`,
    service: inferImportedService(base),
    note: email ? `Email: ${email}` : '',
    description: [occupation, organization].filter(Boolean).join('\n'),
    email,
    city: '',
    address,
    source: 'Google People API',
  }
}

function googleBirthdayToDate(birthdays = []) {
  const birthday = birthdays.find((item) => item.date?.year && item.date?.month && item.date?.day)
  if (!birthday) return ''
  const { year, month, day } = birthday.date
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function googleAccountToUserDraft(profile, peopleProfile = {}) {
  const name = peopleProfile.names?.[0]?.displayName || profile?.name || ''
  const email = peopleProfile.emailAddresses?.[0]?.value || profile?.email || ''
  const phone = peopleProfile.phoneNumbers?.[0]?.canonicalForm || peopleProfile.phoneNumbers?.[0]?.value || ''
  const birthDate = googleBirthdayToDate(peopleProfile.birthdays)
  return { name, email, phone, birthDate }
}

function loadRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem('network-agenda-recents')) ?? ['eletricista', 'advogada', 'contador']
  } catch {
    return ['eletricista', 'advogada', 'contador']
  }
}

let googleMapsPromise
let googleIdentityPromise

function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google)
  if (!GOOGLE_CLIENT_ID) return Promise.reject(new Error('Configure VITE_GOOGLE_CLIENT_ID para usar login e contatos do Google.'))

  if (!googleIdentityPromise) {
    googleIdentityPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => resolve(window.google)
      script.onerror = () => reject(new Error('Não foi possível carregar o login do Google.'))
      document.head.appendChild(script)
    })
  }

  return googleIdentityPromise
}

async function requestGoogleToken(scope = GOOGLE_LOGIN_SCOPE, prompt = 'select_account') {
  const google = await loadGoogleIdentity()
  return new Promise((resolve, reject) => {
    let settled = false
    const timeout = window.setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('Google demorou para responder. Feche o popup e tente novamente.'))
    }, 45000)

    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope,
      prompt,
      callback: (response) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        if (response?.access_token) {
          resolve(response.access_token)
        } else {
          reject(new Error(response?.error_description || 'Permissão do Google não concluída.'))
        }
      },
      error_callback: () => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        reject(new Error('Permissão do Google cancelada.'))
      },
    })
    client.requestAccessToken()
  })
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Não foi possível ler o perfil do Google.')
  return response.json()
}

async function fetchGoogleContacts(accessToken) {
  const params = new URLSearchParams({
    personFields: 'names,phoneNumbers,addresses,emailAddresses,occupations,organizations',
    pageSize: '200',
  })
  const response = await fetch(`https://people.googleapis.com/v1/people/me/connections?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Não foi possível ler os contatos do Google.')
  const data = await response.json()
  return (data.connections ?? []).map(googlePersonToContact).filter((contact) => contact.name && contact.phone)
}

async function fetchGoogleAccountProfile(accessToken) {
  const params = new URLSearchParams({
    personFields: 'names,emailAddresses,phoneNumbers,birthdays',
  })
  const response = await fetch(`https://people.googleapis.com/v1/people/me?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) return {}
  return response.json()
}

async function getGoogleProfileAndContacts() {
  const accessToken = await requestGoogleToken(`${GOOGLE_LOGIN_SCOPE} ${GOOGLE_CONTACTS_SCOPE}`, 'consent')
  const [profile, contacts] = await Promise.all([fetchGoogleProfile(accessToken), fetchGoogleContacts(accessToken)])
  return { profile, contacts }
}

async function getGoogleProfileWithToken() {
  const accessToken = await requestGoogleToken(GOOGLE_LOGIN_SCOPE, 'select_account')
  const profile = await fetchGoogleProfile(accessToken)
  return { profile, accessToken }
}

async function getGoogleContactsOnly() {
  const accessToken = await requestGoogleToken(GOOGLE_CONTACTS_SCOPE, 'consent')
  return fetchGoogleContacts(accessToken)
}

async function getGoogleAccountDraft() {
  const accessToken = await requestGoogleToken(GOOGLE_ACCOUNT_PROFILE_SCOPE, 'consent')
  const [profile, peopleProfile] = await Promise.all([fetchGoogleProfile(accessToken), fetchGoogleAccountProfile(accessToken)])
  return googleAccountToUserDraft(profile, peopleProfile)
}

function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps)
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error('Google Maps API key missing'))

  if (!googleMapsPromise) {
    googleMapsPromise = new Promise((resolve, reject) => {
      window.__networkAgendaInitMap = () => resolve(window.google.maps)
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=geometry&callback=__networkAgendaInitMap`
      script.async = true
      script.defer = true
      script.onerror = () => reject(new Error('Google Maps script failed'))
      document.head.appendChild(script)
    })
  }

  return googleMapsPromise
}

function Shell({ user, route, online, unread, onNavigate, onLogout, children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isAdmin = user?.role === 'admin'
  const isAuthPage = !user && (route.page === 'login' || route.page === 'register')
  const primaryTabs = [
    { label: 'Agenda', path: ROUTES.AGENDA, icon: ContactRound, page: 'agenda' },
    { label: 'CRM', path: ROUTES.CRM, icon: Activity, page: 'crm' },
    { label: 'Mapa', path: ROUTES.MAP, icon: Map, page: 'map' },
    { label: 'Chat', path: ROUTES.CHAT, icon: MessageCircle, page: 'chat' },
  ]
  const menuTabs = [
    { label: 'Dashboard', path: ROUTES.DASHBOARD, icon: LayoutGrid, page: 'dashboard' },
    { label: 'Novo contato', path: ROUTES.NEW, icon: Plus, page: 'new' },
    { label: 'Rede pública', path: ROUTES.PUBLIC, icon: Compass, page: 'public' },
    { label: 'Duplicados', path: ROUTES.DUPLICATES, icon: CheckCircle, page: 'duplicates' },
    { label: 'Perfil', path: ROUTES.REGISTER, icon: UserRound, page: 'register' },
    { label: 'Perfil público', path: ROUTES.PUBLIC_PROFILE, icon: UsersRound, page: 'publicProfile' },
    { label: 'Config.', path: ROUTES.SETTINGS, icon: SlidersHorizontal, page: 'settings' },
  ]

  if (isAdmin) {
    menuTabs.push({ label: 'Conexões', path: ROUTES.CONNECTIONS, icon: ShieldCheck, page: 'connections' })
  }
  const activePage = route.page === 'duplicates' || (user && route.page === 'register') ? 'settings' : route.page
  const menuPages = new Set(menuTabs.map((tab) => (tab.page === 'duplicates' || tab.page === 'register' ? 'settings' : tab.page)))
  const menuActive = menuPages.has(activePage)

  function go(path) {
    setMenuOpen(false)
    onNavigate(path)
  }

  if (isAuthPage) {
    return (
      <div className="app-shell">
        <main className="mx-auto min-w-0 max-w-6xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    )
  }

  const sidebarPrimary = [
    { label: 'Dashboard', path: ROUTES.DASHBOARD, icon: LayoutGrid, page: 'dashboard' },
    ...primaryTabs,
    { label: 'Rede pública', path: ROUTES.PUBLIC, icon: Compass, page: 'public' },
  ]
  const sidebarSecondary = [
    { label: 'Novo contato', path: ROUTES.NEW, icon: Plus, page: 'new' },
    { label: 'Duplicados', path: ROUTES.DUPLICATES, icon: CheckCircle, page: 'duplicates' },
    { label: 'Perfil', path: ROUTES.REGISTER, icon: UserRound, page: 'register' },
    { label: 'Perfil público', path: ROUTES.PUBLIC_PROFILE, icon: UsersRound, page: 'publicProfile' },
    { label: 'Configurações', path: ROUTES.SETTINGS, icon: SlidersHorizontal, page: 'settings' },
    ...(isAdmin ? [{ label: 'Conexões', path: ROUTES.CONNECTIONS, icon: ShieldCheck, page: 'connections' }] : []),
  ]
  const desktopLinkClass = (page) => [
    'sidebar-link flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-black',
    activePage === page || (page === 'settings' && menuActive) ? 'sidebar-link-active' : '',
  ].join(' ')

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar fixed bottom-4 left-4 top-4 z-40 hidden w-64 flex-col rounded-xl p-3 lg:flex">
        <button type="button" onClick={() => onNavigate(ROUTES.DASHBOARD)} className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 text-left">
          <span className="brand-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <Zap size={20} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-slate-100">NETWORK<span className="text-cyan-300">.AGENDA</span></span>
            <span className="block truncate text-[11px] font-bold uppercase tracking-widest text-slate-500">Command center</span>
          </span>
        </button>

        <div className="mt-4 rounded-lg border border-cyan-400/10 bg-cyan-400/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sistema</p>
            <Circle size={8} className={online ? 'fill-emerald-400 text-emerald-400' : 'fill-slate-400 text-slate-400'} />
          </div>
          <p className="mt-2 text-sm font-black text-slate-100">{online ? 'Operando online' : 'Modo local'}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{unread > 0 ? `${unread} novo${unread === 1 ? '' : 's'} contato${unread === 1 ? '' : 's'}` : 'Rede pronta para busca'}</p>
        </div>

        <nav className="mt-4 grid gap-1">
          {sidebarPrimary.map((tab) => (
            <button key={tab.path} type="button" onClick={() => go(tab.path)} className={desktopLinkClass(tab.page)}>
              <tab.icon size={18} className="shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="my-4 h-px bg-slate-800/70" />

        <nav className="grid gap-1">
          {sidebarSecondary.map((tab) => (
            <button key={tab.path} type="button" onClick={() => go(tab.path)} className={desktopLinkClass(tab.page === 'duplicates' || tab.page === 'register' ? 'settings' : tab.page)}>
              <tab.icon size={18} className="shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto rounded-lg border border-slate-800/80 bg-slate-950/35 p-3">
          <button type="button" onClick={() => onNavigate(ROUTES.SETTINGS)} className="flex w-full min-w-0 items-center gap-3 text-left">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-sm font-black text-cyan-100">{initials(user?.name ?? 'EU')}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-slate-100">{user?.name ?? 'Entrar'}</span>
              <span className="block truncate text-xs font-semibold text-slate-500">{user?.email ?? 'Conta local'}</span>
            </span>
          </button>
          {user ? (
            <button type="button" onClick={onLogout} className="secondary-button mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-black">
              <LogOut size={15} />
              Sair
            </button>
          ) : null}
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[18rem]">
        <header className="app-header sticky top-0 z-40 lg:hidden">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <button type="button" onClick={() => onNavigate(ROUTES.DASHBOARD)} className="flex min-w-0 items-center gap-2">
            <span className="brand-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <Zap size={19} />
            </span>
            <span className="truncate text-sm font-black tracking-normal text-slate-100">
              NETWORK<span className="text-cyan-300">.AGENDA</span>
            </span>
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            {primaryTabs.map((tab) => (
              <button
                key={tab.path}
                type="button"
                onClick={() => go(tab.path)}
                className={[
                  'inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold',
                  activePage === tab.page ? 'nav-pill-active' : 'nav-pill',
                ].join(' ')}
              >
                <tab.icon size={17} />
                {tab.label}
              </button>
            ))}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                className={[
                  'inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold',
                  menuActive ? 'nav-pill-active' : 'nav-pill',
                ].join(' ')}
              >
                <Menu size={17} />
                Menu
              </button>
              {menuOpen ? (
                <div className="glass-panel absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-lg p-1.5">
                  {menuTabs.map((tab) => (
                    <button
                      key={tab.path}
                      type="button"
                      onClick={() => go(tab.path)}
                      className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-bold text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200"
                    >
                      <tab.icon size={17} />
                      {tab.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </nav>

          <div className="flex items-center gap-2">
            <span className="glass-panel-soft hidden items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-400 sm:inline-flex">
              <Circle size={9} className={online ? 'fill-emerald-500 text-emerald-500' : 'fill-slate-300 text-slate-300'} />
              {online ? 'online' : 'offline'}
            </span>
            <button type="button" className="secondary-button relative rounded-lg p-2 text-slate-400" aria-label="Atividade">
              <Bell size={18} />
              {unread > 0 ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-black text-white">{unread}</span> : null}
            </button>
            <button
              type="button"
              onClick={() => onNavigate(user ? ROUTES.SETTINGS : ROUTES.LOGIN)}
              className="secondary-button hidden h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-bold sm:inline-flex"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-500/10 text-xs font-black text-cyan-200">{initials(user?.name ?? 'EU')}</span>
              {user?.name ?? 'Entrar'}
            </button>
            {user ? (
              <button type="button" onClick={onLogout} className="secondary-button hidden rounded-lg p-2 text-slate-400 sm:inline-flex" aria-label="Sair">
                <LogOut size={18} />
              </button>
            ) : null}
          </div>
        </div>
        </header>

        <main className="mx-auto min-w-0 max-w-[1380px] px-4 pb-24 pt-4 sm:px-6 sm:pb-10 sm:pt-6 lg:px-8 lg:py-6">
          <div className="workspace-bar mb-5 hidden items-center justify-between rounded-xl px-4 py-3 lg:flex">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200">Workspace</p>
              <p className="mt-1 text-sm font-black text-slate-100">Rede privada, CRM e descoberta pública em uma única visão.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-xs font-black text-slate-400">{online ? 'API conectada' : 'API offline'}</span>
              <button type="button" onClick={() => onNavigate(ROUTES.CHAT)} className="primary-button inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black">
                <Sparkles size={16} />
                Copiloto
              </button>
            </div>
          </div>
          {children}
        </main>
      </div>

      {!isAuthPage ? (
        <>
          {menuOpen ? (
            <div className="glass-panel fixed inset-x-3 bottom-20 z-50 overflow-hidden rounded-lg p-2 md:hidden">
              <div className="grid grid-cols-2 gap-2">
                {menuTabs.map((tab) => (
                  <button
                    key={tab.path}
                    type="button"
                    onClick={() => go(tab.path)}
                    className="action-card flex h-12 min-w-0 items-center gap-2 rounded-lg px-3 text-left text-xs font-black text-slate-300"
                  >
                    <tab.icon size={17} className="shrink-0 text-cyan-300" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <nav className="glass-panel fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-lg p-1.5 md:hidden">
            {primaryTabs.map((tab) => (
              <button
                key={tab.path}
                type="button"
                onClick={() => go(tab.path)}
                className={[
                  'flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-bold transition',
                  activePage === tab.page ? 'nav-pill-active' : 'text-slate-400',
                ].join(' ')}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              className={[
                'flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-bold transition',
                menuActive ? 'nav-pill-active' : 'text-slate-400',
              ].join(' ')}
            >
              <Menu size={18} />
              Menu
            </button>
          </nav>
        </>
      ) : null}
    </div>
  )
}

function SearchBox({ value, onChange, onSearch, recents, contacts, onFocusChange }) {
  const [focused, setFocused] = useState(false)
  const boxRef = useRef(null)
  const typed = normalize(value).trim()
  const suggestedContacts = typed
    ? contacts
        .filter((contact) => matchText(value, [contact.name, contact.phone, contact.service, contact.city]))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 8)
    : contacts.slice(0, 4)

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (boxRef.current && !boxRef.current.contains(event.target)) {
        setFocus(false)
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('touchstart', closeOnOutsideClick)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('touchstart', closeOnOutsideClick)
    }
  }, [])

  function setFocus(next) {
    setFocused(next)
    onFocusChange?.(next)
  }

  return (
    <div ref={boxRef} className="relative min-w-0">
      <div className="glass-panel flex min-w-0 items-center gap-2 rounded-lg px-3 focus-within:border-cyan-400">
        <Search size={19} className="shrink-0 text-slate-500" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocus(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSearch(value)
          }}
          className="h-11 w-0 min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-slate-100 outline-none placeholder:text-slate-600"
          placeholder="Buscar serviço ou pessoa"
        />
        {focused || value ? (
          <button
            type="button"
            onClick={() => {
              onChange('')
              setFocus(false)
            }}
            className="rounded-md p-1 text-slate-500"
            aria-label="Limpar busca"
          >
            <X size={17} />
          </button>
        ) : null}
        <button type="button" onClick={() => onSearch(value)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cyan-500 text-sm font-black text-slate-950 sm:w-auto sm:px-3">
          <Search size={16} className="sm:hidden" />
          <span className="hidden sm:inline">Buscar</span>
        </button>
      </div>

      {focused ? (
        <div className="glass-panel absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-lg">
          {!typed ? (
            <div className="border-b border-slate-800 p-3">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Recentes</p>
            <div className="flex flex-wrap gap-2">
              {recents.map((term) => (
                <button
                  key={term}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(term)
                    onSearch(term)
                    setFocus(false)
                  }}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-bold text-slate-300"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
          ) : null}
          <div className="max-h-64 overflow-auto p-2">
            {suggestedContacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(contact.service)
                  onSearch(contact.service)
                  setFocus(false)
                }}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-900"
              >
                <ContactAvatar contact={contact} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-slate-100">{contact.name}</span>
                  <span className="block truncate text-xs font-semibold text-slate-500">{contact.service}</span>
                </span>
                <ChevronRight size={16} className="text-slate-300" />
              </button>
            ))}
            {typed && !suggestedContacts.length ? <p className="px-3 py-4 text-sm font-bold text-slate-500">Nenhum contato encontrado.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PageTitle({ eyebrow, title, description, action }) {
  return (
    <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-black uppercase tracking-widest text-cyan-300">{eyebrow}</p> : null}
        <h1 className="constellation-title mt-1 text-2xl font-black tracking-normal sm:text-3xl">{title}</h1>
        {description ? <p className="text-balance mt-2 max-w-2xl break-words text-sm font-medium text-slate-400">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

function CategoryButtons({ contacts, activeCategory = 'all', onNavigate, onSelect }) {
  const counts = useMemo(() => {
    const next = { all: contacts.length }
    contacts.forEach((contact) => {
      const id = contact.category?.id ?? classifyService(contact.service).id
      next[id] = (next[id] ?? 0) + 1
    })
    return next
  }, [contacts])

  return (
    <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
      <button
        type="button"
        onClick={() => (onSelect ? onSelect('all') : onNavigate('/categoria/all'))}
        className={[
          'flex min-h-20 min-w-0 flex-col justify-between rounded-lg p-3 text-left',
          activeCategory === 'all' ? 'nav-pill-active' : 'action-card text-slate-300',
        ].join(' ')}
      >
        <LayoutGrid size={18} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-black">Tudo</span>
          <span className="text-xs font-bold opacity-70">{counts.all ?? 0}</span>
        </span>
      </button>
      {categoryCatalog.map((category) => (
        <CategoryButton key={category.id} category={category} count={counts[category.id] ?? 0} active={activeCategory === category.id} onNavigate={onNavigate} onSelect={onSelect} />
      ))}
    </div>
  )
}

function CategoryButton({ category, count, active, onNavigate, onSelect }) {
  const Icon = category.icon

  return (
    <button
      type="button"
      onClick={() => (onSelect ? onSelect(category.id) : onNavigate(`/categoria/${category.id}`))}
      className={[
        'flex min-h-20 min-w-0 flex-col justify-between rounded-lg p-3 text-left',
        active ? 'nav-pill-active' : 'action-card text-slate-300',
      ].join(' ')}
    >
      <Icon size={18} style={{ color: category.color }} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-black">{category.label}</span>
        <span className="text-xs font-bold opacity-70">{count}</span>
      </span>
    </button>
  )
}

function ContactAvatar({ contact }) {
  const category = contact.category ?? classifyService(contact.service)
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black text-white shadow-lg shadow-black/25 ring-1 ring-white/10 sm:h-11 sm:w-11" style={{ backgroundColor: category.color }}>
      {initials(contact.name)}
    </span>
  )
}

function ContactRow({ contact, onDelete, onToast, onEdit, onOpen }) {
  const phone = formatPhoneForLink(contact.phone)

  function openWhatsApp() {
    if (!phone) {
      onToast('Telefone inválido para WhatsApp.')
      return
    }
    window.open(`https://wa.me/55${phone}`, '_blank', 'noopener,noreferrer')
  }

  function callContact() {
    if (!phone) {
      onToast('Telefone inválido para ligação.')
      return
    }
    window.location.href = `tel:+55${phone}`
  }

  return (
    <article className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-b border-slate-800/70 bg-transparent px-3 py-3 transition hover:bg-cyan-500/[0.035] last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-3 sm:px-4">
      <ContactAvatar contact={contact} />
      <button type="button" onClick={() => (onOpen ? onOpen(contact) : onEdit(contact))} className="min-w-0 flex-1 text-left" aria-label={`Abrir ${contact.name}`}>
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[15px] font-black text-slate-100">{contact.name}</h3>
          {contact.trust === 'Favorito' ? <Sparkles size={15} className="shrink-0 text-amber-500" /> : null}
        </div>
        <p className="truncate text-sm font-semibold text-slate-400">{contact.service}</p>
        <p className="truncate text-xs font-medium text-slate-500">{contact.phone} - {contact.city}</p>
        <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-md bg-slate-950/60 px-2 py-0.5 text-[11px] font-black text-cyan-100/75">
          {contact.crm_status ?? 'Novo'}{contact.next_follow_up_at ? ` · ${formatFollowUp(contact.next_follow_up_at)}` : ''}
        </span>
      </button>
      <div className="hidden shrink-0 items-center gap-1 sm:flex">
        <button type="button" onClick={() => onEdit(contact)} className="secondary-button rounded-lg p-2 text-slate-300" aria-label={`Editar ${contact.name}`}>
          <Pencil size={16} />
        </button>
        <button type="button" onClick={callContact} className="secondary-button rounded-lg p-2 text-slate-300" aria-label={`Ligar para ${contact.name}`}>
          <Phone size={17} />
        </button>
        <button type="button" onClick={openWhatsApp} className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-2 text-emerald-200" aria-label={`WhatsApp de ${contact.name}`}>
          <MessageCircle size={17} />
        </button>
        <button type="button" onClick={() => onDelete(contact.id)} className="hidden rounded-lg border border-rose-400/25 bg-rose-400/10 p-2 text-rose-200 sm:inline-flex" aria-label={`Remover ${contact.name}`}>
          <X size={17} />
        </button>
      </div>
    </article>
  )
}

function ContactList({ contacts, onDelete, onToast, onEdit = () => {}, onOpen, emptyLabel = 'Nenhum contato encontrado.' }) {
  const grouped = useMemo(() => {
    const byLetter = {}
    contacts
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((contact) => {
        const letter = normalize(contact.name).charAt(0).toUpperCase() || '#'
        byLetter[letter] = byLetter[letter] ?? []
        byLetter[letter].push(contact)
      })
    return byLetter
  }, [contacts])

  const letters = Object.keys(grouped).sort()
  if (!letters.length) {
    return (
      <div className="glass-panel rounded-lg border-dashed p-8 text-center">
        <ContactRound className="mx-auto text-slate-700" size={34} />
        <p className="mt-3 text-sm font-black text-slate-200">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className="glass-panel overflow-hidden rounded-lg">
      {letters.map((letter) => (
        <section key={letter}>
          <div className="border-b border-slate-800/70 bg-slate-950/45 px-4 py-1.5 text-xs font-black text-slate-500">{letter}</div>
          {grouped[letter].map((contact) => (
            <ContactRow key={contact.id} contact={contact} onDelete={onDelete} onToast={onToast} onEdit={onEdit} onOpen={onOpen} />
          ))}
        </section>
      ))}
    </div>
  )
}

function CrmPage({ contacts, onEdit, onCompleteFollowUp, onCancelFollowUp, onNavigate, onAsk, messages, isThinking }) {
  const [scope, setScope] = useState('active')
  const [query, setQuery] = useState('')
  const activeCrmContacts = contacts.filter(hasCrmActivity)
  const taggedContacts = contacts.filter(crmHasTag)
  const untaggedContacts = contacts.filter((contact) => !crmHasTag(contact))
  const scopeOptions = [
    { id: 'all', label: 'Todos', description: 'Base completa do CRM', count: contacts.length },
    { id: 'active', label: 'CRM ativo', description: 'Com status, follow-up ou prioridade', count: activeCrmContacts.length },
    { id: 'tagged', label: 'Com tags', description: 'Contatos já categorizados', count: taggedContacts.length },
    { id: 'untagged', label: 'Sem tags', description: 'Contatos para revisar', count: untaggedContacts.length },
  ]
  const scopedContacts = scope === 'active' ? activeCrmContacts : scope === 'tagged' ? taggedContacts : scope === 'untagged' ? untaggedContacts : contacts
  const visibleContacts = scopedContacts.filter((contact) => !query.trim() || matchText(query, [contact.name, contact.phone, contact.service, contact.city, contact.address, contact.category?.label, contact.category?.group, contact.crm_status, contact.crm_priority, contact.crm_note]))
  const followUpContacts = visibleContacts.filter((contact) => contact.next_follow_up_at).sort((a, b) => followUpTimestamp(a.next_follow_up_at) - followUpTimestamp(b.next_follow_up_at))
  const dueContacts = followUpContacts.filter((contact) => isDue(contact.next_follow_up_at))
  const highPriority = visibleContacts.filter((contact) => contact.crm_priority === 'Alta')
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')

  function askCrm(message) {
    if (isThinking) return
    onAsk(message)
  }

  return (
    <div className="space-y-4">
      <PageTitle
        eyebrow="CRM"
        title="Relacionamentos e follow-ups"
        description="Acompanhe conversas, oportunidades e próximos contatos da sua rede."
        action={
          <button type="button" onClick={() => onNavigate(ROUTES.NEW)} className="primary-button inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black">
            <Plus size={17} />
            Novo contato
          </button>
        }
      />

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <CrmMetric label="Exibidos" value={`${visibleContacts.length}/${contacts.length}`} />
        <CrmMetric label="Com tags" value={taggedContacts.length} />
        <CrmMetric label="Sem tags" value={untaggedContacts.length} tone={untaggedContacts.length ? 'text-amber-300' : 'text-slate-100'} />
        <CrmMetric label="Follow-ups vencidos" value={dueContacts.length} tone={dueContacts.length ? 'text-amber-300' : 'text-slate-100'} />
        <CrmMetric label="Alta prioridade" value={highPriority.length} tone={highPriority.length ? 'text-rose-300' : 'text-slate-100'} />
      </section>

      <section className="glass-panel rounded-lg p-2.5">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex gap-2 overflow-x-auto pb-1 thin-scrollbar">
            {scopeOptions.map((option) => {
              const active = scope === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setScope(option.id)}
                  className={[
                    'min-w-[136px] rounded-lg border px-3 py-2 text-left transition',
                    active ? 'nav-pill-active' : 'action-card text-slate-300',
                  ].join(' ')}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black">{option.label}</span>
                    <span className="rounded-md bg-slate-950 px-2 py-0.5 text-xs font-black text-slate-400">{option.count}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">{option.description}</span>
                </button>
              )
            })}
          </div>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="field-input pl-10"
              placeholder="Buscar no CRM"
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex gap-3 overflow-x-auto pb-2 thin-scrollbar">
          {crmStages.map((stage) => {
            const stageContacts = visibleContacts.filter((contact) => effectiveCrmStatus(contact) === stage.id)
            return (
              <div key={stage.id} className="glass-panel w-[280px] shrink-0 rounded-lg md:w-[300px]">
                <div className="flex h-10 items-center justify-between border-b border-slate-800 px-3">
                  <span className="flex items-center gap-2 text-sm font-black text-slate-100">
                    <Circle size={10} className="fill-current" style={{ color: stage.color }} />
                    {stage.label}
                  </span>
                  <span className="rounded-md bg-slate-950 px-2 py-0.5 text-xs font-black text-slate-400">{stageContacts.length}</span>
                </div>
                <div className="grid max-h-[420px] gap-2 overflow-auto p-2 thin-scrollbar">
                  {stageContacts.length ? (
                    stageContacts.map((contact) => <CrmContactCard key={contact.id} contact={contact} onEdit={onEdit} onCompleteFollowUp={onCompleteFollowUp} onCancelFollowUp={onCancelFollowUp} />)
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-800 p-3 text-xs font-bold text-slate-500">Sem contatos.</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <aside className="grid gap-3 lg:grid-cols-3">
          <div className="glass-panel rounded-lg">
            <div className="border-b border-slate-800 px-3 py-2">
              <h2 className="text-sm font-black text-slate-100">Próximos follow-ups</h2>
            </div>
            <div className="grid max-h-[260px] gap-2 overflow-auto p-2 thin-scrollbar">
              {followUpContacts.length ? followUpContacts.map((contact) => <CrmContactCard key={contact.id} contact={contact} onEdit={onEdit} onCompleteFollowUp={onCompleteFollowUp} onCancelFollowUp={onCancelFollowUp} compact />) : <p className="p-2 text-sm font-semibold text-slate-500">Nenhum follow-up marcado.</p>}
            </div>
          </div>
          <div className="glass-panel rounded-lg p-4">
            <h2 className="text-sm font-black text-slate-100">Fluxo recomendado</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">Abra um contato e registre status, prioridade, último contato e próxima data. A lista de follow-ups passa a ordenar sua rotina.</p>
          </div>
          <div className="glass-panel rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300">
                <Sparkles size={18} />
              </span>
              <div>
                <h2 className="text-sm font-black text-slate-100">Copiloto CRM</h2>
                <p className="text-xs font-semibold text-slate-500">{isThinking ? 'Analisando sua rede...' : 'Perguntas rápidas sobre a base atual.'}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              {[
                'Quais contatos do CRM precisam de follow-up?',
                'Quais contatos estão sem tags?',
                'Sugira oportunidades entre meus contatos.',
              ].map((prompt) => (
                <button key={prompt} type="button" onClick={() => askCrm(prompt)} disabled={isThinking} className="action-card rounded-lg px-3 py-2 text-left text-xs font-black text-slate-300 disabled:cursor-not-allowed disabled:opacity-60">
                  {prompt}
                </button>
              ))}
            </div>
            {lastAssistant ? <p className="glass-panel-soft mt-3 line-clamp-5 rounded-lg p-3 text-xs font-semibold leading-relaxed text-slate-400">{lastAssistant.text}</p> : null}
            <button type="button" onClick={() => onNavigate(ROUTES.CHAT)} className="secondary-button mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-black">
              Abrir chat completo
            </button>
          </div>
        </aside>
      </section>
    </div>
  )
}

function CrmMetric({ label, value, tone = 'text-slate-100' }) {
  return (
    <div className="metric-card rounded-lg p-3">
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-black ${tone}`}>{value}</p>
    </div>
  )
}

function CrmContactCard({ contact, onEdit, onCompleteFollowUp, onCancelFollowUp, compact = false }) {
  const status = effectiveCrmStatus(contact)
  const stage = crmStageDetails(status)
  const storedStatus = contact.crm_status === 'Conversa' ? 'Conversa iniciada' : (contact.crm_status || 'Novo')
  const storedStage = crmStageDetails(storedStatus)
  const hasFollowUp = Boolean(contact.next_follow_up_at)
  const hasConversation = status === 'Conversa iniciada'
  const showActions = hasFollowUp || hasConversation
  return (
    <div className="action-card rounded-lg p-2.5 text-left">
      <button type="button" onClick={() => onEdit(contact)} className="w-full text-left">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black text-slate-100">{contact.name}</span>
            <span className="block truncate text-[11px] font-semibold text-slate-500">{contact.service}</span>
            {!compact && contact.crm_note ? <span className="mt-1 line-clamp-2 text-xs font-medium text-slate-500">{contact.crm_note}</span> : null}
            <span className="mt-1.5 flex flex-wrap gap-1 text-[10px] font-black">
              <span className="rounded-md bg-slate-900 px-2 py-0.5 text-slate-300">{storedStage.label}</span>
              <span className="rounded-md bg-slate-900 px-2 py-0.5 text-slate-300">{contact.crm_priority ?? 'Média'}</span>
              {contact.next_follow_up_at ? <span className={['rounded-md px-2 py-0.5', isDue(contact.next_follow_up_at) ? 'bg-amber-500/15 text-amber-200' : 'bg-slate-900 text-slate-400'].join(' ')}>{formatFollowUp(contact.next_follow_up_at)}</span> : null}
            </span>
          </span>
        </div>
      </button>
      {showActions ? (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => onCompleteFollowUp(contact)}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[11px] font-black text-emerald-200 hover:bg-emerald-500/15"
            title={hasFollowUp ? 'Marcar follow-up como concluído' : 'Marcar conversa como concluída'}
          >
            <Check size={14} />
            <span className="hidden sm:inline">Concluído</span>
          </button>
          <button
            type="button"
            onClick={() => onEdit(contact)}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-1.5 text-[11px] font-black text-cyan-100 hover:bg-cyan-500/15"
            title="Alterar dados ou remarcar o follow-up"
          >
            <Pencil size={13} />
            <span className="hidden sm:inline">Alterar</span>
          </button>
          <button
            type="button"
            onClick={() => onCancelFollowUp(contact)}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-rose-500/25 bg-rose-500/10 px-1.5 text-[11px] font-black text-rose-100 hover:bg-rose-500/15"
            title="Cancelar e usar Alterar para remarcar se necessário"
          >
            <X size={14} />
            <span className="hidden sm:inline">Cancelar</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

function DashboardPage({ contacts, duplicateCount, backendOnline, onNavigate, onAsk, isThinking }) {
  const total = contacts.length
  const tagged = contacts.filter(crmHasTag)
  const untagged = contacts.filter((contact) => !crmHasTag(contact))
  const activeCrm = contacts.filter(hasCrmActivity)
  const followUps = contacts
    .filter((contact) => contact.next_follow_up_at)
    .sort((a, b) => followUpTimestamp(a.next_follow_up_at) - followUpTimestamp(b.next_follow_up_at))
  const dueFollowUps = followUps.filter((contact) => isDue(contact.next_follow_up_at))
  const highPriority = contacts.filter((contact) => contact.crm_priority === 'Alta')
  const categoryStats = categoryCatalog
    .map((category) => ({
      ...category,
      count: contacts.filter((contact) => (contact.category?.id ?? classifyService(contact.service).id) === category.id).length,
    }))
    .filter((category) => category.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
  const recentContacts = contacts.slice(0, 6)
  const topCategory = categoryStats[0]
  const nextFollowUp = followUps[0]
  const graphInsights = [
    {
      id: 'agenda',
      shortLabel: 'Agenda',
      label: 'Agenda',
      value: total,
      helper: `${tagged.length} com tags`,
      detail: total ? `${untagged.length} contato${untagged.length === 1 ? '' : 's'} ainda precisam de tags.` : 'Importe contatos para iniciar a rede.',
      tone: 'cyan',
      icon: ContactRound,
      x: 50,
      y: 49,
      actionLabel: 'Ver agenda',
      route: ROUTES.AGENDA,
    },
    {
      id: 'crm',
      shortLabel: 'CRM',
      label: 'CRM',
      value: activeCrm.length,
      helper: `${highPriority.length} alta prioridade`,
      detail: activeCrm.length ? 'Há conversas, status ou follow-ups em andamento.' : 'Nenhum contato entrou no pipeline ainda.',
      tone: 'emerald',
      icon: Activity,
      x: 21,
      y: 29,
      actionLabel: 'Abrir CRM',
      route: ROUTES.CRM,
    },
    {
      id: 'followups',
      shortLabel: 'F-ups',
      label: 'Follow-ups',
      value: followUps.length,
      helper: dueFollowUps.length ? `${dueFollowUps.length} vencido${dueFollowUps.length === 1 ? '' : 's'}` : nextFollowUp ? formatFollowUp(nextFollowUp.next_follow_up_at) : 'nenhum marcado',
      detail: dueFollowUps.length ? 'Priorize os vencidos antes de abrir novas conversas.' : 'O calendário de relacionamento está sob controle.',
      tone: 'amber',
      icon: Bell,
      x: 76,
      y: 28,
      actionLabel: 'Revisar',
      route: ROUTES.CRM,
    },
    {
      id: 'categorias',
      shortLabel: 'Cat.',
      label: 'Categorias',
      value: categoryStats.length,
      helper: topCategory?.label ?? 'sem categoria forte',
      detail: topCategory ? `${topCategory.count} contato${topCategory.count === 1 ? '' : 's'} em ${topCategory.label}.` : 'Categorias aparecem quando os contatos são classificados.',
      tone: 'blue',
      icon: LayoutGrid,
      x: 28,
      y: 76,
      actionLabel: 'Explorar',
      route: ROUTES.AGENDA,
    },
    {
      id: 'qualidade',
      shortLabel: 'Qual.',
      label: 'Qualidade',
      value: duplicateCount,
      helper: duplicateCount ? 'duplicados' : 'sem alertas',
      detail: duplicateCount ? 'Aprovar mesclas melhora busca, CRM e mapa.' : 'Nenhum duplicado pendente agora.',
      tone: 'rose',
      icon: ShieldCheck,
      x: 80,
      y: 72,
      actionLabel: duplicateCount ? 'Resolver' : 'Conferir',
      route: ROUTES.DUPLICATES,
    },
  ]
  const flowSteps = [
    {
      label: '1. Limpar base',
      value: `${untagged.length + duplicateCount}`,
      helper: 'sem tags ou duplicados',
      icon: ShieldCheck,
      route: duplicateCount ? ROUTES.DUPLICATES : ROUTES.AGENDA,
    },
    {
      label: '2. Priorizar CRM',
      value: `${activeCrm.length}`,
      helper: `${highPriority.length} alta prioridade`,
      icon: Activity,
      route: ROUTES.CRM,
    },
    {
      label: '3. Expandir rede',
      value: 'Mapa',
      helper: topCategory?.label ?? 'categoria ou proximidade',
      icon: Route,
      route: ROUTES.MAP,
    },
  ]

  function askDashboard(prompt) {
    if (isThinking) return
    onAsk(prompt)
    onNavigate(ROUTES.CHAT)
  }

  return (
    <div className="space-y-4">
      <PageTitle
        eyebrow="Dashboard"
        title="Visão inteligente da rede"
        description="Acompanhe volume, organização, pendências de CRM e oportunidades de revisão."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigate(ROUTES.NEW)} className="primary-button inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black">
              <Plus size={17} />
              Novo contato
            </button>
            <button type="button" onClick={() => onNavigate(ROUTES.CHAT)} className="secondary-button inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black">
              <MessageCircle size={17} />
              Abrir chat
            </button>
          </div>
        }
      />

      <section className="command-hero rounded-xl p-5 sm:p-6">
        <div className="command-ring" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-stretch">
          <div className="flex min-h-full flex-col justify-end">
            <p className="text-xs font-black uppercase tracking-[0.34em] text-cyan-200">Command center</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight text-slate-100 sm:text-4xl">
              Sua rede virando uma base de oportunidades pesquisável.
            </h2>
            <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-slate-400">
              Priorize follow-ups, encontre pessoas por contexto e transforme contatos soltos em relacionamento acionável.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => onNavigate(ROUTES.CRM)} className="primary-button inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-black">
                <Activity size={17} />
                Abrir pipeline
              </button>
              <button type="button" onClick={() => askDashboard('Onde há oportunidade na minha rede?')} disabled={isThinking} className="secondary-button inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-black disabled:opacity-60">
                <Sparkles size={17} />
                Mapear oportunidade
              </button>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {flowSteps.map((step) => {
                const Icon = step.icon
                return (
                  <button key={step.label} type="button" onClick={() => onNavigate(step.route)} className="dashboard-flow-card rounded-lg p-3 text-left">
                    <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <Icon size={14} className="text-cyan-300" />
                      {step.label}
                    </span>
                    <span className="mt-2 block truncate text-lg font-black text-slate-100">{step.value}</span>
                    <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{step.helper}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <DashboardNetworkGraph insights={graphInsights} onNavigate={onNavigate} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="glass-panel rounded-lg">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <h2 className="text-sm font-black text-slate-100">Próximos movimentos</h2>
              <span className={['rounded-md px-2 py-1 text-[11px] font-black', backendOnline ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'].join(' ')}>
                {backendOnline ? 'online' : 'offline'}
              </span>
            </div>
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              <DashboardAction icon={Activity} title="Abrir CRM ativo" description={`${activeCrm.length} contato${activeCrm.length === 1 ? '' : 's'} com movimento.`} onClick={() => onNavigate(ROUTES.CRM)} />
              <DashboardAction icon={CheckCircle} title="Revisar duplicados" description={`${duplicateCount} sugest${duplicateCount === 1 ? 'ão' : 'ões'} para aprovar ou ignorar.`} onClick={() => onNavigate(ROUTES.DUPLICATES)} />
              <DashboardAction icon={Upload} title="Importar contatos" description="Google, CSV ou cadastro manual." onClick={() => onNavigate(ROUTES.SETTINGS)} />
              <DashboardAction icon={MapPin} title="Ver mapa" description="Localização, DDD e proximidade." onClick={() => onNavigate(ROUTES.MAP)} />
            </div>
          </div>

          <div className="glass-panel rounded-lg">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <h2 className="text-sm font-black text-slate-100">Categorias fortes</h2>
              <button type="button" onClick={() => onNavigate(ROUTES.AGENDA)} className="text-xs font-black text-cyan-300">Ver agenda</button>
            </div>
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              {categoryStats.length ? categoryStats.map((category) => {
                const Icon = category.icon
                const width = total ? Math.max(8, Math.round((category.count / total) * 100)) : 0
                return (
                  <article key={category.id} className="action-card rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon size={17} style={{ color: category.color }} />
                        <span className="truncate text-sm font-black text-slate-100">{category.label}</span>
                      </span>
                      <span className="text-xs font-black text-slate-400">{category.count}</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-900">
                      <div className="h-full rounded-full bg-cyan-400" style={{ width: `${width}%` }} />
                    </div>
                  </article>
                )
              }) : <p className="p-3 text-sm font-semibold text-slate-500">Ainda não há categorias fortes.</p>}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="glass-panel rounded-lg">
            <div className="border-b border-slate-800 px-4 py-3">
              <h2 className="text-sm font-black text-slate-100">Follow-ups</h2>
            </div>
            <div className="grid max-h-[300px] gap-2 overflow-auto p-3 thin-scrollbar">
              {followUps.length ? followUps.slice(0, 6).map((contact) => (
                <button key={contact.id} type="button" onClick={() => onNavigate(ROUTES.CRM)} className="action-card rounded-lg p-3 text-left">
                  <span className="block truncate text-sm font-black text-slate-100">{contact.name}</span>
                  <span className={['mt-1 inline-flex rounded-md px-2 py-0.5 text-[11px] font-black', isDue(contact.next_follow_up_at) ? 'bg-amber-500/15 text-amber-200' : 'bg-slate-900 text-slate-400'].join(' ')}>
                    {formatFollowUp(contact.next_follow_up_at)}
                  </span>
                </button>
              )) : <p className="text-sm font-semibold text-slate-500">Nenhum follow-up marcado.</p>}
            </div>
          </div>

          <div className="glass-panel rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300">
                <Sparkles size={18} />
              </span>
              <div>
                <h2 className="text-sm font-black text-slate-100">Copiloto</h2>
                <p className="text-xs font-semibold text-slate-500">{isThinking ? 'Analisando...' : 'Perguntas rápidas.'}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              {[
                'Quais contatos precisam de follow-up?',
                'Quais contatos estão sem tags?',
                'Onde há oportunidade na minha rede?',
              ].map((prompt) => (
                <button key={prompt} type="button" onClick={() => askDashboard(prompt)} disabled={isThinking} className="action-card rounded-lg px-3 py-2 text-left text-xs font-black text-slate-300 disabled:cursor-not-allowed disabled:opacity-60">
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-lg">
            <div className="border-b border-slate-800 px-4 py-3">
              <h2 className="text-sm font-black text-slate-100">Recentes</h2>
            </div>
            <div className="grid gap-1 p-2">
              {recentContacts.map((contact) => (
                <button key={contact.id} type="button" onClick={() => onNavigate(ROUTES.AGENDA)} className="rounded-lg px-2 py-2 text-left hover:bg-slate-950/40">
                  <span className="block truncate text-sm font-black text-slate-200">{contact.name}</span>
                  <span className="block truncate text-xs font-semibold text-slate-500">{contact.service}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}

function DashboardNetworkGraph({ insights, onNavigate }) {
  const [activeId, setActiveId] = useState(insights[0]?.id ?? '')
  const activeInsight = insights.find((item) => item.id === activeId) ?? insights[0]
  const center = insights.find((item) => item.id === 'agenda') ?? insights[0]
  const linkedInsights = insights.filter((item) => item.id !== center?.id)

  return (
    <div className="dashboard-graph rounded-xl p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">Grafo da rede</p>
          <h3 className="mt-1 text-base font-black text-slate-100">Leitura rápida do sistema</h3>
        </div>
        <span className="rounded-lg border border-cyan-400/15 bg-cyan-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-100">
          interativo
        </span>
      </div>

      <div className="dashboard-graph-map mt-3">
        <svg className="dashboard-graph-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {linkedInsights.map((item) => (
            <line
              key={item.id}
              x1={center.x}
              y1={center.y}
              x2={item.x}
              y2={item.y}
              className={item.id === activeInsight?.id ? 'is-active' : ''}
            />
          ))}
        </svg>

        {insights.map((item) => {
          const Icon = item.icon
          const active = item.id === activeInsight?.id
          return (
            <button
              key={item.id}
              type="button"
              onMouseEnter={() => setActiveId(item.id)}
              onFocus={() => setActiveId(item.id)}
              onClick={() => setActiveId(item.id)}
              className={['dashboard-graph-node', `dashboard-graph-node-${item.tone}`, active ? 'is-active' : ''].join(' ')}
              style={{ '--x': `${item.x}%`, '--y': `${item.y}%` }}
              aria-label={`${item.label}: ${item.value} ${item.helper}`}
            >
              <Icon size={15} />
              <span>{item.value}</span>
            </button>
          )
        })}

        <div className="dashboard-graph-hint left-3 top-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Passe nos nós</p>
          <p className="mt-1 text-xs font-black text-cyan-100">cada área mostra uma ação</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
        <div className="dashboard-graph-detail rounded-lg p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{activeInsight?.label}</p>
              <p className="mt-1 truncate text-lg font-black text-slate-100">{activeInsight?.helper}</p>
            </div>
            <span className={`dashboard-graph-dot dashboard-graph-dot-${activeInsight?.tone}`} />
          </div>
          <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-400">{activeInsight?.detail}</p>
        </div>
        <button
          type="button"
          onClick={() => activeInsight?.route && onNavigate(activeInsight.route)}
          className="primary-button inline-flex h-full min-h-20 items-center justify-center rounded-lg px-3 text-xs font-black"
        >
          {activeInsight?.actionLabel}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {insights.map((item) => (
          <button
            key={item.id}
            type="button"
            onMouseEnter={() => setActiveId(item.id)}
            onFocus={() => setActiveId(item.id)}
            onClick={() => setActiveId(item.id)}
            className={['dashboard-graph-chip rounded-lg px-2 py-2 text-left', item.id === activeInsight?.id ? 'is-active' : ''].join(' ')}
          >
            <span className="block truncate text-[10px] font-black uppercase tracking-widest text-slate-500">{item.shortLabel ?? item.label}</span>
            <span className="mt-1 block truncate text-sm font-black text-slate-100">{item.value}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function DashboardMetric({ label, value, helper, tone = 'text-slate-100' }) {
  return (
    <div className="metric-card rounded-lg p-3">
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${tone}`}>{value}</p>
      <p className="mt-1 truncate text-xs font-semibold text-slate-500">{helper}</p>
    </div>
  )
}

function DashboardAction({ icon: Icon, title, description, onClick }) {
  return (
    <button type="button" onClick={onClick} className="action-card rounded-lg p-3 text-left">
      <span className="flex items-center gap-2">
        <Icon size={17} className="text-cyan-300" />
        <span className="text-sm font-black text-slate-100">{title}</span>
      </span>
      <span className="mt-1 block text-xs font-semibold text-slate-500">{description}</span>
    </button>
  )
}

function ContactDetailPage({ contact, onEdit, onNavigate }) {
  if (!contact) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => onNavigate(ROUTES.AGENDA)} className="inline-flex items-center gap-2 text-sm font-black text-slate-500">
          <ArrowLeft size={16} />
          Agenda
        </button>
        <div className="glass-panel rounded-lg p-5">
          <p className="text-sm font-black text-slate-100">Contato não encontrado.</p>
        </div>
      </div>
    )
  }

  const category = contact.category ?? categoryDetails(null, contact.service)
  const tags = tagList(contact.tags)
  const fields = parseCustomFields(contact.custom_fields)
  const socialLinks = [
    { label: 'WhatsApp', value: contact.whatsapp || contact.phone, icon: MessageCircle, href: formatPhoneForLink(contact.whatsapp || contact.phone) ? `https://wa.me/55${formatPhoneForLink(contact.whatsapp || contact.phone)}` : '' },
    { label: 'Instagram', value: contact.instagram, icon: ContactRound, href: contact.instagram ? `https://instagram.com/${String(contact.instagram).replace('@', '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}` : '' },
    { label: 'LinkedIn', value: contact.linkedin, icon: Briefcase, href: contact.linkedin },
    { label: 'Site', value: contact.custom_url, icon: Compass, href: contact.custom_url },
  ].filter((link) => link.value)

  function openLink(href) {
    if (!href) return
    const normalized = href.startsWith('http') ? href : `https://${href}`
    window.open(normalized, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => onNavigate(ROUTES.AGENDA)} className="inline-flex items-center gap-2 text-sm font-black text-slate-500">
        <ArrowLeft size={16} />
        Agenda
      </button>

      <section className="glass-panel rounded-lg p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <ContactAvatar contact={contact} />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-widest text-cyan-400">{category.label}</p>
              <h1 className="mt-1 truncate text-2xl font-black text-slate-100">{contact.name}</h1>
              <p className="mt-1 text-sm font-semibold text-slate-400">{contact.service}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">{contact.phone} · {contact.city || 'Sem cidade'}</p>
            </div>
          </div>
          <button type="button" onClick={() => onEdit(contact)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-3 text-sm font-black text-slate-950">
            <Pencil size={16} />
            Editar
          </button>
        </div>
        {tags.length ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {tags.map((tag) => <span key={tag} className="rounded-md border border-cyan-400/10 bg-cyan-400/10 px-2 py-1 text-xs font-black text-cyan-100">{tag}</span>)}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <ContactInfoBlock title="Descrição" value={contact.description || contact.note || 'Sem descrição.'} />
          <div className="grid gap-4 md:grid-cols-2">
            <ContactInfoBlock title="O que demanda atualmente" value={contact.demand || 'Sem demanda registrada.'} />
            <ContactInfoBlock title="Problema que resolve" value={contact.solves || 'Sem problema registrado.'} />
          </div>
          <div className="glass-panel rounded-lg p-4">
            <h2 className="text-sm font-black text-slate-100">Campos personalizados</h2>
            <div className="mt-3 grid gap-2">
              {fields.length ? fields.filter((field) => field.label || field.value).map((field, index) => (
                <div key={index} className="rounded-lg border border-slate-800 bg-slate-950/35 p-3">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">{field.label || 'Campo'}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-200">{field.value || '-'}</p>
                </div>
              )) : <p className="text-sm font-semibold text-slate-500">Nenhum campo personalizado.</p>}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="glass-panel rounded-lg p-4">
            <h2 className="text-sm font-black text-slate-100">CRM</h2>
            <div className="mt-3 grid gap-2 text-sm">
              <DetailRow label="Status" value={contact.crm_status || 'Novo'} />
              <DetailRow label="Prioridade" value={contact.crm_priority || 'Média'} />
              <DetailRow label="Último contato" value={contact.last_contact_at ? formatFollowUp(contact.last_contact_at) : 'Não registrado'} />
              <DetailRow label="Próximo follow-up" value={contact.next_follow_up_at ? formatFollowUp(contact.next_follow_up_at) : 'Não marcado'} />
            </div>
            {contact.crm_note ? <p className="glass-panel-soft mt-3 rounded-lg p-3 text-sm font-medium text-slate-400">{contact.crm_note}</p> : null}
          </div>

          <div className="glass-panel rounded-lg p-4">
            <h2 className="text-sm font-black text-slate-100">Links</h2>
            <div className="mt-3 grid gap-2">
              {contact.email ? <DetailRow label="Email" value={contact.email} /> : null}
              {socialLinks.length ? socialLinks.map((link) => {
                const Icon = link.icon
                return (
                  <button key={link.label} type="button" onClick={() => openLink(link.href)} className="flex h-10 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/35 px-3 text-left text-sm font-black text-slate-200">
                    <Icon size={16} className="text-cyan-300" />
                    {link.label}
                  </button>
                )
              }) : <p className="text-sm font-semibold text-slate-500">Nenhum link preenchido.</p>}
            </div>
          </div>

          <div className="glass-panel rounded-lg p-4">
            <h2 className="text-sm font-black text-slate-100">Origem</h2>
            <div className="mt-3 grid gap-2 text-sm">
              <DetailRow label="Fonte" value={contact.source || 'Manual'} />
              <DetailRow label="Endereço" value={contact.address || 'Não informado'} />
              <DetailRow label="Criado em" value={contact.created_at || '-'} />
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}

function ContactInfoBlock({ title, value }) {
  return (
    <div className="glass-panel rounded-lg p-4">
      <h2 className="text-sm font-black text-slate-100">{title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-400">{value}</p>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-slate-950/35 px-3 py-2">
      <span className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-200">{value}</span>
    </div>
  )
}
function GoogleRequiredPanel({ title, description, onNavigate }) {
  return (
    <div className="space-y-4">
      <PageTitle
        eyebrow="Google obrigatório"
        title={title}
        description={description}
        action={
          <button type="button" onClick={() => onNavigate(ROUTES.REGISTER)} className="primary-button inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black">
            <UserRound size={17} />
            Conectar no perfil
          </button>
        }
      />
      <section className="glass-panel rounded-lg p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
              <Lock size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-100">Conecte a conta Google para continuar</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                A conexão fica no rodapé do perfil e libera dados salvos, mapa, rede pública e recursos conectados.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => onNavigate(ROUTES.REGISTER)} className="secondary-button inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black">
            Abrir perfil
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  )
}

function PublicNetworkPage({ publicProfiles, contacts, user, onNavigate, onOpenGroup }) {
  const [query, setQuery] = useState('')
  const currentUserId = String(user?.id ?? '')
  const people = publicProfiles.filter((profile) => (profile.kind ?? 'group') === 'person')
  const groups = publicProfiles.filter((profile) => (profile.kind ?? 'group') !== 'person')
  const visiblePeople = people.filter((profile) => matchText(query, [profile.name, profile.service, profile.area, profile.description, profile.demand, profile.solves, profile.tags]))
  const visibleGroups = groups.filter((profile) => matchText(query, [profile.name, profile.service, profile.area, profile.category?.label]))
  const userIsVisible = people.some((profile) => String(profile.source_user_id ?? profile.id) === currentUserId)

  if (!hasGoogleConnection(user)) {
    return (
      <GoogleRequiredPanel
        title="Rede pública bloqueada"
        description="A rede pública usa dados conectados para evitar perfis soltos e manter sua conta salva corretamente."
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <div className="space-y-4">
      <PageTitle
        eyebrow="Rede pública"
        title="Explorar perfis visíveis"
        description="Pessoas que optaram por aparecer na rede, com demandas, problemas que resolvem e links preenchidos."
      />

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="glass-panel rounded-lg p-3">
          <div className="glass-panel-soft flex min-w-0 items-center gap-2 rounded-lg px-3">
            <Search size={18} className="text-slate-500" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-600" placeholder="Buscar por pessoa, tag, demanda ou solução" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Metric value={visiblePeople.length} label="pessoas" />
          <Metric value={visibleGroups.length} label="serviços" />
          <Metric value={userIsVisible ? 'ativo' : 'oculto'} label="meu perfil" />
        </div>
      </section>

      {!userIsVisible ? (
        <div className="glass-panel flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left">
          <span>
            <span className="block text-sm font-black text-cyan-100">Seu perfil ainda não está visível na rede.</span>
            <span className="mt-1 block text-xs font-semibold text-cyan-200/70">A visibilidade pública será configurada em uma área própria, separada do perfil.</span>
          </span>
          <button type="button" onClick={() => onNavigate(ROUTES.PUBLIC_PROFILE)} className="secondary-button inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-black">
            Configurar
            <ArrowRight size={15} />
          </button>
        </div>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-black text-slate-100">Pessoas</h2>
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">{visiblePeople.length} visíveis</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visiblePeople.length ? visiblePeople.map((profile) => (
            <PublicPersonCard key={`person-${profile.id}`} profile={profile} contacts={contacts} currentUserId={currentUserId} />
          )) : (
            <div className="glass-panel rounded-lg border-dashed p-6 text-sm font-semibold text-slate-500 md:col-span-2 xl:col-span-3">
              Nenhum perfil público encontrado para essa busca.
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-black text-slate-100">Serviços oferecidos</h2>
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">{visibleGroups.length} visíveis</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleGroups.length ? visibleGroups.map((profile) => (
            <PublicGroupCard key={`group-${profile.id}`} profile={profile} onOpen={onOpenGroup} />
          )) : (
            <div className="glass-panel rounded-lg border-dashed p-6 text-sm font-semibold text-slate-500 md:col-span-2 xl:col-span-3">
              Nenhum serviço encontrado para essa busca.
            </div>
          )}
        </div>
      </section>

    </div>
  )
}

function PublicPersonCard({ profile, contacts, currentUserId }) {
  const category = profile.category ?? categoryDetails(null, profile.service)
  const tags = tagList(profile.tags)
  const internalMatch = contacts.find((contact) => {
    const samePhone = formatPhoneForLink(contact.phone) && formatPhoneForLink(contact.phone) === formatPhoneForLink(profile.phone)
    const sameEmail = contact.email && profile.email && normalize(contact.email) === normalize(profile.email)
    return samePhone || sameEmail
  })
  const isMe = String(profile.source_user_id ?? profile.id) === currentUserId
  const links = [
    { label: 'WhatsApp', icon: MessageCircle, href: formatPhoneForLink(profile.whatsapp || profile.phone) ? `https://wa.me/55${formatPhoneForLink(profile.whatsapp || profile.phone)}` : '' },
    { label: 'Instagram', icon: ContactRound, href: profile.instagram ? `https://instagram.com/${String(profile.instagram).replace('@', '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}` : '' },
    { label: 'LinkedIn', icon: Briefcase, href: profile.linkedin },
    { label: 'Site', icon: Compass, href: profile.custom_url },
  ].filter((link) => link.href)

  function openLink(href) {
    const normalized = href.startsWith('http') ? href : `https://${href}`
    window.open(normalized, '_blank', 'noopener,noreferrer')
  }

  return (
    <article className="glass-panel rounded-lg p-4 transition hover:border-cyan-400/35">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white" style={{ backgroundColor: category.color }}>
          {initials(profile.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-black text-slate-100">{profile.name}</h3>
            {isMe ? <span className="rounded-md bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-black text-cyan-200">eu</span> : null}
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-400">{profile.service}</p>
          <p className="mt-1 truncate text-xs font-medium text-slate-500">{profile.area || 'Rede pública'}</p>
        </div>
      </div>
      {tags.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => <span key={tag} className="rounded-md border border-cyan-400/10 bg-cyan-400/10 px-2 py-1 text-[11px] font-black text-cyan-100">{tag}</span>)}
        </div>
      ) : null}
      <div className="mt-3 grid gap-2">
        {profile.description ? <PublicProfileText label="Descrição" value={profile.description} /> : null}
        {profile.solves ? <PublicProfileText label="Resolve" value={profile.solves} /> : null}
        {profile.demand ? <PublicProfileText label="Busca" value={profile.demand} /> : null}
      </div>
      {internalMatch ? (
        <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100">
          Já existe na sua agenda: {internalMatch.name}
        </div>
      ) : null}
      {links.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {links.map((link) => {
            const Icon = link.icon
            return (
              <button key={link.label} type="button" onClick={() => openLink(link.href)} className="secondary-button inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-black">
                <Icon size={14} className="text-cyan-300" />
                {link.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </article>
  )
}

function PublicProfileText({ label, value }) {
  return (
    <div className="glass-panel-soft rounded-lg px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 line-clamp-3 text-sm font-medium leading-5 text-slate-300">{value}</p>
    </div>
  )
}

function SearchPage({ queryDraft, setQueryDraft, onSearch, recents, contacts, publicProfiles, user, onNavigate, onOpenGroup }) {
  const recommendedGroups = getRecommendedGroups(publicProfiles, user, '')
  const recentContacts = contacts.slice(0, 5)

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Busca" title="Encontre quem resolve" description="Busca compacta por serviço, pessoa ou necessidade. Os recentes aparecem quando você toca no campo." />
      <SearchBox value={queryDraft} onChange={setQueryDraft} onSearch={onSearch} recents={recents} contacts={contacts} />

      <CategoryButtons contacts={contacts} activeCategory={null} onNavigate={onNavigate} />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-black text-slate-100">Recentes da agenda</h2>
            <button type="button" onClick={() => onNavigate(ROUTES.AGENDA)} className="inline-flex items-center gap-1 text-sm font-black text-cyan-700">
              Ver agenda <ArrowRight size={15} />
            </button>
          </div>
          <ContactList contacts={recentContacts} onDelete={() => {}} onToast={() => {}} emptyLabel="Sua agenda ainda está vazia." />
        </div>

        <div>
          <h2 className="mb-2 text-base font-black text-slate-100">Sugestões para você</h2>
          <div className="grid gap-3">
            {recommendedGroups.slice(0, 3).map((profile) => (
              <PublicGroupCard key={profile.id} profile={profile} onOpen={onOpenGroup} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function AgendaPage({ contacts, activeCategory, queryDraft, setQueryDraft, onSearch, recents, onDelete, onToast, onEdit, onOpenContact, onNavigate, onImport, isImporting }) {
  const filtered = useMemo(() => {
    return contacts.filter((contact) => {
      const categoryId = contact.category?.id ?? classifyService(contact.service).id
      const categoryMatch = activeCategory === 'all' || categoryId === activeCategory
      return categoryMatch && matchText(queryDraft, [contact.name, contact.phone, contact.service, contact.city, contact.address])
    })
  }, [contacts, activeCategory, queryDraft])
  const fileInputRef = useRef(null)
  const selectedCategory = getCategory(activeCategory)

  return (
    <div className="space-y-4">
      <PageTitle
        eyebrow="Agenda"
        title="Contatos"
        description="Lista simples, alfabética e rápida, com ações diretas de chamada e WhatsApp."
        action={
          <div className="flex gap-2">
            <button type="button" onClick={() => onNavigate(ROUTES.CRM)} className="secondary-button inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black">
              <Activity size={17} />
              CRM
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,.txt,.vcf" onChange={onImport} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="secondary-button inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black">
              <Upload size={17} />
              {isImporting ? 'Importando' : 'Importar'}
            </button>
            <button type="button" onClick={() => onNavigate(ROUTES.NEW)} className="primary-button inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black">
              <Plus size={17} />
              Novo
            </button>
          </div>
        }
      />
      <CategoryButtons contacts={contacts} activeCategory={activeCategory} onNavigate={onNavigate} onSelect={(id) => onNavigate(`/categoria/${id}`)} />
      <SearchBox value={queryDraft} onChange={setQueryDraft} onSearch={onSearch} recents={recents} contacts={contacts} />
      <ContactList contacts={filtered} onDelete={onDelete} onToast={onToast} onEdit={onEdit} onOpen={onOpenContact} emptyLabel={selectedCategory ? `Nenhum contato em ${selectedCategory.label}.` : 'Nenhum contato encontrado.'} />
    </div>
  )
}

function ChatPage({ contacts, messages, onAsk, onApplySuggestion, onNavigate, isThinking }) {
  const [draft, setDraft] = useState('')
  const [selectedContactId, setSelectedContactId] = useState('')
  const [targetInput, setTargetInput] = useState('')
  const messagesEndRef = useRef(null)
  const reviewCount = contacts.filter((contact) => contact.category?.id === 'general' || isGenericService(contact.service)).length
  const lastSuggestions = [...messages].reverse().find((message) => message.suggestions?.length)?.suggestions ?? []
  const visibleSuggestions = lastSuggestions.slice(0, 4)
  const selectedContact = contacts.find((contact) => String(contact.id) === selectedContactId)
  const targetContactOptions = useMemo(() => {
    const normalizedSearch = normalize(targetInput)
    const ordered = contacts
      .slice()
      .filter((contact) => {
        if (!normalizedSearch) return true
        const label = targetContactServiceLabel(contact)
        return matchText(normalizedSearch, [contact.name, contact.service, label, contact.phone, contact.city, targetContactOptionValue(contact)])
      })
      .sort((a, b) => {
        const aLabel = targetContactServiceLabel(a)
        const bLabel = targetContactServiceLabel(b)
        if (aLabel === 'Sem categoria' && bLabel !== 'Sem categoria') return 1
        if (bLabel === 'Sem categoria' && aLabel !== 'Sem categoria') return -1
        const serviceOrder = aLabel.localeCompare(bLabel, 'pt-BR', { sensitivity: 'base' })
        if (serviceOrder !== 0) return serviceOrder
        return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' })
      })

    const visible = ordered.slice(0, 80)
    if (selectedContact && !visible.some((contact) => String(contact.id) === String(selectedContact.id))) {
      visible.unshift(selectedContact)
    }
    return { contacts: visible, total: ordered.length, visible: visible.length }
  }, [contacts, selectedContact, targetInput])

  function updateTargetInput(value) {
    setTargetInput(value)
    const selected = contacts.find((contact) => {
      const normalizedValue = normalize(value)
      return normalize(targetContactOptionValue(contact)) === normalizedValue || normalize(contact.name) === normalizedValue
    })
    setSelectedContactId(selected ? String(selected.id) : '')
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, isThinking])

  async function submit(event) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || isThinking) return
    setDraft('')
    await onAsk(message, selectedContactId || null)
  }

  function quickAsk(message) {
    if (isThinking) return
    setDraft('')
    onAsk(message, selectedContactId || null)
  }

  return (
    <div className="space-y-4">
      <PageTitle
        eyebrow="Copiloto"
        title="Chat de organização"
        description={`${reviewCount} contato${reviewCount === 1 ? '' : 's'} precisam de revisão. Peça ajuda para categorizar, buscar serviços ou organizar importações do Google.`}
      />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="glass-panel flex h-[600px] max-h-[calc(100vh-11rem)] min-h-[480px] flex-col overflow-hidden rounded-lg max-sm:h-[470px] max-sm:max-h-[calc(100vh-13rem)] max-sm:min-h-[390px] lg:h-[calc(100vh-12rem)] lg:max-h-[820px] lg:min-h-[620px]">
          <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3 sm:p-4">
            {messages.map((message) => (
              <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={[
                    'max-w-[92%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm font-semibold leading-relaxed sm:max-w-[84%]',
                    message.role === 'user' ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-950/20' : 'glass-panel-soft text-slate-200',
                  ].join(' ')}
                >
                  {message.text}
                  {message.provider ? <span className="mt-1 block text-[11px] font-black uppercase tracking-widest opacity-60">{message.provider === 'openai' ? 'IA conectada' : 'motor local'}</span> : null}
                  {message.cta ? (
                    <button
                      type="button"
                      onClick={() => onNavigate(message.cta.route)}
                      className="mt-3 inline-flex h-8 items-center justify-center rounded-lg bg-cyan-500 px-3 text-xs font-black text-slate-950"
                    >
                      {message.cta.label}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {isThinking ? (
            <div className="flex justify-start">
                <div className="glass-panel-soft rounded-lg px-3 py-2 text-sm font-black text-slate-400">Analisando contatos...</div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={submit} className="shrink-0 border-t border-slate-800/70 bg-slate-950/25 p-3 backdrop-blur">
            <div className="mb-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                Contato alvo
                <input
                  value={targetInput}
                  onChange={(event) => updateTargetInput(event.target.value)}
                  list="chat-target-contacts"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 text-sm font-bold normal-case tracking-normal text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-400"
                  placeholder="Digite ou selecione um contato"
                />
                <datalist id="chat-target-contacts">
                  {targetContactOptions.contacts.map((contact) => (
                    <option key={contact.id} value={targetContactOptionValue(contact)} label={contact.phone ? `${contact.phone} · ${contact.city || 'sem cidade'}` : contact.city || ''} />
                  ))}
                </datalist>
              </label>
            </div>
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {['Concluir follow-up do Carlos', 'Marcar Aline como oportunidade', 'Categorizar Renato como finanças', 'Quem pode ajudar com limpeza?'].map((item) => (
                <button key={item} type="button" onClick={() => quickAsk(item)} className="action-card shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-black text-slate-300">
                  {item}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
                placeholder="Ex.: agendar Aline na próxima sexta 14h"
                rows={1}
                className="field-input min-h-11 resize-none py-3"
              />
              <button type="submit" disabled={isThinking || !draft.trim()} className="primary-button h-11 shrink-0 rounded-lg px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50 sm:w-28">
                Enviar
              </button>
            </div>
          </form>
        </div>

        <aside className="min-h-0 space-y-3 lg:overflow-auto">
          <div className="glass-panel rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300">
                <Sparkles size={18} />
              </span>
              <div>
                <h2 className="text-sm font-black text-slate-100">Sugestões aplicáveis</h2>
                <p className="text-xs font-semibold text-slate-500">
                  {lastSuggestions.length > visibleSuggestions.length
                    ? `Mostrando ${visibleSuggestions.length} de ${lastSuggestions.length}`
                    : `${lastSuggestions.length} ajuste${lastSuggestions.length === 1 ? '' : 's'} encontrado${lastSuggestions.length === 1 ? '' : 's'}`}
                </p>
              </div>
            </div>
          </div>

          {lastSuggestions.length ? (
            <div className="space-y-2">
              {visibleSuggestions.map((suggestion) => (
                <article key={`${suggestion.contact_id}-${suggestion.action ?? 'categorize'}-${suggestion.suggested_service}-${suggestion.crm_status}-${suggestion.next_follow_up_at}`} className="glass-panel rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black text-slate-100">{suggestion.name}</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {suggestion.label || (suggestion.action === 'categorize' ? 'Atualizar categoria' : 'Atualizar contato')}
                      </p>
                      <p className="mt-1 text-xs font-black text-cyan-300">
                        {suggestion.action === 'set_crm' && suggestion.next_follow_up_at
                          ? formatFollowUp(suggestion.next_follow_up_at)
                          : suggestion.action === 'set_crm' && (suggestion.crm_status || suggestion.crm_priority)
                            ? [suggestion.crm_status, suggestion.crm_priority].filter(Boolean).join(' · ')
                            : suggestion.action === 'complete_follow_up'
                              ? 'Concluir follow-up'
                              : suggestion.action === 'clear_follow_up'
                                ? 'Remover follow-up'
                                : categoryDetails({ id: suggestion.category_id }, suggestion.suggested_service).label}
                      </p>
                    </div>
                    <button type="button" onClick={() => onApplySuggestion(suggestion)} disabled={suggestion.action === 'conflict'} className="primary-button h-9 shrink-0 rounded-lg px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50">
                      {suggestion.action === 'conflict' ? 'Bloqueado' : 'Aplicar'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-500">{suggestion.reason}</p>
                </article>
              ))}
              {lastSuggestions.length > visibleSuggestions.length ? (
                <p className="text-xs font-bold text-slate-500">Mostrando os 4 ajustes mais prováveis. Refine o pedido ou escolha um contato alvo para reduzir a lista.</p>
              ) : null}
            </div>
          ) : (
            <div className="glass-panel rounded-lg border-dashed p-4 text-sm font-semibold text-slate-500">
              Peça ao chat para organizar os contatos importados e as sugestões aparecem aqui.
            </div>
          )}
        </aside>
      </section>
    </div>
  )
}

function DuplicatesPage({ suggestions, isLoading, onRefresh, onMerge, onIgnore, onReview, onNavigate }) {
  return (
    <div className="space-y-4">
      <button type="button" onClick={() => onNavigate(ROUTES.AGENDA)} className="inline-flex items-center gap-2 text-sm font-black text-slate-500">
        <ArrowLeft size={16} />
        Voltar
      </button>
      <PageTitle
        eyebrow="Deduplicação"
        title="Possíveis duplicados"
        description="O app sugere pares com mesmo telefone ou email. Nada é mesclado automaticamente."
        action={
          <button type="button" onClick={onRefresh} className="secondary-button inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black">
            <Search size={17} />
            {isLoading ? 'Verificando' : 'Verificar'}
          </button>
        }
      />

      {suggestions.length ? (
        <div className="grid gap-3">
          {suggestions.map((suggestion) => (
            <DuplicateSuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onMerge={onMerge}
              onIgnore={onIgnore}
              onReview={onReview}
            />
          ))}
        </div>
      ) : (
        <div className="glass-panel rounded-lg border-dashed p-8 text-center">
          <CheckCircle className="mx-auto text-emerald-400" size={34} />
          <p className="mt-3 text-sm font-black text-slate-200">{isLoading ? 'Verificando duplicados...' : 'Nenhum duplicado pendente.'}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">Quando dois contatos tiverem o mesmo telefone ou email, eles aparecem aqui para aprovação.</p>
        </div>
      )}
    </div>
  )
}

function DuplicateSuggestionCard({ suggestion, onMerge, onIgnore, onReview }) {
  const matchLabel = suggestion.match_type === 'email' ? 'Email igual' : 'Telefone igual'
  return (
    <article className="glass-panel rounded-lg p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-lg bg-cyan-500/10 px-2.5 py-1 text-xs font-black uppercase tracking-widest text-cyan-300">{matchLabel}</span>
        <span className="break-all text-xs font-bold text-slate-500">{suggestion.match_value}</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <DuplicateContactPreview label="Manter" contact={suggestion.primary_contact} />
        <DuplicateContactPreview label="Mesclar e remover" contact={suggestion.duplicate_contact} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={() => onReview(suggestion.duplicate_contact)} className="h-10 rounded-lg border border-slate-800 text-sm font-black text-slate-300">
          Revisar
        </button>
        <button type="button" onClick={() => onIgnore(suggestion)} className="h-10 rounded-lg border border-slate-800 text-sm font-black text-slate-300">
          Ignorar
        </button>
        <button type="button" onClick={() => onMerge(suggestion)} className="h-10 rounded-lg bg-cyan-500 text-sm font-black text-slate-950">
          Mesclar
        </button>
      </div>
    </article>
  )
}

function DuplicateContactPreview({ label, contact }) {
  const contactWithCategory = { ...contact, category: categoryDetails(contact.category, contact.service) }
  return (
    <div className="glass-panel-soft min-w-0 rounded-lg p-3">
      <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">{label}</p>
      <div className="flex min-w-0 items-start gap-3">
        <ContactAvatar contact={contactWithCategory} />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-black text-slate-100">{contact.name}</h3>
          <p className="truncate text-sm font-semibold text-slate-400">{contact.service}</p>
          <p className="truncate text-xs font-medium text-slate-500">{contact.phone} - {contact.source}</p>
        </div>
      </div>
    </div>
  )
}

function SettingsPage({ user, contacts, duplicateCount, backendOnline, recents, onNavigate, onRefreshDuplicates, onImportGoogleContacts, onExportContacts, onClearRecents, onLogout }) {
  const visibleName = user?.name || 'Perfil'
  const googleContactsImported = Boolean(user?.googleContactsImportedAt)
  return (
    <div className="space-y-4">
      <PageTitle eyebrow="Configurações" title="Menu da conta" description="Perfil, organização da agenda, dados locais e estado do app." />

      <section className="glass-panel rounded-lg p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cyan-500 text-base font-black text-slate-950">{initials(visibleName)}</span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black text-slate-100">{visibleName}</h2>
              <p className="truncate text-sm font-semibold text-slate-500">{user?.email || 'Conta local'}</p>
            </div>
          </div>
          <button type="button" onClick={() => onNavigate(ROUTES.REGISTER)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-3 text-sm font-black text-slate-950">
            <Pencil size={17} />
            Editar perfil
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <SettingsAction
          icon={Circle}
          title="Possíveis duplicados"
          description={`${duplicateCount} ${duplicateCount === 1 ? 'sugestão pendente' : 'sugestões pendentes'} por telefone ou email igual.`}
          actionLabel="Abrir"
          onAction={() => onNavigate(ROUTES.DUPLICATES)}
        />
        {googleContactsImported ? (
          <SettingsAction
            icon={CheckCircle}
            title="Google conectado"
            description={`${contacts.length} contato${contacts.length === 1 ? '' : 's'} na agenda. A importação do Google já foi concluída.`}
            actionLabel="Editar perfil"
            onAction={() => onNavigate(ROUTES.REGISTER)}
          />
        ) : (
          <SettingsAction
            icon={Cloud}
            title="Google Contacts"
            description={`${contacts.length} contato${contacts.length === 1 ? '' : 's'} na agenda. Importe contatos do Google depois do login.`}
            actionLabel="Importar Google"
            onAction={onImportGoogleContacts}
          />
        )}
        <SettingsAction
          icon={MessageCircle}
          title="Copiloto"
          description="Use o chat para buscar contatos e pedir ajuda na revisão de categorias."
          actionLabel="Abrir chat"
          onAction={() => onNavigate(ROUTES.CHAT)}
        />
        <SettingsAction
          icon={Compass}
          title="Rede pública"
          description={user?.publicVisible ? 'Seu perfil está visível para exploração dentro da plataforma.' : 'A visibilidade pública será configurada fora da tela de perfil.'}
          actionLabel={user?.publicVisible ? 'Explorar rede' : 'Configurar'}
          onAction={() => onNavigate(user?.publicVisible ? ROUTES.PUBLIC : ROUTES.PUBLIC_PROFILE)}
        />
        <SettingsAction
          icon={UsersRound}
          title="Perfil público"
          description="Configure visibilidade, descrição, demandas, serviços e links que aparecem na rede pública."
          actionLabel="Editar"
          onAction={() => onNavigate(ROUTES.PUBLIC_PROFILE)}
        />
        <SettingsAction
          icon={Cloud}
          title="Status da API"
          description={backendOnline ? 'Backend conectado e salvando dados.' : 'Backend offline; o app pode usar dados locais temporários.'}
          actionLabel="Verificar duplicados"
          onAction={onRefreshDuplicates}
        />
      </section>

      <section className="glass-panel rounded-lg">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-base font-black text-slate-100">Dados e sessão</h2>
        </div>
        <SettingsRow label="Exportar contatos" value="Baixar JSON da agenda atual" actionLabel="Exportar" onAction={onExportContacts} />
        <SettingsRow label="Buscas recentes" value={`${recents.length} ${recents.length === 1 ? 'item salvo' : 'itens salvos'}`} actionLabel="Limpar" onAction={onClearRecents} />
        <SettingsRow label="Sessão" value={user ? 'Conta conectada' : 'Visitante'} actionLabel="Sair" onAction={onLogout} danger />
      </section>
    </div>
  )
}

function PublicProfileSettingsPage({ user, onSaveUser, onNavigate }) {
  const [draft, setDraft] = useState(normalizeUserDraft(user))
  const [errors, setErrors] = useState({})
  const [cepStatus, setCepStatus] = useState('')
  const [status, setStatus] = useState('')

  if (!hasGoogleConnection(user)) {
    return (
      <GoogleRequiredPanel
        title="Perfil público bloqueado"
        description="Conecte sua conta Google antes de configurar a visibilidade pública."
        onNavigate={onNavigate}
      />
    )
  }

  function updateDraft(field, value) {
    setDraft((current) => {
      const next = { ...current, [field]: value }
      if (['serviceAddressLine', 'serviceAddressNumber', 'serviceAddressComplement', 'serviceNeighborhood', 'serviceCity', 'serviceState'].includes(field)) {
        next.serviceAddress = composeAddress({
          addressLine: next.serviceAddressLine,
          addressNumber: next.serviceAddressNumber,
          addressComplement: next.serviceAddressComplement,
          neighborhood: next.serviceNeighborhood,
          city: next.serviceCity,
          state: next.serviceState,
        })
      }
      return next
    })
  }

  async function findServiceCep() {
    setCepStatus('Consultando CEP...')
    try {
      const result = await lookupCep(draft.serviceCep)
      setDraft((current) => ({
        ...current,
        serviceCep: result.cep,
        serviceAddressLine: result.addressLine,
        serviceNeighborhood: result.neighborhood,
        serviceCity: result.city,
        serviceState: result.state,
        serviceAddress: composeAddress({
          addressLine: result.addressLine,
          addressNumber: current.serviceAddressNumber,
          addressComplement: current.serviceAddressComplement,
          neighborhood: result.neighborhood,
          city: result.city,
          state: result.state,
        }),
      }))
      setCepStatus('CEP validado.')
    } catch (error) {
      setCepStatus(error.message)
    }
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = {
      publicDescription: draft.publicVisible && !draft.publicDescription.trim() ? 'Obrigatória para aparecer na rede.' : '',
      offeredServices: draft.publicVisible && draft.isCollaborator && !draft.offeredServices.trim() ? 'Informe ao menos um serviço.' : '',
      serviceCep: draft.isCollaborator && draft.useDifferentServiceAddress && !isValidCep(draft.serviceCep) ? 'CEP obrigatório e válido.' : '',
      serviceCity: draft.isCollaborator && draft.useDifferentServiceAddress && !draft.serviceCity.trim() ? 'Informe a cidade.' : '',
      serviceState: draft.isCollaborator && draft.useDifferentServiceAddress && !draft.serviceState.trim() ? 'Informe a UF.' : '',
      serviceAddressNumber: draft.isCollaborator && draft.useDifferentServiceAddress && !draft.serviceAddressNumber.trim() ? 'Informe o número.' : '',
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) {
      setStatus('Revise os campos destacados.')
      return
    }
    setStatus('Salvando perfil público...')
    try {
      await onSaveUser(normalizeUserDraft(draft), [], { redirectTo: ROUTES.PUBLIC_PROFILE, successMessage: 'Perfil público salvo.' })
      setStatus('Perfil público salvo.')
    } catch (error) {
      setStatus(error.message || 'Não foi possível salvar o perfil público.')
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle
        eyebrow="Perfil público"
        title="Como você aparece na rede"
        description="Configure somente os dados que podem ficar visíveis para outras pessoas da plataforma."
        action={
          <button type="button" onClick={() => onNavigate(ROUTES.PUBLIC)} className="secondary-button inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black">
            Ver rede
            <ArrowRight size={16} />
          </button>
        }
      />

      <form onSubmit={submit} noValidate className="space-y-3">
        <section className="glass-panel rounded-lg p-4">
          <label className="flex items-start gap-3 text-sm font-bold text-slate-300">
            <input
              type="checkbox"
              checked={draft.publicVisible}
              onChange={(event) => updateDraft('publicVisible', event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block text-slate-100">Aparecer na rede pública</span>
              <span className="block text-xs font-semibold text-slate-500">Quando ativo, outras pessoas veem seu card público e seus serviços oferecidos.</span>
            </span>
          </label>
        </section>

        <section className="glass-panel rounded-lg p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-black text-slate-100">Apresentação</h2>
            <span className={['rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest', draft.publicVisible ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-500/10 text-slate-400'].join(' ')}>
              {draft.publicVisible ? 'visível' : 'oculto'}
            </span>
          </div>
          <div className="grid gap-3">
            <Field label="Descrição pública" required={draft.publicVisible} error={errors.publicDescription}>
              <textarea value={draft.publicDescription} onChange={(event) => updateDraft('publicDescription', event.target.value)} className={`${inputClass(errors.publicDescription)} min-h-24 resize-y`} placeholder="Quem é você e como quer aparecer na rede" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="O que demanda atualmente">
                <textarea value={draft.publicDemand} onChange={(event) => updateDraft('publicDemand', event.target.value)} className="field-input min-h-24 resize-y" placeholder="O que você está buscando agora" />
              </Field>
              <Field label="Problema que resolve">
                <textarea value={draft.publicSolves} onChange={(event) => updateDraft('publicSolves', event.target.value)} className="field-input min-h-24 resize-y" placeholder="Que tipo de problema você resolve" />
              </Field>
            </div>
            <Field label="Tags públicas">
              <input value={draft.publicTags} onChange={(event) => updateDraft('publicTags', event.target.value)} className="field-input" placeholder="networking, vendas, eventos" />
            </Field>
          </div>
        </section>

        <section className="glass-panel rounded-lg p-4">
          <h2 className="mb-3 text-base font-black text-slate-100">Links e contato público</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="WhatsApp público">
              <input value={draft.publicWhatsapp} onChange={(event) => updateDraft('publicWhatsapp', event.target.value)} className="field-input" placeholder="Use vazio para aproveitar seu telefone" />
            </Field>
            <Field label="Instagram">
              <input value={draft.publicInstagram} onChange={(event) => updateDraft('publicInstagram', event.target.value)} className="field-input" placeholder="@usuario" />
            </Field>
            <Field label="LinkedIn">
              <input value={draft.publicLinkedin} onChange={(event) => updateDraft('publicLinkedin', event.target.value)} className="field-input" placeholder="linkedin.com/in/..." />
            </Field>
            <Field label="URL customizada">
              <input value={draft.publicUrl} onChange={(event) => updateDraft('publicUrl', event.target.value)} className="field-input" placeholder="site, portfólio ou agenda" />
            </Field>
          </div>
        </section>

        <section className="glass-panel rounded-lg p-4">
          <label className="flex items-start gap-3 text-sm font-bold text-slate-300">
            <input
              type="checkbox"
              checked={draft.isCollaborator}
              onChange={(event) => updateDraft('isCollaborator', event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block text-slate-100">Ofereço serviços para a rede</span>
              <span className="block text-xs font-semibold text-slate-500">Isso alimenta os cards de serviços oferecidos na rede pública.</span>
            </span>
          </label>
          {draft.isCollaborator ? (
            <div className="mt-3 grid gap-3">
              <Field label="Serviços oferecidos" required={draft.publicVisible} error={errors.offeredServices}>
                <input value={draft.offeredServices} onChange={(event) => updateDraft('offeredServices', event.target.value)} className={inputClass(errors.offeredServices)} placeholder="Ex: eletricista, designer, contabilidade" />
              </Field>
              <label className="flex items-start gap-3 text-sm font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={draft.useDifferentServiceAddress}
                  onChange={(event) => updateDraft('useDifferentServiceAddress', event.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-slate-100">Usar outro endereço para atendimento</span>
                  <span className="block text-xs font-semibold text-slate-500">Use quando o local do serviço for diferente do seu endereço pessoal.</span>
                </span>
              </label>
              {draft.useDifferentServiceAddress ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="CEP de atendimento" required error={errors.serviceCep}>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input value={draft.serviceCep} onChange={(event) => updateDraft('serviceCep', formatCep(event.target.value))} className={inputClass(errors.serviceCep)} inputMode="numeric" placeholder="00000-000" />
                      <button type="button" onClick={findServiceCep} className="h-11 shrink-0 rounded-lg bg-cyan-500 px-3 text-sm font-black text-slate-950">
                        Localizar
                      </button>
                    </div>
                    {cepStatus ? <span className="mt-1 block text-xs font-bold text-slate-500">{cepStatus}</span> : null}
                  </Field>
                  <Field label="Rua de atendimento">
                    <input value={draft.serviceAddressLine} onChange={(event) => updateDraft('serviceAddressLine', event.target.value)} className="field-input" placeholder="Rua" />
                  </Field>
                  <Field label="Número" required error={errors.serviceAddressNumber}>
                    <input value={draft.serviceAddressNumber} onChange={(event) => updateDraft('serviceAddressNumber', event.target.value)} className={inputClass(errors.serviceAddressNumber)} placeholder="Número" />
                  </Field>
                  <Field label="Complemento">
                    <input value={draft.serviceAddressComplement} onChange={(event) => updateDraft('serviceAddressComplement', event.target.value)} className="field-input" placeholder="Sala, loja, referência" />
                  </Field>
                  <Field label="Bairro">
                    <input value={draft.serviceNeighborhood} onChange={(event) => updateDraft('serviceNeighborhood', event.target.value)} className="field-input" placeholder="Bairro" />
                  </Field>
                  <Field label="Cidade de atendimento" required error={errors.serviceCity}>
                    <input value={draft.serviceCity} onChange={(event) => updateDraft('serviceCity', event.target.value)} className={inputClass(errors.serviceCity)} placeholder="Cidade" />
                  </Field>
                  <Field label="UF de atendimento" required error={errors.serviceState}>
                    <input value={draft.serviceState} onChange={(event) => updateDraft('serviceState', event.target.value.toUpperCase().slice(0, 2))} className={inputClass(errors.serviceState)} placeholder="UF" />
                  </Field>
                  <label className="glass-panel-soft flex items-start gap-3 rounded-lg p-3 text-sm font-bold text-slate-300 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={draft.serviceAddressVisible}
                      onChange={(event) => updateDraft('serviceAddressVisible', event.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-slate-100">Mostrar endereço de atendimento</span>
                      <span className="block text-xs font-semibold text-slate-500">Se desativado, outras pessoas veem apenas a região aproximada.</span>
                    </span>
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {status ? <p className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100">{status}</p> : null}

        <button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 text-sm font-black text-slate-950">
          <Check size={18} />
          Salvar perfil público
        </button>
      </form>
    </div>
  )
}

function SettingsAction({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <article className="glass-panel rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-cyan-300">
          <Icon size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-slate-100">{title}</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>
        </div>
      </div>
      <button type="button" onClick={() => onAction()} className="mt-4 h-10 w-full rounded-lg border border-slate-800 text-sm font-black text-slate-300">
        {actionLabel}
      </button>
    </article>
  )
}

function SettingsRow({ label, value, actionLabel, onAction, danger = false }) {
  return (
    <div className="flex flex-col gap-2 border-b border-slate-800 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-black text-slate-100">{label}</p>
        <p className="text-xs font-semibold text-slate-500">{value}</p>
      </div>
      <button type="button" onClick={() => onAction()} className={['h-9 rounded-lg px-3 text-sm font-black', danger ? 'border border-rose-900/60 text-rose-300' : 'border border-slate-800 text-slate-300'].join(' ')}>
        {actionLabel}
      </button>
    </div>
  )
}

function CategoryPage({ categoryId, contacts, publicProfiles, user, onNavigate, onDelete, onToast, onEdit, onOpenContact, onOpenGroup }) {
  const category = getCategory(categoryId)
  const title = category ? category.label : 'Tudo'
  const filteredContacts =
    categoryId === 'all'
      ? contacts
      : contacts.filter((contact) => (contact.category?.id ?? classifyService(contact.service).id) === categoryId)

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => onNavigate(ROUTES.AGENDA)} className="inline-flex items-center gap-2 text-sm font-black text-slate-500">
        <ArrowLeft size={16} />
        Voltar
      </button>
      <PageTitle eyebrow="Categoria" title={title} description={`${filteredContacts.length} contatos privados.`} />
      <CategoryButtons contacts={contacts} activeCategory={categoryId} onNavigate={onNavigate} />
      <ContactList contacts={filteredContacts} onDelete={onDelete} onToast={onToast} onEdit={onEdit} onOpen={onOpenContact} emptyLabel="Nenhum contato nessa categoria." />
    </div>
  )
}

function AddressOptionList({ options, onChoose }) {
  return (
    <div className="mt-2 grid gap-2">
      {options.map((option, index) => (
        <button
          key={`${option.address}-${option.cep}-${index}`}
          type="button"
          onClick={() => onChoose(option)}
        className="action-card rounded-lg p-3 text-left text-sm font-semibold text-slate-200"
        >
          <span className="block leading-5">{option.address}</span>
          <span className="mt-1 block text-xs font-black uppercase tracking-widest text-slate-500">
            {[option.city, option.state, option.cep].filter(Boolean).join(' - ') || 'Sem CEP público'}
          </span>
        </button>
      ))}
    </div>
  )
}

function NewContactPage({ form, updateForm, addContact, inferredCategory, onNavigate }) {
  const [showAddress, setShowAddress] = useState(Boolean(form.address))
  const [addressStatus, setAddressStatus] = useState('')
  const [addressOptions, setAddressOptions] = useState([])
  const [errors, setErrors] = useState({})

  async function findContactAddress() {
    setAddressStatus('Buscando endereço...')
    setAddressOptions([])
    try {
      const results = await lookupAddressText(form.address)
      setAddressOptions(results)
      setAddressStatus(results.length ? 'Escolha o endereço correto abaixo.' : 'Nenhum endereço encontrado.')
    } catch (error) {
      setAddressStatus(error.message)
    }
  }

  function chooseAddress(option) {
    updateForm({
      ...form,
      address: option.address,
      cep: option.cep,
      city: option.city || form.city,
      state: option.state,
    })
    setAddressOptions([])
    setAddressStatus(option.cep ? `Endereço selecionado. CEP: ${option.cep}` : 'Endereço selecionado, mas sem CEP público retornado.')
  }

  function submit(event) {
    const nextErrors = {
      name: form.name.trim() ? '' : 'Obrigatório.',
      phone: form.phone.trim() ? '' : 'Obrigatório.',
      service: form.service.trim() ? '' : 'Obrigatório.',
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) {
      event.preventDefault()
      return
    }
    addContact(event)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button type="button" onClick={() => onNavigate(ROUTES.AGENDA)} className="mb-4 inline-flex items-center gap-2 text-sm font-black text-slate-500">
        <ArrowLeft size={16} />
        Agenda
      </button>
      <PageTitle eyebrow="Novo contato" title="Salvar contato" description="Informe o serviço para a categoria ser definida automaticamente." />
      <form onSubmit={submit} noValidate className="glass-panel rounded-lg p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" required error={errors.name}>
            <input value={form.name} onChange={(event) => updateForm('name', event.target.value)} className={inputClass(errors.name)} placeholder="Nome do contato" />
          </Field>
          <Field label="Telefone" required error={errors.phone}>
            <input value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} className={inputClass(errors.phone)} placeholder="WhatsApp ou número" />
          </Field>
          <Field label="Serviço" required error={errors.service}>
            <input value={form.service} onChange={(event) => updateForm('service', event.target.value)} className={inputClass(errors.service)} placeholder="eletricista, jurídico..." />
          </Field>
          <Field label="Cidade">
            <input value={form.city} onChange={(event) => updateForm('city', event.target.value)} className="field-input" placeholder="São Paulo" />
          </Field>
        </div>

        <div className="glass-panel-soft mt-4 rounded-lg p-3">
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Inteligência do contato</p>
          <div className="grid gap-3">
            <Field label="Descrição">
              <textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} className="field-input min-h-20 resize-y" placeholder="Quem é, contexto, relação ou observações úteis." />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="O que demanda atualmente">
                <textarea value={form.demand} onChange={(event) => updateForm('demand', event.target.value)} className="field-input min-h-20 resize-y" placeholder="O que essa pessoa busca, precisa ou está tentando resolver." />
              </Field>
              <Field label="Problema que resolve">
                <textarea value={form.solves} onChange={(event) => updateForm('solves', event.target.value)} className="field-input min-h-20 resize-y" placeholder="Que tipo de problema, serviço ou oportunidade essa pessoa resolve." />
              </Field>
            </div>
            <Field label="Tags">
              <input value={form.tags} onChange={(event) => updateForm('tags', event.target.value)} className="field-input" placeholder="limpeza, evento, indicação, urgente" />
            </Field>
          </div>
        </div>

        <div className="glass-panel-soft mt-4 rounded-lg p-3">
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">CRM</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status">
              <select value={form.crm_status} onChange={(event) => updateForm('crm_status', event.target.value)} className="field-input">
                {crmStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
              </select>
            </Field>
            <Field label="Prioridade">
              <select value={form.crm_priority} onChange={(event) => updateForm('crm_priority', event.target.value)} className="field-input">
                {crmPriorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </Field>
            <Field label="Último contato">
              <input value={form.last_contact_at} onChange={(event) => updateForm('last_contact_at', event.target.value)} className="field-input" type="date" />
            </Field>
            <Field label="Próximo follow-up">
              <input value={followUpInputValue(form.next_follow_up_at)} onChange={(event) => updateForm('next_follow_up_at', event.target.value)} className="field-input" type="datetime-local" />
            </Field>
          </div>
          <Field label="Nota CRM" className="mt-3">
            <textarea value={form.crm_note} onChange={(event) => updateForm('crm_note', event.target.value)} className="field-input min-h-24 resize-y" placeholder="Contexto da conversa, oportunidade, demanda ou próximo passo." />
          </Field>
        </div>

        <div className="glass-panel-soft mt-4 rounded-lg p-3">
          <button
            type="button"
            onClick={() => setShowAddress((current) => !current)}
            className="flex w-full items-center justify-between gap-3 text-left text-sm font-black text-slate-200"
          >
            <span>Adicionar endereço opcional</span>
            <ChevronRight className={showAddress ? 'rotate-90 text-cyan-400 transition' : 'text-cyan-400 transition'} size={18} />
          </button>
          {showAddress ? (
            <div className="mt-3">
              <Field label="Endereço">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input value={form.address} onChange={(event) => updateForm('address', event.target.value)} className="field-input" placeholder="Rua, número, bairro ou referência" />
                  <button type="button" onClick={findContactAddress} className="h-11 shrink-0 rounded-lg bg-cyan-500 px-3 text-sm font-black text-slate-950">
                    Localizar
                  </button>
                </div>
                {addressStatus ? <span className="mt-1 block text-xs font-bold text-slate-500">{addressStatus}</span> : null}
                {addressOptions.length ? <AddressOptionList options={addressOptions} onChoose={chooseAddress} /> : null}
              </Field>
            </div>
          ) : null}
        </div>

        <div className="glass-panel-soft mt-4 flex items-center gap-3 rounded-lg p-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-cyan-300">
            <Sparkles size={20} />
          </span>
          <span>
            <span className="block text-sm font-black text-slate-100">{inferredCategory?.label ?? 'Categoria automática'}</span>
            <span className="text-sm font-medium text-slate-500">{inferredCategory?.group ?? 'Criada a partir do serviço informado'}</span>
          </span>
        </div>
        <button type="submit" className="primary-button mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-black">
          <Plus size={18} />
          Salvar contato
        </button>
      </form>
    </div>
  )
}

function contactToEditForm(contact) {
  return {
    id: contact.id,
    name: contact.name ?? '',
    phone: contact.phone ?? '',
    service: contact.service ?? '',
    note: contact.note ?? '',
    city: contact.city ?? '',
    address: contact.address ?? '',
    trust: contact.trust ?? 'Novo',
    source: contact.source ?? 'Manual',
    description: contact.description ?? '',
    demand: contact.demand ?? '',
    solves: contact.solves ?? '',
    tags: contact.tags ?? '',
    email: contact.email ?? '',
    whatsapp: contact.whatsapp ?? '',
    instagram: contact.instagram ?? '',
    linkedin: contact.linkedin ?? '',
    custom_url: contact.custom_url ?? '',
    custom_fields: contact.custom_fields ?? '[]',
    crm_status: contact.crm_status ?? 'Novo',
    crm_priority: contact.crm_priority ?? 'Média',
    last_contact_at: contact.last_contact_at ?? '',
    next_follow_up_at: contact.next_follow_up_at ?? '',
    crm_note: contact.crm_note ?? '',
  }
}

function CustomFieldsEditor({ value, onChange }) {
  const fields = parseCustomFields(value)

  function updateField(index, key, nextValue) {
    const next = fields.map((field, currentIndex) => (currentIndex === index ? { ...field, [key]: nextValue } : field))
    onChange(serializeCustomFields(next))
  }

  function addField() {
    onChange(serializeCustomFields([...fields, { label: '', value: '' }]))
  }

  function removeField(index) {
    onChange(serializeCustomFields(fields.filter((_, currentIndex) => currentIndex !== index)))
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Campos personalizados</p>
        <button type="button" onClick={addField} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-800 px-2 text-xs font-black text-cyan-300">
          <Plus size={14} />
          Campo
        </button>
      </div>
      <div className="grid gap-2">
        {fields.length ? fields.map((field, index) => (
          <div key={index} className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/35 p-2 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)_auto]">
            <input value={field.label ?? ''} onChange={(event) => updateField(index, 'label', event.target.value)} className="field-input h-10" placeholder="Nome do campo" />
            <input value={field.value ?? ''} onChange={(event) => updateField(index, 'value', event.target.value)} className="field-input h-10" placeholder="Valor" />
            <button type="button" onClick={() => removeField(index)} className="h-10 rounded-lg border border-rose-500/25 px-3 text-rose-200">
              <X size={15} />
            </button>
          </div>
        )) : <p className="rounded-lg border border-dashed border-slate-800 p-3 text-xs font-semibold text-slate-500">Nenhum campo personalizado ainda.</p>}
      </div>
    </div>
  )
}

function EditContactModal({ contact, onClose, onSave }) {
  const [draft, setDraft] = useState(() => contactToEditForm(contact))
  const [showAddress, setShowAddress] = useState(Boolean(contact.address))
  const [addressStatus, setAddressStatus] = useState('')
  const [addressOptions, setAddressOptions] = useState([])
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setDraft(contactToEditForm(contact))
    setShowAddress(Boolean(contact.address))
    setAddressStatus('')
    setAddressOptions([])
    setErrors({})
  }, [contact])

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  async function findAddress() {
    setAddressStatus('Buscando endereço...')
    setAddressOptions([])
    try {
      const results = await lookupAddressText(draft.address)
      setAddressOptions(results)
      setAddressStatus(results.length ? 'Escolha o endereço correto abaixo.' : 'Nenhum endereço encontrado.')
    } catch (error) {
      setAddressStatus(error.message)
    }
  }

  function chooseAddress(option) {
    setDraft((current) => ({ ...current, address: option.address, city: option.city || current.city, state: option.state, cep: option.cep }))
    setAddressOptions([])
    setAddressStatus(option.cep ? `Endereço selecionado. CEP: ${option.cep}` : 'Endereço selecionado, mas sem CEP público retornado.')
  }

  function submit(event) {
    event.preventDefault()
    const nextErrors = {
      name: draft.name.trim() ? '' : 'Obrigatório.',
      phone: draft.phone.trim() ? '' : 'Obrigatório.',
      service: draft.service.trim() ? '' : 'Obrigatório.',
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return
    onSave({
      ...draft,
      address: showAddress ? draft.address : '',
      city: draft.city || 'Minha região',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-3 sm:items-center">
      <form onSubmit={submit} className="glass-panel max-h-[92vh] w-full max-w-2xl overflow-auto rounded-lg p-4 shadow-2xl sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-cyan-400">Editar contato</p>
            <h2 className="mt-1 text-xl font-black text-slate-100">{contact.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-900 p-2 text-slate-400" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" required error={errors.name}>
            <input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} className={inputClass(errors.name)} />
          </Field>
          <Field label="Telefone" required error={errors.phone}>
            <input value={draft.phone} onChange={(event) => updateDraft('phone', event.target.value)} className={inputClass(errors.phone)} />
          </Field>
          <Field label="Serviço" required error={errors.service}>
            <input value={draft.service} onChange={(event) => updateDraft('service', event.target.value)} className={inputClass(errors.service)} />
          </Field>
          <Field label="Cidade">
            <input value={draft.city} onChange={(event) => updateDraft('city', event.target.value)} className="field-input" />
          </Field>
        </div>

        <div className="glass-panel-soft mt-4 rounded-lg p-3">
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Inteligência do contato</p>
          <div className="grid gap-3">
            <Field label="Descrição">
              <textarea value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} className="field-input min-h-20 resize-y" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="O que demanda atualmente">
                <textarea value={draft.demand} onChange={(event) => updateDraft('demand', event.target.value)} className="field-input min-h-20 resize-y" />
              </Field>
              <Field label="Problema que resolve">
                <textarea value={draft.solves} onChange={(event) => updateDraft('solves', event.target.value)} className="field-input min-h-20 resize-y" />
              </Field>
            </div>
            <Field label="Tags">
              <input value={draft.tags} onChange={(event) => updateDraft('tags', event.target.value)} className="field-input" placeholder="Tags separadas por vírgula" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email">
                <input value={draft.email} onChange={(event) => updateDraft('email', event.target.value)} className="field-input" />
              </Field>
              <Field label="WhatsApp">
                <input value={draft.whatsapp} onChange={(event) => updateDraft('whatsapp', event.target.value)} className="field-input" />
              </Field>
              <Field label="Instagram">
                <input value={draft.instagram} onChange={(event) => updateDraft('instagram', event.target.value)} className="field-input" />
              </Field>
              <Field label="LinkedIn">
                <input value={draft.linkedin} onChange={(event) => updateDraft('linkedin', event.target.value)} className="field-input" />
              </Field>
              <Field label="URL customizada">
                <input value={draft.custom_url} onChange={(event) => updateDraft('custom_url', event.target.value)} className="field-input" />
              </Field>
            </div>
            <CustomFieldsEditor value={draft.custom_fields} onChange={(value) => updateDraft('custom_fields', value)} />
          </div>
        </div>

        <div className="glass-panel-soft mt-4 rounded-lg p-3">
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">CRM</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status">
              <select value={draft.crm_status} onChange={(event) => updateDraft('crm_status', event.target.value)} className="field-input">
                {crmStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
              </select>
            </Field>
            <Field label="Prioridade">
              <select value={draft.crm_priority} onChange={(event) => updateDraft('crm_priority', event.target.value)} className="field-input">
                {crmPriorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </Field>
            <Field label="Último contato">
              <input value={draft.last_contact_at} onChange={(event) => updateDraft('last_contact_at', event.target.value)} className="field-input" type="date" />
            </Field>
            <Field label="Próximo follow-up">
              <input value={followUpInputValue(draft.next_follow_up_at)} onChange={(event) => updateDraft('next_follow_up_at', event.target.value)} className="field-input" type="datetime-local" />
            </Field>
          </div>
          <Field label="Nota CRM" className="mt-3">
            <textarea value={draft.crm_note} onChange={(event) => updateDraft('crm_note', event.target.value)} className="field-input min-h-24 resize-y" placeholder="Contexto da conversa, oportunidade, demanda ou próximo passo." />
          </Field>
        </div>

        <div className="glass-panel-soft mt-4 rounded-lg p-3">
          <button type="button" onClick={() => setShowAddress((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left text-sm font-black text-slate-200">
            <span>Endereço do contato</span>
            <ChevronRight className={showAddress ? 'rotate-90 text-cyan-400 transition' : 'text-cyan-400 transition'} size={18} />
          </button>
          {showAddress ? (
            <div className="mt-3">
              <Field label="Endereço">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input value={draft.address} onChange={(event) => updateDraft('address', event.target.value)} className="field-input" />
                  <button type="button" onClick={findAddress} className="h-11 shrink-0 rounded-lg bg-cyan-500 px-3 text-sm font-black text-slate-950">
                    Localizar
                  </button>
                </div>
                {addressStatus ? <span className="mt-1 block text-xs font-bold text-slate-500">{addressStatus}</span> : null}
                {addressOptions.length ? <AddressOptionList options={addressOptions} onChoose={chooseAddress} /> : null}
              </Field>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onClose} className="h-11 rounded-lg border border-slate-800 text-sm font-black text-slate-300">
            Cancelar
          </button>
          <button type="submit" className="h-11 rounded-lg bg-cyan-500 text-sm font-black text-slate-950">
            Salvar alterações
          </button>
        </div>
      </form>
    </div>
  )
}

function inputClass(error) {
  return `field-input ${error ? 'field-input-error' : ''}`
}

function Field({ label, className = '', required = false, error = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className={`mb-1 block text-xs font-black uppercase tracking-widest ${error ? 'text-rose-300' : 'text-slate-500'}`}>
        {label}{required ? ' *' : ''}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs font-bold text-rose-300">{error}</span> : null}
    </label>
  )
}

function GroupsPage({ publicProfiles, user, queryDraft, setQueryDraft, onSearch, recents, contacts, onOpenGroup, onNavigate }) {
  const groups = getRecommendedGroups(publicProfiles.filter((profile) => (profile.kind ?? 'group') !== 'person'), user, queryDraft)
  const publicPeopleCount = publicProfiles.filter((profile) => (profile.kind ?? 'group') === 'person').length

  return (
    <div className="space-y-4">
      <PageTitle eyebrow="Grupos" title="Sugestões por interesse" description="Os grupos são priorizados pelos interesses salvos no cadastro e pela busca atual." />
      <button type="button" onClick={() => onNavigate(ROUTES.PUBLIC)} className="glass-panel flex w-full items-center justify-between gap-3 rounded-lg p-4 text-left hover:border-cyan-400/60">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-cyan-300">
            <Compass size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black text-cyan-100">Rede pública</span>
            <span className="mt-1 block text-xs font-semibold text-cyan-200/70">{publicPeopleCount} {publicPeopleCount === 1 ? 'perfil visível' : 'perfis visíveis'} e cards públicos da plataforma.</span>
          </span>
        </span>
        <ArrowRight size={18} className="shrink-0 text-cyan-200" />
      </button>
      <SearchBox value={queryDraft} onChange={setQueryDraft} onSearch={onSearch} recents={recents} contacts={contacts} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((profile) => (
          <PublicGroupCard key={profile.id} profile={profile} onOpen={onOpenGroup} />
        ))}
      </div>
    </div>
  )
}

function PublicGroupCard({ profile, onOpen }) {
  const category = profile.category ?? classifyService(profile.service)
  const serviceTags = tagList(profile.service)
  const title = String(profile.name ?? '').replace(/^Grupo de\s+/i, 'Serviço: ')

  return (
    <article className="glass-panel rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: category.color }}>
          <UsersRound size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-black leading-5 text-slate-100">{title}</h3>
          <p className="mt-1 text-xs font-black uppercase tracking-widest text-cyan-400">{category.label}</p>
        </div>
      </div>
      {serviceTags.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {serviceTags.slice(0, 6).map((tag) => <span key={tag} className="rounded-md border border-cyan-400/10 bg-cyan-400/10 px-2 py-1 text-[11px] font-black text-cyan-100">{tag}</span>)}
        </div>
      ) : null}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Metric value={profile.people} label="rede" />
        <Metric value={profile.response} label="resposta" />
        <Metric value={profile.score} label="score" />
      </div>
      <button type="button" onClick={() => onOpen(profile)} className="secondary-button mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-black">
        Verificar
        <ArrowRight size={16} />
      </button>
    </article>
  )
}

function Metric({ value, label }) {
  return (
    <div className="glass-panel-soft rounded-lg px-2 py-2">
      <p className="text-sm font-black text-slate-100">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    </div>
  )
}

function MapPage({ contacts, users, user, onNavigate }) {
  const profilePoints = useMemo(() => {
    const currentPhone = onlyDigits(user?.phone)
    const currentEmail = normalize(user?.email)
    return users
      .filter((profile) => normalize(profile.email) !== currentEmail && onlyDigits(profile.phone) !== currentPhone)
      .map((profile) => ({
        id: `profile-${profile.id ?? profile.email}`,
        name: profile.name,
        phone: profile.phone,
        service: profile.isCollaborator ? profile.offeredServices || 'Perfil colaborador' : 'Perfil cadastrado',
        city: profile.city,
        address: profile.isCollaborator && profile.serviceAddress ? profile.serviceAddress : profile.address,
        category: profile.isCollaborator ? categoryDetails(null, profile.offeredServices) : generalCategory,
        source: 'Perfil cadastrado',
        networkType: 'profile',
      }))
  }, [users, user?.email, user?.phone])

  const mapItems = useMemo(
    () => [
      ...profilePoints,
      ...contacts.map((contact) => ({
        ...contact,
        id: `contact-${contact.id}`,
        networkType: 'contact',
      })),
    ],
    [contacts, profilePoints],
  )

  if (!hasGoogleConnection(user)) {
    return (
      <GoogleRequiredPanel
        title="Mapa bloqueado"
        description="O mapa depende da conta Google para manter origem, localização e dados conectados consistentes."
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <div className="space-y-4">
      <PageTitle
        eyebrow="Network.map"
        title="Grafo de proximidade"
        description="Encontre contatos próximos por serviço, veja conexões da rede e abra a localização da pessoa selecionada no Google Maps."
        action={
          <button type="button" onClick={() => onNavigate(ROUTES.REGISTER)} className="secondary-button inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black">
            <MapPin size={17} />
            Endereço
          </button>
        }
      />
      <NetworkGraphMap user={user} contacts={mapItems} />
    </div>
  )
}

function NetworkGraphMap({ user, contacts }) {
  const [serviceQuery, setServiceQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [graphReady, setGraphReady] = useState(true)
  const [geocodedLocations, setGeocodedLocations] = useState({})
  const centerAddress = user?.address || defaultUser.address
  const baseOriginLocation = useMemo(() => resolveMapLocation(user, centerAddress), [centerAddress, user])
  const originLocation = useMemo(() => withGeocodedLocation(baseOriginLocation, geocodedLocations), [baseOriginLocation, geocodedLocations])

  const addressQueries = useMemo(() => {
    const queries = new Set()
    if (baseOriginLocation.source.startsWith('address')) queries.add(baseOriginLocation.query)
    contacts.forEach((contact) => {
      const location = resolveMapLocation(contact, contact.address || contact.city || '')
      if (location.source.startsWith('address')) queries.add(location.query)
    })
    return [...queries].filter((query) => isUsableMapAddress(query)).slice(0, 40)
  }, [baseOriginLocation, contacts])

  useEffect(() => {
    let cancelled = false
    const missing = addressQueries.filter((query) => !(geocodeKey(query) in geocodedLocations)).slice(0, 12)
    if (!missing.length) return undefined

    async function loadGeocodes() {
      const next = {}
      for (const query of missing) {
        try {
          next[geocodeKey(query)] = await geocodeAddressQuery(query)
        } catch {
          next[geocodeKey(query)] = null
        }
        if (cancelled) return
      }
      setGeocodedLocations((current) => ({ ...current, ...next }))
    }

    loadGeocodes()
    return () => {
      cancelled = true
    }
  }, [addressQueries, geocodedLocations])

  const enrichedItems = useMemo(
    () =>
      contacts
        .map((contact) => {
          const category = contact.category ?? classifyService(contact.service)
          const baseContact = { ...contact, category }
          if (!hasGraphTag(baseContact)) return null
          const rawAddress = contact.address || contact.city || ''
          const location = withGeocodedLocation(resolveMapLocation(contact, rawAddress), geocodedLocations)
          const distanceKm = originLocation.coords && location.coords ? distanceBetweenCoordinates(originLocation.coords, location.coords) : null
          const usesDdd = originLocation.source.includes('ddd') || location.source.includes('ddd')
          return {
            ...contact,
            category,
            address: rawAddress || location.query,
            locationLabel: location.label,
            locationQuery: location.query,
            locationSource: location.source,
            locationSourceLabel: location.sourceLabel,
            ddd: extractDdd(contact.phone),
            distanceKm,
            distanceLabel: formatDistanceKm(distanceKm),
            distanceSourceLabel: distanceKm === null ? 'sem DDD/localização' : usesDdd ? 'por DDD' : location.source.startsWith('address') ? 'por endereço' : 'estimada',
          }
        })
        .filter((contact) => contact?.name && contact.locationQuery),
    [contacts, geocodedLocations, originLocation],
  )

  const serviceOptions = useMemo(() => {
    const options = []
    for (const item of enrichedItems) {
      const label = item.category?.label || classifyService(item.service).label
      if (!options.some((option) => normalize(option) === normalize(label))) options.push(label)
      if (options.length >= 7) break
    }
    return options
  }, [enrichedItems])

  const nearbyItems = useMemo(() => {
    const query = serviceQuery.trim()
    return enrichedItems
      .filter((contact) => !query || matchText(query, [contact.name, contact.service, contact.category?.label, contact.category?.group, contact.city, contact.address, contact.ddd, contact.locationLabel]))
      .sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999))
  }, [enrichedItems, serviceQuery])

  useEffect(() => {
    if (!nearbyItems.length) {
      setSelectedId('')
      return
    }
    if (!nearbyItems.some((item) => item.id === selectedId)) {
      setSelectedId(nearbyItems[0].id)
    }
  }, [nearbyItems, selectedId])

  const selectedContact = nearbyItems.find((item) => item.id === selectedId) ?? nearbyItems[0] ?? null
  const graphCategories = useMemo(() => {
    const categories = new globalThis.Map()
    nearbyItems.forEach((item) => {
      const key = item.category?.id ?? item.category?.label ?? 'general'
      const current = categories.get(key) ?? { label: item.category?.label ?? 'Geral', color: item.category?.color ?? generalCategory.color, count: 0 }
      current.count += 1
      categories.set(key, current)
    })
    return [...categories.values()].sort((a, b) => b.count - a.count).slice(0, 5)
  }, [nearbyItems])
  const graphSummary = {
    nodes: nearbyItems.length,
    categories: graphCategories.length,
    ddds: new Set(nearbyItems.map((item) => item.ddd).filter(Boolean)).size,
    located: nearbyItems.filter((item) => item.distanceKm !== null).length,
  }

  return (
    <div className="space-y-4">
      <section className="glass-panel rounded-lg p-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end">
          <Field label="Localizar por serviço ou DDD">
            <div className="glass-panel-soft flex min-w-0 items-center gap-2 rounded-lg px-3 focus-within:border-cyan-500">
              <Search size={18} className="shrink-0 text-slate-500" />
              <input
                value={serviceQuery}
                onChange={(event) => setServiceQuery(event.target.value)}
                className="h-11 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-600"
                placeholder="Ex: pedreiro, advogado, limpeza ou DDD 21"
              />
              {serviceQuery ? (
                <button type="button" onClick={() => setServiceQuery('')} className="rounded-md p-1 text-slate-500" aria-label="Limpar filtro">
                  <X size={16} />
                </button>
              ) : null}
            </div>
          </Field>
          <div className="glass-panel-soft rounded-lg px-3 py-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Origem</p>
            <p className="mt-1 truncate text-sm font-black text-slate-100">{user?.name ?? 'Você'}</p>
            <p className="truncate text-xs font-semibold text-slate-500">{originLocation.label}</p>
          </div>
        </div>
        {serviceOptions.length ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setServiceQuery('')}
              className={['h-9 shrink-0 rounded-lg px-3 text-xs font-black', serviceQuery ? 'secondary-button' : 'primary-button'].join(' ')}
            >
              Todos
            </button>
            {serviceOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setServiceQuery(option)}
                className={['h-9 shrink-0 rounded-lg px-3 text-xs font-black', normalize(serviceQuery) === normalize(option) ? 'primary-button' : 'secondary-button'].join(' ')}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.9fr)]">
        <section className="glass-panel overflow-hidden rounded-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <div>
              <p className="text-sm font-black text-slate-100">Grafo de contatos próximos</p>
              <p className="text-xs font-semibold text-slate-500">Todos os {nearbyItems.length} contato{nearbyItems.length === 1 ? '' : 's'} do filtro atual</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg bg-slate-950 px-2.5 py-1 text-xs font-black text-cyan-300">{serviceQuery || 'rede completa'}</span>
              <span className="rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-xs font-black text-slate-400">{graphSummary.categories} categorias</span>
              <span className="rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-xs font-black text-slate-400">{graphSummary.ddds} DDDs</span>
            </div>
          </div>
          {graphReady ? (
            <NetworkGraph items={nearbyItems} selectedId={selectedContact?.id} onSelect={setSelectedId} centerLabel={user?.name ?? 'Você'} />
          ) : (
            <MapGraphPreview summary={graphSummary} categories={graphCategories} selectedContact={selectedContact} onLoad={() => setGraphReady(true)} />
          )}
        </section>

        <aside className="space-y-4">
          <SelectedMapCard contact={selectedContact} centerAddress={originLocation.query} />
          <div className="glass-panel rounded-lg">
            <div className="border-b border-slate-800 px-4 py-3">
              <p className="text-sm font-black text-slate-100">Mais próximos</p>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {nearbyItems.length ? (
                nearbyItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={[
                      'flex w-full items-start gap-3 border-b border-slate-800 px-4 py-3 text-left last:border-b-0',
                      selectedContact?.id === item.id ? 'bg-cyan-500/10' : 'hover:bg-slate-950/40',
                    ].join(' ')}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white" style={{ backgroundColor: item.category?.color ?? generalCategory.color }}>
                      {initials(item.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-slate-100">{item.name}</span>
                      <span className="block truncate text-xs font-semibold text-slate-500">{item.service}</span>
                      <span className="mt-1 inline-flex items-center gap-1 text-xs font-black text-cyan-300">
                        <Route size={14} />
                        {item.distanceLabel} {item.distanceSourceLabel}
                      </span>
                      <span className="mt-1 block truncate text-[11px] font-bold text-slate-500">{item.locationSourceLabel} · {item.locationLabel}</span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="p-4 text-sm font-semibold text-slate-500">Nenhum contato encontrado para esse serviço.</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      <GoogleLocationMap user={user} centerAddress={originLocation.query} contacts={nearbyItems.slice(0, 10)} selectedContact={selectedContact} onSelect={setSelectedId} />
    </div>
  )
}

function MapGraphPreview({ summary, categories, selectedContact, onLoad }) {
  const previewNodes = [
    { className: 'is-origin', label: 'Você' },
    { className: 'is-crm', label: categories[0]?.label ?? 'Agenda' },
    { className: 'is-near', label: selectedContact?.distanceLabel ?? 'perto' },
    { className: 'is-category', label: categories[1]?.label ?? 'categoria' },
    { className: 'is-ddd', label: `${summary.ddds || 0} DDDs` },
    { className: 'is-public', label: 'rede' },
  ]

  return (
    <div className="map-graph-preview p-4 sm:p-5">
      <div className="relative z-10 grid min-h-[430px] gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="map-graph-preview-stage rounded-xl">
          <span className="map-preview-line line-a" />
          <span className="map-preview-line line-b" />
          <span className="map-preview-line line-c" />
          <span className="map-preview-line line-d" />
          <span className="map-preview-line line-e" />
          {previewNodes.map((node) => (
            <span key={node.className} className={`map-preview-node ${node.className}`}>
              <span />
              <b>{node.label}</b>
            </span>
          ))}
          <div className="map-preview-card left-3 top-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Leitura</p>
            <p className="mt-1 text-sm font-black text-cyan-100">{summary.nodes} nós filtrados</p>
          </div>
          <div className="map-preview-card bottom-3 right-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Selecionado</p>
            <p className="mt-1 max-w-40 truncate text-sm font-black text-slate-100">{selectedContact?.name ?? 'nenhum contato'}</p>
            <p className="mt-0.5 text-xs font-semibold text-emerald-200">{selectedContact?.distanceLabel ?? 'sem distância'}</p>
          </div>
        </div>

        <aside className="flex min-h-full flex-col justify-between gap-3">
          <div>
            <div className="brand-mark flex h-11 w-11 items-center justify-center rounded-xl">
              <Map size={21} />
            </div>
            <h3 className="mt-4 text-xl font-black text-slate-100">Grafo 3D pronto para navegar</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              A prévia já mostra densidade, categorias e proximidade. Carregue o 3D para arrastar, aproximar e selecionar nós.
            </p>
          </div>

          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <Metric value={summary.located} label="localizados" />
              <Metric value={summary.categories} label="categorias" />
            </div>
            {categories.length ? (
              <div className="map-graph-legend rounded-lg p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Categorias fortes</p>
                <div className="mt-2 grid gap-1.5">
                  {categories.slice(0, 4).map((category) => (
                    <span key={category.label} className="flex items-center justify-between gap-2 text-xs font-black text-slate-300">
                      <span className="flex min-w-0 items-center gap-2">
                        <i style={{ backgroundColor: category.color }} />
                        <span className="truncate">{category.label}</span>
                      </span>
                      <span className="text-slate-500">{category.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <button type="button" onClick={onLoad} className="primary-button inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black">
              <Sparkles size={17} />
              Carregar grafo 3D
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

function NetworkGraph({ items, contacts = CONTACTS_SEED, query = '', selectedId, onSelect }) {
  const cvRef = useRef(null)
  const rafRef = useRef(null)
  const nodesRef = useRef([])
  const camRef = useRef({ theta: 0.3, phi: 0.28, dist: 500 })
  const stateRef = useRef({ autoRot: true, dragging: false, lmx: 0, lmy: 0, tick: 0, hov: null, filter: 'all', pinch: 0, startDist: 500 })

  const [hovData, setHovData] = useState(null)
  const [infoText, setInfoText] = useState('arraste para orbitar 360° · scroll para zoom · hover para detalhes')
  const [autoRot, setAutoRot] = useState(true)
  const [filter, setFilter] = useState('all')

  const graphContacts = useMemo(() => {
    const source = Array.isArray(items) && items.length ? items : contacts
    return (source?.length ? source : CONTACTS_SEED).map((contact, index) => {
      const categoryId = graphCatId(contact)
      return {
        id: String(contact.id ?? `c${index + 1}`),
        name: contact.name ?? 'Contato',
        svc: contact.svc ?? contact.service ?? contact.category?.label ?? 'serviço',
        city: contact.city ?? contact.locationLabel ?? 'Rede',
        trust: contact.trust ?? (index % 3 === 0 ? 'Recomendado' : index % 3 === 1 ? 'Favorito' : 'Confiavel'),
        src: contact.src ?? contact.source ?? 'Agenda',
        note: contact.note ?? contact.crm_note ?? contact.distanceLabel ?? '',
        cat: categoryId,
        originalId: contact.id,
      }
    })
  }, [contacts, items])

  useEffect(() => {
    const canvas = cvRef.current
    if (!canvas) return undefined

    let { W, H, DPR } = resizeGraphCanvas(canvas)
    let graph = buildCanvasGraph(graphContacts, query, W, H)
    let nodes = graph.nodes
    let edges = graph.edges
    const ctx = canvas.getContext('2d')

    function rebuild() {
      ;({ nodes, edges } = buildCanvasGraph(graphContacts, query, W, H))
      applyGraphFilter(stateRef.current.filter, nodes)
    }
    rebuild()

    function updateHover(mx, my) {
      const hit = hitCanvasGraph(mx, my, nodesRef.current)
      stateRef.current.hov = hit?.id ?? null
      canvas.style.cursor = hit ? 'pointer' : stateRef.current.dragging ? 'grabbing' : 'grab'
      if (hit) {
        setHovData(hit)
        setInfoText(`${hit.name}${hit.svc ? ` · ${hit.svc}` : ''}${hit.city ? ` · ${hit.city}` : ''}`)
      } else {
        setHovData(null)
        setInfoText('arraste para orbitar 360° · scroll para zoom · hover para detalhes')
      }
    }

    function canvasPoint(event) {
      const rect = canvas.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    function onMouseDown(event) {
      const point = canvasPoint(event)
      stateRef.current.dragging = true
      stateRef.current.lmx = point.x
      stateRef.current.lmy = point.y
      canvas.style.cursor = 'grabbing'
    }

    function onMouseMove(event) {
      const point = canvasPoint(event)
      const state = stateRef.current
      if (state.dragging) {
        const cam = camRef.current
        cam.theta += (point.x - state.lmx) * 0.007
        cam.phi += (point.y - state.lmy) * 0.007
        state.lmx = point.x
        state.lmy = point.y
        return
      }
      updateHover(point.x, point.y)
    }

    function onMouseUp(event) {
      const point = canvasPoint(event)
      stateRef.current.dragging = false
      canvas.style.cursor = 'grab'
      const hit = hitCanvasGraph(point.x, point.y, nodesRef.current)
      if (hit?.kind === 'contact' && onSelect) onSelect(hit.originalId ?? hit.id)
    }

    function onMouseLeave() {
      stateRef.current.dragging = false
      stateRef.current.hov = null
      setHovData(null)
      canvas.style.cursor = 'grab'
    }

    function onWheel(event) {
      event.preventDefault()
      camRef.current.dist = clampGraph(camRef.current.dist + event.deltaY * 0.6, 200, 800)
    }

    function touchDistance(touches) {
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      return Math.hypot(dx, dy)
    }

    function onTouchStart(event) {
      const state = stateRef.current
      if (event.touches.length === 1) {
        const rect = canvas.getBoundingClientRect()
        state.dragging = true
        state.lmx = event.touches[0].clientX - rect.left
        state.lmy = event.touches[0].clientY - rect.top
      } else if (event.touches.length === 2) {
        state.dragging = false
        state.pinch = touchDistance(event.touches)
        state.startDist = camRef.current.dist
      }
    }

    function onTouchMove(event) {
      event.preventDefault()
      const state = stateRef.current
      if (event.touches.length === 1 && state.dragging) {
        const rect = canvas.getBoundingClientRect()
        const x = event.touches[0].clientX - rect.left
        const y = event.touches[0].clientY - rect.top
        camRef.current.theta += (x - state.lmx) * 0.007
        camRef.current.phi += (y - state.lmy) * 0.007
        state.lmx = x
        state.lmy = y
      } else if (event.touches.length === 2 && state.pinch) {
        const nextDistance = touchDistance(event.touches)
        camRef.current.dist = clampGraph(state.startDist - (nextDistance - state.pinch) * 1.2, 200, 800)
      }
    }

    function onTouchEnd() {
      stateRef.current.dragging = false
      stateRef.current.pinch = 0
    }

    function loop() {
      const state = stateRef.current
      const cam = camRef.current
      if (state.autoRot && !state.dragging) cam.theta += 0.003
      renderCanvasGraph(ctx, W, H, DPR, nodes, edges, cam, state, nodesRef)
      state.tick += 1
      rafRef.current = requestAnimationFrame(loop)
    }

    function onResize() {
      ;({ W, H, DPR } = resizeGraphCanvas(canvas))
      rebuild()
    }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('mouseleave', onMouseLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)
    window.addEventListener('resize', onResize)
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [graphContacts, onSelect, query])

  function toggleAutoRot() {
    const next = !stateRef.current.autoRot
    stateRef.current.autoRot = next
    setAutoRot(next)
  }

  function resetCam() {
    camRef.current = { theta: 0.3, phi: 0.28, dist: 500 }
  }

  function changeFilter(nextFilter) {
    stateRef.current.filter = nextFilter
    setFilter(nextFilter)
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-cyan-900/40 bg-[#030810]">
      <div className="flex items-center gap-2 border-b border-cyan-900/30 px-4 py-2.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
        <span className="font-mono text-[10px] font-bold tracking-widest text-cyan-400">NETWORK · GRAFO 3D</span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={toggleAutoRot} className={`rounded border px-2 py-1 font-mono text-[9px] font-bold ${autoRot ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-200' : 'border-slate-700 text-slate-500'}`}>? rotacionar</button>
          <button type="button" onClick={resetCam} className="rounded border border-slate-700 px-2 py-1 font-mono text-[9px] font-bold text-slate-400 hover:border-cyan-400/50 hover:text-cyan-200">reset view</button>
        </div>
      </div>

      <canvas ref={cvRef} className="block w-full cursor-grab active:cursor-grabbing" />

      {hovData ? (
        <div className="pointer-events-none absolute right-4 top-14 max-w-[240px] rounded-lg border border-cyan-400/20 bg-[#030810]/90 px-3 py-2 shadow-2xl shadow-black/30">
          <p className="truncate font-mono text-xs font-black text-cyan-100">{hovData.name}</p>
          <p className="mt-1 line-clamp-2 font-mono text-[10px] font-bold text-slate-400">{hovData.svc || hovData.label}</p>
          <p className="mt-1 font-mono text-[10px] font-bold text-slate-600">{hovData.city || hovData.kind}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5 border-t border-cyan-900/30 bg-[#040c18] px-4 py-2">
        {['all', 'home', 'legal', 'business', 'tech', 'groups'].map((nextFilter) => (
          <button
            key={nextFilter}
            type="button"
            onClick={() => changeFilter(nextFilter)}
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-bold ${filter === nextFilter ? 'border-cyan-400 bg-cyan-400/15 text-cyan-100' : 'border-cyan-900/40 text-slate-500 hover:border-cyan-400/40 hover:text-cyan-200'}`}
          >
            {nextFilter}
          </button>
        ))}
      </div>

      <div className="border-t border-cyan-900/30 bg-[#040c18] px-4 py-2 font-mono text-[10px] text-slate-600">{infoText}</div>
    </div>
  )
}

function graphCatId(contact) {
  const raw = contact?.cat ?? contact?.category?.id ?? contact?.category
  const text = normalize([raw, contact?.svc, contact?.service, contact?.category?.label].filter(Boolean).join(' '))
  if (text.includes('legal') || text.includes('jurid') || text.includes('advog')) return 'legal'
  if (text.includes('tech') || text.includes('design') || text.includes('site') || text.includes('software')) return 'tech'
  if (text.includes('business') || text.includes('negocio') || text.includes('financ') || text.includes('contador') || text.includes('mei')) return 'business'
  return 'home'
}

function clampGraph(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function hexA(hex, alpha) {
  const h = hex.slice(0, 7)
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`
}

function resizeGraphCanvas(canvas) {
  const DPR = Math.min(window.devicePixelRatio || 1, 2)
  const W = Math.max(320, canvas.parentElement?.offsetWidth ?? 720)
  const H = Math.round(W * 0.58)
  canvas.style.width = `${W}px`
  canvas.style.height = `${H}px`
  canvas.width = W * DPR
  canvas.height = H * DPR
  return { W, H, DPR }
}

function projectGraphPoint(x, y, z, cam, W, H) {
  const { theta, phi, dist } = cam
  const ct = Math.cos(theta)
  const st = Math.sin(theta)
  const x1 = x * ct - y * st
  const y1 = x * st + y * ct
  const cp = Math.cos(phi)
  const sp = Math.sin(phi)
  const y2 = y1 * cp - z * sp
  const z2 = y1 * sp + z * cp
  const f = dist / (dist + z2 + 1)
  return { sx: W / 2 + x1 * f, sy: H / 2 + y2 * f, sc: f, zd: z2 }
}

function drawGraphLabel(ctx, text, x, y, fontSize, color, bgAlpha) {
  ctx.font = `bold ${fontSize}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const tw = ctx.measureText(text).width
  const p = 3
  ctx.fillStyle = `rgba(3,8,16,${bgAlpha})`
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x - tw / 2 - p, y - fontSize / 2 - p, tw + p * 2, fontSize + p * 2, 3)
  else ctx.rect(x - tw / 2 - p, y - fontSize / 2 - p, tw + p * 2, fontSize + p * 2)
  ctx.fill()
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
}

function buildCanvasGraph(contacts, query, W, H) {
  const q = normalize(query)
  const filteredContacts = contacts
    .filter((contact) => !q || matchText(q, [contact.name, contact.svc, contact.city, contact.trust, contact.src, contact.note, contact.cat]))
    .slice(0, 48)
  const nodes = [{ id: 'you', name: 'YOU', label: 'YOU', x: 0, y: 0, z: 0, r: 22, col: '#06b6d4', kind: 'hub', catId: 'hub', alpha: 1 }]
  const edges = []

  CATS.forEach((cat, index) => {
    const angle = (Math.PI * 2 * index) / CATS.length
    nodes.push({
      id: `cat-${cat.id}`,
      name: cat.label,
      label: cat.label,
      x: Math.cos(angle) * 150,
      y: Math.sin(angle) * 150,
      z: 0,
      r: 14,
      col: cat.col,
      kind: 'cat',
      catId: cat.id,
      alpha: 1,
    })
    edges.push({ a: 'you', b: `cat-${cat.id}`, k: 'hub', catId: cat.id })
  })

  filteredContacts.forEach((contact, index) => {
    const ci = Math.max(0, CATS.findIndex((cat) => cat.id === contact.cat))
    const base = (Math.PI * 2 * ci) / CATS.length
    const spread = 0.35 * (index % 2 === 0 ? 1 : -1) + Math.floor(index / CATS.length) * 0.09
    const angle = base + spread
    const id = `contact-${contact.id}`
    nodes.push({
      ...contact,
      id,
      originalId: contact.originalId ?? contact.id,
      x: Math.cos(angle) * 265,
      y: Math.sin(angle) * 265,
      z: ((index % 3) - 1) * 45,
      r: 13,
      col: catCol(contact.cat),
      kind: 'contact',
      catId: contact.cat,
      alpha: 1,
    })
    edges.push({ a: `cat-${contact.cat}`, b: id, k: 'contact', catId: contact.cat })
  })

  filteredContacts.forEach((contact, index) => {
    filteredContacts.slice(index + 1).forEach((other) => {
      if (normalize(contact.city) && normalize(contact.city) === normalize(other.city)) {
        edges.push({ a: `contact-${contact.id}`, b: `contact-${other.id}`, k: 'city' })
      }
    })
  })

  GROUPS_SEED.forEach((group, index) => {
    const ci = Math.max(0, CATS.findIndex((cat) => cat.id === group.cat))
    const base = (Math.PI * 2 * ci) / CATS.length
    const angle = base + (index % 2 === 0 ? 0.5 : -0.5)
    const id = `group-${group.id}`
    nodes.push({
      ...group,
      id,
      originalId: group.id,
      x: Math.cos(angle) * 370,
      y: Math.sin(angle) * 370,
      z: (index % 2 === 0 ? 1 : -1) * 30,
      r: 11,
      col: catCol(group.cat),
      kind: 'group',
      catId: group.cat,
      dashed: true,
      alpha: 1,
    })
    edges.push({ a: `cat-${group.cat}`, b: id, k: 'group', catId: group.cat })
  })

  applyGraphFilter('all', nodes)
  return { nodes, edges, W, H }
}

function applyGraphFilter(filter, nodes) {
  nodes.forEach((node) => {
    if (node.kind === 'hub') {
      node.alpha = 1
      return
    }
    if (filter === 'all') {
      node.alpha = 1
      return
    }
    if (filter === 'groups') {
      node.alpha = node.kind === 'group' ? 1 : node.kind === 'cat' ? 0.4 : 0.1
      return
    }
    node.alpha = node.catId === filter ? 1 : node.kind === 'cat' ? 0.3 : 0.07
  })
}

function hitCanvasGraph(mx, my, pnodes) {
  return [...pnodes].reverse().find((node) => {
    const dx = node.sx - mx
    const dy = node.sy - my
    return dx * dx + dy * dy < (node.r * node.sc * 1.5) ** 2
  }) ?? null
}

function renderCanvasGraph(ctx, W, H, DPR, nodes, edges, cam, state, nodesRef) {
  applyGraphFilter(state.filter, nodes)
  ctx.save()
  ctx.scale(DPR, DPR)
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#030810'
  ctx.fillRect(0, 0, W, H)

  for (let gx = -400; gx <= 400; gx += 45) {
    for (let gy = -400; gy <= 400; gy += 45) {
      const p = projectGraphPoint(gx, gy, -90, cam, W, H)
      ctx.beginPath()
      ctx.fillStyle = 'rgba(6,182,212,0.045)'
      ctx.arc(p.sx, p.sy, 0.9, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.strokeStyle = 'rgba(6,182,212,0.04)'
  ctx.lineWidth = 0.5
  for (let g = -400; g <= 400; g += 45) {
    const a = projectGraphPoint(-400, g, -90, cam, W, H)
    const b = projectGraphPoint(400, g, -90, cam, W, H)
    const c = projectGraphPoint(g, -400, -90, cam, W, H)
    const d = projectGraphPoint(g, 400, -90, cam, W, H)
    ctx.beginPath()
    ctx.moveTo(a.sx, a.sy)
    ctx.lineTo(b.sx, b.sy)
    ctx.moveTo(c.sx, c.sy)
    ctx.lineTo(d.sx, d.sy)
    ctx.stroke()
  }

  const projectedById = new globalThis.Map()
  const pnodes = nodes.map((node) => {
    const p = projectGraphPoint(node.x, node.y, node.z, cam, W, H)
    const projected = { ...node, ...p }
    projectedById.set(node.id, projected)
    return projected
  })
  pnodes.sort((a, b) => a.zd - b.zd)

  edges.forEach((edge, edgeIndex) => {
    const a = projectedById.get(edge.a)
    const b = projectedById.get(edge.b)
    if (!a || !b) return
    const al = Math.min(a.alpha ?? 1, b.alpha ?? 1)
    if (al <= 0.04) return
    const sc = Math.max(0.45, (a.sc + b.sc) / 2)
    const color = edge.k === 'contact' ? catCol(edge.catId) : edge.k === 'city' ? '#fbbf24' : edge.k === 'group' ? '#94a3b8' : '#06b6d4'
    const opacity = edge.k === 'hub' ? 0.3 * al : edge.k === 'contact' ? 0.2 * al : edge.k === 'city' ? 0.25 * al : 0.12 * al
    ctx.setLineDash(edge.k === 'group' ? [6, 9] : edge.k === 'city' ? [2, 5] : [])
    ctx.strokeStyle = hexA(color, opacity)
    ctx.lineWidth = (edge.k === 'hub' ? 1.2 : edge.k === 'contact' ? 0.9 : edge.k === 'city' ? 0.8 : 0.7) * sc
    ctx.beginPath()
    ctx.moveTo(a.sx, a.sy)
    ctx.lineTo(b.sx, b.sy)
    ctx.stroke()
    ctx.setLineDash([])

    if (edge.k === 'hub' || edge.k === 'contact') {
      const t = (state.tick / 90 + edgeIndex * 0.17) % 1
      const x = a.sx + (b.sx - a.sx) * t
      const y = a.sy + (b.sy - a.sy) * t
      ctx.beginPath()
      ctx.fillStyle = hexA(color, 0.75 * al)
      ctx.arc(x, y, 1.6 * sc, 0, Math.PI * 2)
      ctx.fill()
    }
  })

  pnodes.forEach((node) => {
    const al = node.alpha ?? 1
    if (al <= 0.03) return
    const r = node.r * node.sc
    const floor = projectGraphPoint(node.x, node.y, -90, cam, W, H)
    const depthBright = clampGraph((node.zd + 300) / 600, 0, 1)
    const hover = state.hov === node.id

    ctx.beginPath()
    ctx.fillStyle = hexA('#000000', 0.18 * al)
    ctx.ellipse(floor.sx, floor.sy, r * 0.85, r * 0.28, 0, 0, Math.PI * 2)
    ctx.fill()

    if (node.kind === 'hub') {
      ;[2.2, 3.2, 4.4].forEach((mul, ringIndex) => {
        ctx.beginPath()
        ctx.strokeStyle = hexA('#06b6d4', (0.07 + 0.05 * Math.sin(state.tick * 0.045 + ringIndex * 1.1)) * al)
        ctx.lineWidth = 1
        ctx.arc(node.sx, node.sy, r * mul, 0, Math.PI * 2)
        ctx.stroke()
      })
    }

    ctx.beginPath()
    ctx.fillStyle = node.kind === 'hub' ? `rgba(3,10,22,${al})` : `rgba(7,18,36,${al})`
    ctx.strokeStyle = hover ? hexA('#ffffff', al) : hexA(node.col, (0.55 + 0.45 * depthBright) * al)
    ctx.lineWidth = node.kind === 'hub' ? 2.5 : hover ? 2.2 : 1.3
    if (node.kind === 'group') ctx.setLineDash([3, 3])
    ctx.arc(node.sx, node.sy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.setLineDash([])

    if (node.kind === 'hub') {
      const fs = Math.max(8, Math.round(11 * node.sc))
      drawGraphLabel(ctx, 'YOU', node.sx, node.sy - r - fs, fs, hexA('#67e8f9', al), 0.78 * al)
      drawGraphLabel(ctx, 'hub', node.sx, node.sy + r + fs, Math.max(6, Math.round(7 * node.sc)), hexA('#06b6d4', al * 0.7), 0.62 * al)
    } else if (node.kind === 'cat') {
      drawGraphLabel(ctx, node.label, node.sx, node.sy - r - 9, Math.max(9, Math.round(10 * node.sc)), hexA('#ffffff', al), 0.84 * al)
    } else if (node.kind === 'contact') {
      const fs = Math.max(7, Math.round(9 * node.sc))
      drawGraphLabel(ctx, node.name, node.sx, node.sy - r - fs, fs, hexA('#e2e8f0', al * 0.95), 0.72 * al)
      if (node.sc > 0.45) drawGraphLabel(ctx, node.trust, node.sx, node.sy + r + fs + 2, Math.max(6, Math.round(7.5 * node.sc)), hexA(TRUST_COL[node.trust] ?? '#64748b', al * 0.85), 0.72 * al)
    } else if (node.kind === 'group') {
      const fs = Math.max(7, Math.round(8.5 * node.sc))
      drawGraphLabel(ctx, node.name, node.sx, node.sy - r - fs, fs, hexA('#cbd5e1', al * 0.9), 0.7 * al)
      if (node.sc > 0.42) drawGraphLabel(ctx, `${node.people} mbr`, node.sx, node.sy + r + fs + 2, Math.max(6, Math.round(7 * node.sc)), hexA(node.col, al * 0.7), 0.65 * al)
    }
  })

  drawGraphLegend(ctx)
  nodesRef.current = pnodes
  ctx.restore()
}

function drawGraphLegend(ctx) {
  const x = 14
  let y = 18
  ctx.font = 'bold 10px monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(3,8,16,0.68)'
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(10, 10, 148, 94, 6)
  else ctx.rect(10, 10, 148, 94)
  ctx.fill()
  ctx.fillStyle = '#67e8f9'
  ctx.fillText('camadas', x, y)
  CATS.forEach((cat) => {
    y += 18
    ctx.beginPath()
    ctx.fillStyle = cat.col
    ctx.arc(x + 5, y, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#94a3b8'
    ctx.fillText(cat.label, x + 16, y)
  })
}

function SelectedMapCard({ contact, centerAddress }) {
  if (!contact) {
    return (
      <div className="glass-panel rounded-lg p-4">
        <p className="text-sm font-black text-slate-100">Selecione uma pessoa</p>
        <p className="mt-1 text-sm font-medium text-slate-500">Clique em um nó do grafo ou em um item da lista.</p>
      </div>
    )
  }

  const destination = contact.locationQuery || contact.address
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(centerAddress)}&destination=${encodeURIComponent(destination)}`
  return (
    <div className="glass-panel rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white" style={{ backgroundColor: contact.category?.color ?? generalCategory.color }}>
          {initials(contact.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black text-slate-100">{contact.name}</p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-400">{contact.service}</p>
          <p className="mt-2 text-xs font-bold text-slate-500">{contact.locationLabel || contact.address}</p>
          <p className="mt-1 text-[11px] font-black uppercase tracking-widest text-slate-600">{contact.locationSourceLabel}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric value={`${contact.distanceLabel} ${contact.distanceSourceLabel ?? ''}`} label="distância" />
        <Metric value={contact.category?.label ?? 'Geral'} label="serviço" />
      </div>
      <button
        type="button"
        onClick={() => window.open(mapsUrl, '_blank', 'noopener,noreferrer')}
        className="primary-button mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-black"
      >
        <Navigation size={17} />
        Abrir rota no Google Maps
      </button>
    </div>
  )
}

function GoogleLocationMap({ user, centerAddress, contacts, selectedContact, onSelect }) {
  const mapRef = useRef(null)
  const [status, setStatus] = useState(GOOGLE_MAPS_API_KEY ? 'loading' : 'fallback')
  const targetAddress = selectedContact?.locationQuery || selectedContact?.address || centerAddress

  useEffect(() => {
    let cancelled = false
    if (!GOOGLE_MAPS_API_KEY || !selectedContact) {
      setStatus('fallback')
      return undefined
    }

    async function renderMap() {
      try {
        setStatus('loading')
        const maps = await loadGoogleMaps()
        if (cancelled || !mapRef.current) return

        const geocoder = new maps.Geocoder()
        const origin = await geocodeAddress(geocoder, centerAddress)
        const selectedPosition = await geocodeAddress(geocoder, selectedContact.locationQuery || selectedContact.address)
        const map = new maps.Map(mapRef.current, {
          center: selectedPosition,
          zoom: 13,
          mapTypeControl: false,
          fullscreenControl: true,
          streetViewControl: false,
        })
        const bounds = new maps.LatLngBounds()
        bounds.extend(origin)
        bounds.extend(selectedPosition)

        new maps.Marker({
          map,
          position: origin,
          title: user?.name ?? 'Você',
          label: 'EU',
        })
        new maps.Marker({
          map,
          position: selectedPosition,
          title: selectedContact.name,
          label: initials(selectedContact.name).slice(0, 2),
        })
        new maps.Polyline({
          map,
          path: [origin, selectedPosition],
          strokeColor: selectedContact.category?.color ?? '#22d3ee',
          strokeOpacity: 0.75,
          strokeWeight: 3,
        })

        for (const contact of contacts.filter((item) => item.id !== selectedContact.id)) {
          try {
            const position = await geocodeAddress(geocoder, contact.locationQuery || contact.address)
            bounds.extend(position)
            const marker = new maps.Marker({
              map,
              position,
              title: contact.name,
              label: initials(contact.name).slice(0, 2),
              opacity: 0.72,
            })
            marker.addListener('click', () => onSelect(contact.id))
          } catch {
            // Some imported contacts may only have a city or partial address.
          }
        }

        map.fitBounds(bounds)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('fallback')
      }
    }

    renderMap()
    return () => {
      cancelled = true
    }
  }, [centerAddress, contacts, onSelect, selectedContact, user?.name])

  return (
    <section className="glass-panel overflow-hidden rounded-lg">
      <div className="flex flex-col gap-2 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-100">Localização no Google Maps</p>
          <p className="truncate text-xs font-semibold text-slate-500">{selectedContact ? `${selectedContact.name} - ${targetAddress}` : targetAddress}</p>
        </div>
        <span className="rounded-lg bg-slate-950 px-2.5 py-1 text-xs font-black text-slate-400">
          {status === 'ready' ? 'API Google ativa' : 'embed/fallback'}
        </span>
      </div>
      <div className="relative">
        {status === 'fallback' ? (
          <iframe
            title="Google Maps"
            src={`https://www.google.com/maps?q=${encodeURIComponent(targetAddress)}&output=embed`}
            className="h-[360px] w-full border-0 sm:h-[460px]"
            loading="lazy"
          />
        ) : (
          <div ref={mapRef} className="h-[360px] w-full sm:h-[460px]" />
        )}
        {status === 'loading' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 text-sm font-black text-slate-200">
            Carregando mapa...
          </div>
        ) : null}
      </div>
      {!GOOGLE_MAPS_API_KEY ? (
        <p className="border-t border-slate-800 px-4 py-3 text-xs font-bold text-slate-500">
          Sem VITE_GOOGLE_MAPS_API_KEY, o app usa o embed do Google Maps. Com a chave, ele geocodifica contatos, desenha marcadores e rota na própria tela.
        </p>
      ) : null}
    </section>
  )
}

function geocodeAddress(geocoder, address) {
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results[0]) {
        resolve(results[0].geometry.location)
      } else {
        reject(new Error(status))
      }
    })
  })
}

function LoginPage({ onLogin, onGoogleLogin, onSaveUser, onImportContacts, onImportGoogleContacts, onImportGoogleProfile }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('ana@network.local')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('')
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const nextErrors = {
      email: email.trim() ? '' : 'Obrigatório.',
      password: password.trim() ? '' : 'Obrigatória.',
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    setStatus('')
    try {
      await onLogin({ email: email.trim(), password })
    } catch (error) {
      setStatus(error.message || 'Não foi possível entrar.')
    }
  }

  return (
    <AuthLayout title="Sua agenda vira uma rede de oportunidades" description="O Network Agenda organiza seus contatos, acompanha follow-ups, conecta perfis públicos e ajuda você a encontrar a pessoa certa pelo contexto certo.">
      <div className="glass-panel-soft mb-4 grid grid-cols-2 rounded-lg p-1">
        {[
          ['login', 'Entrar'],
          ['register', 'Cadastrar'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={[
              'h-10 rounded-md text-sm font-black transition',
              mode === id ? 'nav-pill-active' : 'text-slate-400 hover:text-cyan-300',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'login' ? (
        <form onSubmit={submit} noValidate className="space-y-3">
          <Field label="Email" required error={errors.email}>
            <input value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass(errors.email)} type="email" placeholder="você@email.com" />
          </Field>
          <Field label="Senha" required error={errors.password}>
            <input value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass(errors.password)} type="password" placeholder="Senha" />
          </Field>
          {status ? (
            <p className={['rounded-lg border p-3 text-sm font-bold', isGoogleLoading ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100' : 'border-rose-400/30 bg-rose-500/10 text-rose-200'].join(' ')}>
              {status}
            </p>
          ) : null}
          <button type="submit" className="primary-button inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-black">
            <LogIn size={18} />
            Entrar
          </button>
          <button
            type="button"
            disabled={isGoogleLoading}
            onClick={async () => {
              setStatus('Abrindo Google...')
              setIsGoogleLoading(true)
              try {
                await onGoogleLogin()
              } catch (error) {
                setStatus(error.message || 'Não foi possível entrar com Google.')
              } finally {
                setIsGoogleLoading(false)
              }
            }}
            className="secondary-button inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Cloud size={18} />
            {isGoogleLoading ? 'Conectando...' : 'Entrar com Google'}
          </button>
        </form>
      ) : (
        <UserProfileForm
          initialUser={defaultUser}
          submitLabel="Criar cadastro"
          onSubmit={(nextUser, pendingContacts) => onSaveUser({ ...nextUser, role: 'user' }, pendingContacts)}
          onImportContacts={onImportContacts}
          onImportGoogleContacts={onImportGoogleContacts}
          onImportGoogleProfile={onImportGoogleProfile}
        />
      )}
    </AuthLayout>
  )
}

function RegisterPage({ user, onSaveUser, onImportContacts, onImportGoogleContacts, onImportGoogleProfile, onNavigate }) {
  return (
    <AuthLayout title="Meu perfil" description="Atualize seus dados pessoais, contato, endereço e conexão Google.">
      <UserProfileForm initialUser={user ?? defaultUser} submitLabel={user ? 'Salvar perfil' : 'Criar cadastro'} onSubmit={onSaveUser} onImportContacts={onImportContacts} onImportGoogleContacts={onImportGoogleContacts} onImportGoogleProfile={onImportGoogleProfile} />
      <button type="button" onClick={() => onNavigate(ROUTES.LOGIN)} className="secondary-button mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-black">
        <LogIn size={17} />
        Trocar usuário
      </button>
    </AuthLayout>
  )
}

function UserProfileForm({ initialUser, submitLabel, onSubmit, onImportContacts, onImportGoogleContacts, onImportGoogleProfile }) {
  const [draft, setDraft] = useState(normalizeUserDraft(initialUser))
  const [cepStatus, setCepStatus] = useState({ personal: '', service: '' })
  const [importStatus, setImportStatus] = useState('')
  const [pendingImportedContacts, setPendingImportedContacts] = useState([])
  const [errors, setErrors] = useState({})
  const isCreating = submitLabel.toLowerCase().includes('criar')
  const googleConnected = hasGoogleConnection(draft)
  const googleContactsImported = Boolean(draft.googleContactsImportedAt)
  const googleProfileSynced = Boolean(draft.googleProfileSyncedAt)

  function updateDraft(field, value) {
    setDraft((current) => {
      const next = { ...current, [field]: value }
      if (['addressLine', 'addressNumber', 'addressComplement', 'neighborhood', 'city', 'state'].includes(field)) {
        next.address = composeAddress(next)
      }
      if (['serviceAddressLine', 'serviceAddressNumber', 'serviceAddressComplement', 'serviceNeighborhood', 'serviceCity', 'serviceState'].includes(field)) {
        next.serviceAddress = composeAddress({
          addressLine: next.serviceAddressLine,
          addressNumber: next.serviceAddressNumber,
          addressComplement: next.serviceAddressComplement,
          neighborhood: next.serviceNeighborhood,
          city: next.serviceCity,
          state: next.serviceState,
        })
      }
      return next
    })
  }

  async function findCep(kind) {
    const isService = kind === 'service'
    const cepField = isService ? 'serviceCep' : 'cep'
    const statusField = isService ? 'service' : 'personal'

    setCepStatus((current) => ({ ...current, [statusField]: 'Consultando CEP...' }))
    try {
      const result = await lookupCep(draft[cepField])
      setDraft((current) => {
        const next = { ...current }
        if (isService) {
          next.serviceCep = result.cep
          next.serviceAddressLine = result.addressLine
          next.serviceNeighborhood = result.neighborhood
          next.serviceCity = result.city
          next.serviceState = result.state
          next.serviceAddress = composeAddress({
            addressLine: result.addressLine,
            addressNumber: current.serviceAddressNumber,
            addressComplement: current.serviceAddressComplement,
            neighborhood: result.neighborhood,
            city: result.city,
            state: result.state,
          })
        } else {
          next.cep = result.cep
          next.addressLine = result.addressLine
          next.neighborhood = result.neighborhood
          next.city = result.city
          next.state = result.state
          next.address = composeAddress({
            addressLine: result.addressLine,
            addressNumber: current.addressNumber,
            addressComplement: current.addressComplement,
            neighborhood: result.neighborhood,
            city: result.city,
            state: result.state,
          })
        }
        return next
      })
      setCepStatus((current) => ({ ...current, [statusField]: 'CEP validado.' }))
    } catch (error) {
      setCepStatus((current) => ({ ...current, [statusField]: error.message }))
    }
  }

  async function importPhoneContacts() {
    if (!navigator.contacts?.select) {
      setImportStatus('Importação direta dos contatos do telefone não está disponível neste navegador. Use CSV exportado do Google.')
      return
    }
    try {
      const selected = await navigator.contacts.select(['name', 'tel'], { multiple: true })
      const contacts = selected.map((contact) => ({
        name: Array.isArray(contact.name) ? contact.name[0] : contact.name || 'Contato importado',
        phone: Array.isArray(contact.tel) ? contact.tel[0] : contact.tel || '0000',
        service: 'contato importado',
        city: 'Minha região',
        address: '',
      }))
      if (isCreating) {
        setPendingImportedContacts((current) => [...current, ...contacts])
        setImportStatus(`${contacts.length} contato${contacts.length === 1 ? '' : 's'} do telefone será importado após salvar o cadastro.`)
        return
      }
      await onImportContacts?.(contacts)
      setImportStatus(`${contacts.length} contato${contacts.length === 1 ? '' : 's'} importado${contacts.length === 1 ? '' : 's'} do telefone.`)
    } catch {
      setImportStatus('Importação cancelada.')
    }
  }

  async function importGoogleContacts() {
    try {
      setImportStatus('Abrindo permissão do Google...')
      const contacts = await onImportGoogleContacts?.()
      const importedAt = contacts?.length ? new Date().toISOString() : ''
      setDraft((current) => ({
        ...current,
        googleConnected: true,
        googleContactsImportedAt: importedAt || current.googleContactsImportedAt,
      }))
      if (!contacts?.length) {
        setImportStatus('Google conectado. Nenhum contato disponível para importar.')
        return
      }
      if (isCreating) {
        setPendingImportedContacts((current) => [...current, ...contacts])
        setImportStatus(`${contacts.length} contato${contacts.length === 1 ? '' : 's'} do Google será importado após salvar o cadastro.`)
        return
      }
      await onImportContacts?.(contacts)
      setImportStatus(`${contacts.length} contato${contacts.length === 1 ? '' : 's'} importado${contacts.length === 1 ? '' : 's'} do Google.`)
    } catch (error) {
      setImportStatus(error.message || 'Não foi possível importar contatos do Google.')
    }
  }

  async function fillProfileFromGoogle() {
    try {
      setImportStatus('Buscando dados da conta Google...')
      const googleDraft = await onImportGoogleProfile?.()
      if (!googleDraft) {
        setImportStatus('Não foi possível ler os dados da conta Google.')
        return
      }
      setDraft((current) => ({
        ...current,
        name: googleDraft.name || current.name,
        email: googleDraft.email || current.email,
        phone: googleDraft.phone || current.phone,
        birthDate: googleDraft.birthDate || current.birthDate,
        googleConnected: true,
        googleProfileSyncedAt: new Date().toISOString(),
      }))
      const missing = [
        googleDraft.phone ? '' : 'telefone',
        googleDraft.birthDate ? '' : 'data de nascimento',
      ].filter(Boolean)
      setImportStatus(
        missing.length
          ? `Dados do Google aplicados. Complete manualmente: ${missing.join(' e ')}.`
          : 'Dados do Google aplicados ao cadastro. Você ainda pode editar antes de salvar.',
      )
    } catch (error) {
      setImportStatus(error.message || 'Não foi possível preencher cadastro com Google.')
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (!hasGoogleConnection(draft)) {
      setImportStatus('Conecte sua conta Google no rodapé para salvar o perfil e liberar mapa/rede pública.')
      return
    }
    const nextErrors = {
      name: draft.name.trim() ? '' : 'Obrigatório.',
      email: draft.email.trim() ? '' : 'Obrigatório.',
      birthDate: draft.birthDate ? '' : 'Obrigatória.',
      phone: draft.phone.trim() ? '' : 'Obrigatório.',
      password: !isCreating || draft.password.trim() ? '' : 'Obrigatória.',
      cep: isValidCep(draft.cep) ? '' : 'CEP obrigatório e válido.',
      city: draft.city.trim() ? '' : 'Informe a cidade manualmente se o CEP não localizar.',
      state: draft.state.trim() ? '' : 'Informe a UF.',
      addressNumber: '',
      offeredServices: '',
      serviceCep: '',
      serviceCity: '',
      serviceState: '',
      serviceAddressNumber: '',
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) {
      setCepStatus((current) => ({
        ...current,
        personal: nextErrors.cep || 'Revise os campos obrigatórios destacados.',
        service: nextErrors.serviceCep || current.service,
      }))
      return
    }
    try {
      await onSubmit(normalizeUserDraft(draft), pendingImportedContacts)
    } catch (error) {
      setImportStatus(error.message || 'Não foi possível salvar o perfil.')
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" required error={errors.name}>
          <input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} className={inputClass(errors.name)} placeholder="Seu nome" />
        </Field>
        <Field label="Email" required error={errors.email}>
          <input value={draft.email} onChange={(event) => updateDraft('email', event.target.value)} className={inputClass(errors.email)} type="email" placeholder="você@email.com" />
        </Field>
        <Field label={isCreating ? 'Senha' : 'Nova senha'} required={isCreating} error={errors.password}>
          <input value={draft.password} onChange={(event) => updateDraft('password', event.target.value)} className={inputClass(errors.password)} type="password" placeholder={isCreating ? 'Crie uma senha' : 'Deixe em branco para manter'} />
        </Field>
        <Field label="Data de nascimento" required error={errors.birthDate}>
          <input value={draft.birthDate} onChange={(event) => updateDraft('birthDate', event.target.value)} className={inputClass(errors.birthDate)} type="date" />
        </Field>
        <Field label="Número" required error={errors.phone}>
          <input value={draft.phone} onChange={(event) => updateDraft('phone', event.target.value)} className={inputClass(errors.phone)} type="tel" placeholder="WhatsApp ou telefone" />
        </Field>
        <Field label="CEP" required error={errors.cep}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={draft.cep} onChange={(event) => updateDraft('cep', formatCep(event.target.value))} className={inputClass(errors.cep)} inputMode="numeric" placeholder="00000-000" />
            <button type="button" onClick={() => findCep('personal')} className="h-11 shrink-0 rounded-lg bg-cyan-500 px-3 text-sm font-black text-slate-950">
              Localizar
            </button>
          </div>
          {cepStatus.personal ? <span className="mt-1 block text-xs font-bold text-slate-500">{cepStatus.personal}</span> : null}
        </Field>
        <Field label="Rua">
          <input value={draft.addressLine} onChange={(event) => updateDraft('addressLine', event.target.value)} className="field-input" placeholder="Rua" />
        </Field>
        <Field label="Número do endereço" required={draft.isCollaborator && !draft.useDifferentServiceAddress} error={errors.addressNumber}>
          <input value={draft.addressNumber} onChange={(event) => updateDraft('addressNumber', event.target.value)} className={inputClass(errors.addressNumber)} placeholder="Número" />
        </Field>
        <Field label="Complemento">
          <input value={draft.addressComplement} onChange={(event) => updateDraft('addressComplement', event.target.value)} className="field-input" placeholder="Apto, bloco, sala" />
        </Field>
        <Field label="Bairro">
          <input value={draft.neighborhood} onChange={(event) => updateDraft('neighborhood', event.target.value)} className="field-input" placeholder="Bairro" />
        </Field>
        <Field label="Cidade" required error={errors.city}>
          <input value={draft.city} onChange={(event) => updateDraft('city', event.target.value)} className={inputClass(errors.city)} placeholder="Cidade" />
        </Field>
        <Field label="UF" required error={errors.state}>
          <input value={draft.state} onChange={(event) => updateDraft('state', event.target.value.toUpperCase().slice(0, 2))} className={inputClass(errors.state)} placeholder="UF" />
        </Field>
      </div>

      <section className="glass-panel-soft rounded-lg border border-cyan-400/15 bg-cyan-950/10 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-widest text-cyan-400">Conta Google obrigatória</p>
              <span className={['rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest', googleConnected ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'].join(' ')}>
                {googleConnected ? 'conectada' : 'pendente'}
              </span>
              {googleContactsImported ? <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-cyan-200">contatos importados</span> : null}
            </div>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
              Necessária para manter o perfil salvo e liberar mapa, rede pública e recursos conectados.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!googleProfileSynced ? (
              <button type="button" onClick={fillProfileFromGoogle} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 text-sm font-black text-cyan-100">
                <UserRound size={17} />
                Conectar Google
              </button>
            ) : null}
          </div>
        </div>
        {importStatus ? <p className="mt-2 text-xs font-bold text-slate-500">{importStatus}</p> : null}
      </section>

      <button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 text-sm font-black text-slate-950">
        <Check size={18} />
        {submitLabel}
      </button>
    </form>
  )
}

function AuthLayout({ title, description, children }) {
  return (
    <div className="auth-stage mx-auto min-h-[calc(100vh-3rem)] max-w-3xl px-1 py-8 sm:px-0 lg:py-10">
      <section className="auth-lead mx-auto flex max-w-2xl flex-col items-center justify-center text-center text-white">
        <div className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-cyan-100">
          <Zap size={14} />
          Network Agenda
        </div>
        <h1 className="constellation-title mt-5 text-3xl font-black leading-tight tracking-normal sm:text-4xl">{title}</h1>
        <p className="text-balance mt-4 max-w-xl text-sm font-semibold leading-6 text-slate-400 sm:text-base">
          {description}
        </p>
      </section>

      <section className="auth-form-panel mx-auto mt-5 max-w-xl rounded-xl p-4 sm:p-5">{children}</section>
    </div>
  )
}

function AuthFeature({ icon: Icon, label }) {
  return (
    <div className="rounded-lg bg-white/10 p-3">
      <Icon size={19} className="text-cyan-300" />
      <p className="mt-2 text-sm font-black">{label}</p>
    </div>
  )
}

function ConnectionsPage({ user, contacts, publicProfiles, backendOnline, onNavigate }) {
  if (user?.role !== 'admin') {
    return (
      <div className="glass-panel mx-auto max-w-md rounded-lg p-6 text-center">
        <Lock className="mx-auto text-slate-300" size={36} />
        <h1 className="mt-3 text-xl font-black text-slate-100">Área administrativa</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">Conexões ficam visíveis somente para administradores.</p>
        <button type="button" onClick={() => onNavigate(ROUTES.LOGIN)} className="primary-button mt-4 inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-black">
          Entrar como admin
        </button>
      </div>
    )
  }

  const categorySpread = categoryCatalog.map((category) => ({
    ...category,
    count: contacts.filter((contact) => (contact.category?.id ?? classifyService(contact.service).id) === category.id).length,
  }))

  return (
    <div className="space-y-4">
      <PageTitle eyebrow="Admin" title="Conexões" description="Visão administrativa de categorias, rede pública e disponibilidade da API." />
      <section className="grid gap-3 sm:grid-cols-3">
        <AdminMetric icon={Activity} label="API" value={backendOnline ? 'Online' : 'Offline'} />
        <AdminMetric icon={ContactRound} label="Contatos" value={contacts.length} />
        <AdminMetric icon={UsersRound} label="Rede" value={publicProfiles.length} />
      </section>
      <section className="glass-panel rounded-lg">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-base font-black text-slate-100">Categorias conectadas</h2>
        </div>
        {categorySpread.map((category) => (
          <div key={category.id} className="flex items-center justify-between border-b border-slate-800 px-4 py-3 last:border-b-0">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ backgroundColor: category.color }}>
                <category.icon size={17} />
              </span>
              <span>
                <span className="block text-sm font-black text-slate-100">{category.label}</span>
                <span className="text-xs font-semibold text-slate-500">{category.group}</span>
              </span>
            </div>
            <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-sm font-black text-slate-300">{category.count}</span>
          </div>
        ))}
      </section>
    </div>
  )
}

function AdminMetric({ icon: Icon, label, value }) {
  return (
    <div className="glass-panel rounded-lg p-4">
      <Icon size={20} className="text-cyan-700" />
      <p className="mt-3 text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-100">{value}</p>
    </div>
  )
}

function GroupModal({ profile, onClose, onToast }) {
  const title = String(profile.name ?? '').replace(/^Grupo de\s+/i, 'Serviço: ')
  const serviceTags = tagList(profile.service)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center">
      <div className="glass-panel w-full max-w-lg rounded-lg p-4 shadow-2xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-cyan-700">Serviço oferecido</p>
            <h2 className="mt-1 text-xl font-black text-slate-100">{title}</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {serviceTags.map((tag) => <span key={tag} className="rounded-md border border-cyan-400/10 bg-cyan-400/10 px-2 py-1 text-[11px] font-black text-cyan-100">{tag}</span>)}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-900 p-2 text-slate-400" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric value={profile.people} label="rede" />
          <Metric value={profile.response} label="resposta" />
          <Metric value={profile.score} label="score" />
        </div>
        <button
          type="button"
          onClick={() => onToast('Serviço verificado e recomendado pela rede.')}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-black text-white"
        >
          <MessageCircle size={18} />
          Verificar serviço
        </button>
      </div>
    </div>
  )
}

function Toast({ message }) {
  if (!message) return null

  return (
    <div className="glass-panel fixed right-4 top-20 z-50 flex max-w-sm items-center gap-2 rounded-lg px-4 py-3 text-sm font-black text-slate-100">
      <CheckCircle size={17} className="shrink-0 text-emerald-600" />
      {message}
    </div>
  )
}

function getRecommendedGroups(publicProfiles, user, query) {
  const interests = user?.interests ?? []
  const filtered = publicProfiles.filter((profile) => matchText(query, [profile.name, profile.service, profile.area, profile.category?.label]))
  return filtered
    .slice()
    .sort((a, b) => {
      const aCategory = a.category?.id ?? classifyService(a.service).id
      const bCategory = b.category?.id ?? classifyService(b.service).id
      const aScore = (interests.includes(aCategory) ? 10 : 0) + Number(a.score ?? 0)
      const bScore = (interests.includes(bCategory) ? 10 : 0) + Number(b.score ?? 0)
      return bScore - aScore
    })
}

export default function App() {
  const [contacts, setContacts] = useState(contactsSeed)
  const [publicProfiles, setPublicProfiles] = useState(publicProfilesSeed)
  const [networkUsers, setNetworkUsers] = useState([])
  const [backendOnline, setBackendOnline] = useState(false)
  const [queryDraft, setQueryDraft] = useState('')
  const [route, setRoute] = useState(parsePath)
  const [user, setUser] = useState(loadStoredUser)
  const [recents, setRecents] = useState(loadRecentSearches)
  const emptyContactForm = {
    name: '',
    phone: '',
    service: '',
    note: '',
    city: '',
    address: '',
    description: '',
    demand: '',
    solves: '',
    tags: '',
    email: '',
    whatsapp: '',
    instagram: '',
    linkedin: '',
    custom_url: '',
    custom_fields: '[]',
    cep: '',
    addressLine: '',
    addressNumber: '',
    addressComplement: '',
    neighborhood: '',
    state: '',
    crm_status: 'Novo',
    crm_priority: 'Média',
    last_contact_at: '',
    next_follow_up_at: '',
    crm_note: '',
  }
  const [form, setForm] = useState(emptyContactForm)
  const [toast, setToast] = useState('')
  const [editingContact, setEditingContact] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [newCount, setNewCount] = useState(0)
  const [isImporting, setIsImporting] = useState(false)
  const [duplicateSuggestions, setDuplicateSuggestions] = useState([])
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false)
  const [isChatThinking, setIsChatThinking] = useState(false)
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Posso organizar contatos importados, sugerir categorias e encontrar pessoas por tema.',
      provider: 'local',
      suggestions: [],
    },
  ])

  useEffect(() => {
    const handlePopState = () => setRoute(parsePath())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!user) return undefined
    const expiresAt = getStoredSessionExpiry()
    const remaining = expiresAt - Date.now()
    if (!expiresAt || remaining <= 0) {
      logout()
      return undefined
    }
    const timeout = window.setTimeout(() => {
      logout()
      showToast('Sessão expirada. Entre novamente.')
    }, remaining)
    return () => window.clearTimeout(timeout)
  }, [user?.id, user?.email])

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const contactsPath = user ? `/api/contacts?user_id=${encodeURIComponent(contactOwnerId(user))}` : null
        const duplicatesPath = user ? `/api/merge-suggestions?user_id=${encodeURIComponent(contactOwnerId(user))}` : null
        const [remoteContacts, remoteProfiles, remoteUsers, remoteDuplicates] = await Promise.all([
          contactsPath ? apiRequest(contactsPath) : Promise.resolve([]),
          apiRequest('/api/public-profiles'),
          apiRequest('/api/users'),
          duplicatesPath ? apiRequest(duplicatesPath) : Promise.resolve([]),
        ])
        if (cancelled) return
        setContacts(remoteContacts)
        setPublicProfiles(remoteProfiles)
        setNetworkUsers(remoteUsers.map(apiUserToLocal).filter(Boolean))
        setDuplicateSuggestions(remoteDuplicates)
        setBackendOnline(true)
      } catch {
        if (!cancelled) setBackendOnline(false)
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [user?.id, user?.email])

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(''), 2500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  function navigate(path) {
    window.history.pushState({}, '', path)
    setRoute(parsePath())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function showToast(message) {
    setToast(message)
  }

  function rememberUser(nextUser) {
    const normalized = normalizeUserDraft(nextUser)
    setUser(normalized)
    setNetworkUsers((current) => {
      const others = current.filter((item) => normalize(item.email) !== normalize(normalized.email))
      return [normalized, ...others]
    })
    storeSessionUser(normalized)
    return normalized
  }

  function onSearch(rawQuery = queryDraft) {
    const nextQuery = rawQuery.trim()
    setQueryDraft(nextQuery)
    if (nextQuery) {
      const nextRecents = [nextQuery, ...recents.filter((item) => normalize(item) !== normalize(nextQuery))].slice(0, 6)
      setRecents(nextRecents)
      localStorage.setItem('network-agenda-recents', JSON.stringify(nextRecents))
    }
    navigate(ROUTES.AGENDA)
  }

  function clearRecentSearches() {
    setRecents([])
    localStorage.setItem('network-agenda-recents', JSON.stringify([]))
    showToast('Buscas recentes limpas.')
  }

  function exportContacts() {
    const payload = {
      exported_at: new Date().toISOString(),
      owner: user ? { id: user.id, name: user.name, email: user.email } : null,
      contacts: contactsWithCategory,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `network-agenda-contatos-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    showToast('Exportação iniciada.')
  }

  function updateForm(field, value) {
    if (typeof field === 'object') {
      setForm(field)
      return
    }
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function saveImportedContact(payload, owner = user) {
    const service = inferImportedService(payload)
    let newContact = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      owner_id: contactOwnerId(owner),
      city: payload.city || 'Minha região',
      address: payload.address || payload.city || '',
      trust: 'Novo',
      source: 'Importado',
      note: '',
      ...payload,
      service,
    }

    try {
      newContact = await apiRequest('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(newContact),
      })
      setBackendOnline(true)
    } catch {
      setBackendOnline(false)
    }

    return newContact
  }

  function parseImport(text) {
    return parseImportedContacts(text).slice(0, 30)
  }

  async function importContactsFromProfile(items) {
    if (!items?.length) {
      showToast('Nenhum contato encontrado para importar.')
      return
    }
    if (!user) {
      showToast('Entre ou crie um cadastro antes de salvar contatos.')
      return
    }
    const saved = []
    for (const item of items) {
      saved.push(await saveImportedContact(item))
    }
    setContacts((current) => [...saved, ...current])
    setNewCount((count) => count + saved.length)
    await refreshDuplicates(user)
    showToast(`${saved.length} contato${saved.length === 1 ? '' : 's'} importado${saved.length === 1 ? '' : 's'}.`)
  }

  async function importContactsForOwner(items, owner) {
    if (!items?.length || !owner) return []
    const saved = []
    for (const item of items) {
      saved.push(await saveImportedContact(item, owner))
    }
    setContacts((current) => [...saved, ...current])
    setNewCount((count) => count + saved.length)
    await refreshDuplicates(owner)
    return saved
  }

  async function requestGoogleContacts() {
    return getGoogleContactsOnly()
  }

  async function requestGoogleProfileDraft() {
    return getGoogleAccountDraft()
  }

  async function importGoogleContactsFromSettings() {
    if (!user) {
      showToast('Entre antes de importar contatos do Google.')
      return
    }
    showToast('Abrindo permissão do Google Contacts...')
    try {
      const googleContacts = await requestGoogleContacts()
      if (!googleContacts.length) {
        const connectedUser = rememberUser({ ...user, googleConnected: true })
        showToast('Nenhum contato do Google disponível para importar.')
        try {
          await apiRequest('/api/users', {
            method: 'POST',
            body: JSON.stringify(userToApiPayload(connectedUser)),
          })
          setBackendOnline(true)
        } catch {
          setBackendOnline(false)
        }
        return
      }
      const imported = await importContactsForOwner(googleContacts, user)
      const connectedUser = rememberUser({
        ...user,
        googleConnected: true,
        googleContactsImportedAt: new Date().toISOString(),
      })
      try {
        const response = await apiRequest('/api/users', {
          method: 'POST',
          body: JSON.stringify(userToApiPayload(connectedUser)),
        })
        const savedUser = apiUserToLocal(response) ?? connectedUser
        rememberUser(savedUser)
        setBackendOnline(true)
      } catch {
        setBackendOnline(false)
      }
      showToast(`${imported.length} contato${imported.length === 1 ? '' : 's'} importado${imported.length === 1 ? '' : 's'} do Google.`)
    } catch (error) {
      showToast(error.message || 'Não foi possível importar contatos do Google.')
    }
  }

  async function refreshDuplicates(owner = user) {
    if (!owner) return
    setIsCheckingDuplicates(true)
    try {
      const suggestions = await apiRequest(`/api/merge-suggestions?user_id=${encodeURIComponent(contactOwnerId(owner))}`)
      setDuplicateSuggestions(suggestions)
      setBackendOnline(true)
    } catch {
      setBackendOnline(false)
      showToast('Não foi possível verificar duplicados.')
    } finally {
      setIsCheckingDuplicates(false)
    }
  }

  async function refreshContactsFromBackend(owner = user) {
    if (!owner) return []
    try {
      const remoteContacts = await apiRequest(`/api/contacts?user_id=${encodeURIComponent(contactOwnerId(owner))}`)
      setContacts(remoteContacts)
      setBackendOnline(true)
      return remoteContacts
    } catch {
      setBackendOnline(false)
      return []
    }
  }

  async function ignoreDuplicateSuggestion(suggestion) {
    try {
      await apiRequest('/api/merge-suggestions/ignore', {
        method: 'POST',
        body: JSON.stringify({
          owner_id: contactOwnerId(user),
          primary_contact_id: suggestion.primary_contact.id,
          duplicate_contact_id: suggestion.duplicate_contact.id,
        }),
      })
      setDuplicateSuggestions((current) => current.filter((item) => item.id !== suggestion.id))
      setBackendOnline(true)
      showToast('Duplicado ignorado.')
    } catch {
      setBackendOnline(false)
      showToast('Não foi possível ignorar este duplicado.')
    }
  }

  async function mergeDuplicateSuggestion(suggestion) {
    try {
      const merged = await apiRequest('/api/merge-suggestions/merge', {
        method: 'POST',
        body: JSON.stringify({
          owner_id: contactOwnerId(user),
          primary_contact_id: suggestion.primary_contact.id,
          duplicate_contact_id: suggestion.duplicate_contact.id,
        }),
      })
      setContacts((current) =>
        current
          .filter((contact) => contact.id !== suggestion.duplicate_contact.id)
          .map((contact) => (contact.id === merged.id ? merged : contact)),
      )
      setDuplicateSuggestions((current) => current.filter((item) => item.id !== suggestion.id))
      setBackendOnline(true)
      showToast('Contatos mesclados.')
      await refreshDuplicates()
    } catch {
      setBackendOnline(false)
      showToast('Não foi possível mesclar os contatos.')
    }
  }

  async function askCopilot(message, targetContactId = null) {
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: message,
      suggestions: [],
    }
    setChatMessages((current) => [...current, userMessage])
    setIsChatThinking(true)
    try {
      const response = await apiRequest('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          user_id: contactOwnerId(user),
          message,
          target_contact_id: targetContactId ? Number(targetContactId) : null,
        }),
      })
      setBackendOnline(true)
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: response.answer,
          provider: response.provider,
          suggestions: response.suggestions ?? [],
        },
      ])
    } catch {
      setBackendOnline(false)
      const suggestions = contacts
        .filter((contact) => contact.category?.id === 'general' || isGenericService(contact.service))
        .map((contact) => {
          const suggestedService = inferImportedService(contact)
          const category = classifyService([suggestedService, contact.name, contact.note, contact.source].filter(Boolean).join(' '))
          return {
            contact_id: contact.id,
            name: contact.name,
            current_service: contact.service,
            suggested_service: suggestedService,
            category_id: category.id,
            category_label: category.label,
            reason: 'Sugestão calculada localmente pelo app.',
          }
        })
        .slice(0, 20)
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: suggestions.length ? `Encontrei ${suggestions.length} contato(s) para revisar.` : 'Nao consegui falar com a API agora, mas nao encontrei pendencias locais.',
          provider: 'local',
          suggestions,
        },
      ])
    } finally {
      setIsChatThinking(false)
    }
  }

  async function applyCopilotSuggestion(suggestion) {
    if (suggestion.action === 'conflict') {
      showToast(suggestion.reason || 'Escolha outro horário para este follow-up.')
      return
    }
    const contact = contacts.find((item) => String(item.id) === String(suggestion.contact_id))
    if (!contact) {
      showToast('Contato não encontrado.')
      return
    }
    const action = suggestion.action || 'categorize'
    const crmActions = new Set(['set_crm', 'complete_follow_up', 'clear_follow_up'])
    const isCrmAction = crmActions.has(action)
    const nextFollowUpAt = action === 'complete_follow_up' || action === 'clear_follow_up' ? '' : (suggestion.next_follow_up_at || contact.next_follow_up_at || '')
    const nextPriority = suggestion.crm_priority || contact.crm_priority || 'Média'
    let nextStatus = suggestion.crm_status || contact.crm_status || 'Novo'
    if (action === 'set_crm' && !suggestion.crm_status && nextFollowUpAt) {
      nextStatus = 'Follow-up'
    }
    if (action === 'set_crm' && nextStatus === 'Novo' && !nextFollowUpAt && normalize(nextPriority) === 'media') {
      nextStatus = 'Ativo'
    }
    const crmNote = suggestion.crm_note && !contact.crm_note?.includes(suggestion.crm_note)
      ? [contact.crm_note, suggestion.crm_note].filter(Boolean).join('\n')
      : contact.crm_note
    const updated = {
      ...contact,
      service: action === 'categorize' ? suggestion.suggested_service : contact.service,
      note: contact.note ?? '',
      crm_status: nextStatus,
      crm_priority: nextPriority,
      last_contact_at: suggestion.last_contact_at || contact.last_contact_at || '',
      next_follow_up_at: nextFollowUpAt,
      crm_note: crmNote || (isCrmAction ? suggestion.reason || contact.crm_note || '' : ''),
      owner_id: contactOwnerId(user),
    }
    try {
      await saveEditedContact(updated, { silent: true })
      await refreshContactsFromBackend(user)
    } catch (error) {
      const errorMessage = error.message || 'Não consegui salvar essa alteração no banco.'
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          text: `Não consegui salvar no CRM: ${errorMessage}`,
          provider: 'local',
          suggestions: [suggestion],
        },
      ])
      showToast(errorMessage)
      return
    }
    const messages = {
      categorize: `Pronto, atualizei a categoria de ${suggestion.name}.`,
      set_crm: `Pronto, atualizei o CRM de ${suggestion.name}. Já deve aparecer no CRM.`,
      complete_follow_up: `Pronto, marquei o follow-up de ${suggestion.name} como concluído. Já deve aparecer no CRM.`,
      clear_follow_up: `Pronto, removi o follow-up de ${suggestion.name}. Já deve aparecer no CRM.`,
    }
    const confirmation = messages[action] || `Pronto, atualizei ${suggestion.name}.`
    setChatMessages((current) =>
      [
        ...current.map((message) =>
          message.suggestions?.length
            ? {
                ...message,
                suggestions: message.suggestions.filter((item) => !(String(item.contact_id) === String(suggestion.contact_id) && (item.action || 'categorize') === action)),
              }
            : message,
        ),
        {
          id: `assistant-applied-${Date.now()}`,
          role: 'assistant',
          text: confirmation,
          provider: 'local',
          suggestions: [],
          cta: crmActions.has(action) ? { label: 'Ver no CRM', route: ROUTES.CRM } : null,
        },
      ],
    )
    showToast(confirmation)
    if (isCrmAction) navigate(ROUTES.CRM)
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!user) {
      showToast('Entre ou crie um cadastro antes de importar contatos.')
      return
    }

    setIsImporting(true)
    try {
      const text = await file.text()
      const imported = parseImport(text)
      if (!imported.length) {
        showToast('Nenhum contato encontrado no arquivo.')
        return
      }

      const saved = []
      for (const item of imported) {
        saved.push(await saveImportedContact(item))
      }
      setContacts((current) => [...saved, ...current])
      setNewCount((count) => count + imported.length)
      await refreshDuplicates(user)
      showToast(`${imported.length} contato${imported.length > 1 ? 's' : ''} importado${imported.length > 1 ? 's' : ''}.`)
    } finally {
      setIsImporting(false)
    }
  }

  async function addContact(event) {
    event.preventDefault()
    if (!form.name.trim() || !form.phone.trim() || !form.service.trim()) {
      showToast('Preencha nome, telefone e serviço.')
      return
    }

    const resolvedAddress = form.address.trim()
    const resolvedCity = form.city.trim()

    let newContact = {
      id: Date.now(),
      owner_id: contactOwnerId(user),
      name: form.name.trim(),
      phone: form.phone.trim(),
      service: form.service.trim(),
      note: '',
      city: resolvedCity || 'Minha região',
      address: resolvedAddress || resolvedCity || '',
      description: form.description || '',
      demand: form.demand || '',
      solves: form.solves || '',
      tags: form.tags || '',
      email: form.email || '',
      whatsapp: form.whatsapp || '',
      instagram: form.instagram || '',
      linkedin: form.linkedin || '',
      custom_url: form.custom_url || '',
      custom_fields: form.custom_fields || '[]',
      trust: 'Novo',
      source: 'Manual',
      crm_status: form.crm_status || 'Novo',
      crm_priority: form.crm_priority || 'Média',
      last_contact_at: form.last_contact_at || '',
      next_follow_up_at: form.next_follow_up_at || '',
      crm_note: form.crm_note || '',
    }

    try {
      newContact = await apiRequest('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(newContact),
      })
      setBackendOnline(true)
    } catch {
      setBackendOnline(false)
    }

    setContacts((current) => [newContact, ...current])
    setNewCount((count) => count + 1)
    await refreshDuplicates(user)
    setForm(emptyContactForm)
    showToast('Contato salvo.')
    navigate(ROUTES.AGENDA)
  }

  async function deleteContact(id) {
    try {
      await apiRequest(`/api/contacts/${id}?user_id=${encodeURIComponent(contactOwnerId(user))}`, { method: 'DELETE' })
      setBackendOnline(true)
    } catch {
      setBackendOnline(false)
    }
    setContacts((prev) => prev.filter((contact) => contact.id !== id))
    await refreshDuplicates(user)
    showToast('Contato removido.')
  }

  async function saveEditedContact(nextContact, options = {}) {
    if (!nextContact.name.trim() || !nextContact.phone.trim() || !nextContact.service.trim()) {
      showToast('Preencha nome, telefone e serviço.')
      return
    }

    const payload = {
      name: nextContact.name.trim(),
      owner_id: contactOwnerId(user),
      phone: nextContact.phone.trim(),
      service: nextContact.service.trim(),
      note: '',
      city: nextContact.city?.trim() || 'Minha região',
      address: nextContact.address?.trim() || nextContact.city?.trim() || '',
      trust: nextContact.trust || 'Novo',
      source: nextContact.source || 'Manual',
      description: nextContact.description || '',
      demand: nextContact.demand || '',
      solves: nextContact.solves || '',
      tags: nextContact.tags || '',
      email: nextContact.email || '',
      whatsapp: nextContact.whatsapp || '',
      instagram: nextContact.instagram || '',
      linkedin: nextContact.linkedin || '',
      custom_url: nextContact.custom_url || '',
      custom_fields: nextContact.custom_fields || '[]',
      crm_status: nextContact.crm_status || 'Novo',
      crm_priority: nextContact.crm_priority || 'Média',
      last_contact_at: nextContact.last_contact_at || '',
      next_follow_up_at: nextContact.next_follow_up_at || '',
      crm_note: nextContact.crm_note || '',
    }

    let saved = { ...nextContact, ...payload, category: classifyService(payload.service) }
    try {
      saved = await apiRequest(`/api/contacts/${nextContact.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      setBackendOnline(true)
    } catch (error) {
      setBackendOnline(false)
      if (!options.silent) showToast(error.message || 'Não foi possível salvar no banco.')
      throw error
    }

    setContacts((current) => current.map((contact) => (contact.id === nextContact.id ? saved : contact)))
    await refreshDuplicates(user)
    setEditingContact(null)
    if (!options.silent) showToast('Contato atualizado.')
    return saved
  }

  async function completeFollowUp(contact) {
    const completedAt = todayInputDate()
    const hasFollowUp = Boolean(contact.next_follow_up_at)
    const currentStatus = effectiveCrmStatus(contact)
    const completionNote = hasFollowUp
      ? `Follow-up concluído em ${formatFollowUp(completedAt)}.`
      : `Conversa concluída em ${formatFollowUp(completedAt)}.`
    const crmNote = contact.crm_note?.includes(completionNote)
      ? contact.crm_note
      : [contact.crm_note, completionNote].filter(Boolean).join('\n')
    const updated = {
      ...contact,
      last_contact_at: completedAt,
      next_follow_up_at: '',
      crm_status: hasFollowUp
        ? (currentStatus === 'Follow-up' ? 'Conversa iniciada' : currentStatus)
        : (currentStatus === 'Conversa iniciada' ? 'Ativo' : currentStatus),
      crm_note: crmNote,
    }
    setContacts((current) => current.map((item) => (item.id === contact.id ? updated : item)))
    try {
      await saveEditedContact(updated, { silent: true })
      showToast(hasFollowUp ? 'Follow-up concluído.' : 'Conversa concluída.')
    } catch {
      showToast('Não foi possível concluir esta ação.')
    }
  }

  async function cancelFollowUp(contact) {
    const canceledAt = todayInputDate()
    const hasFollowUp = Boolean(contact.next_follow_up_at)
    const currentStatus = effectiveCrmStatus(contact)
    const cancelNote = hasFollowUp
      ? `Follow-up cancelado em ${formatFollowUp(canceledAt)}. Para remarcar, use Alterar.`
      : `Conversa cancelada em ${formatFollowUp(canceledAt)}.`
    const crmNote = contact.crm_note?.includes(cancelNote)
      ? contact.crm_note
      : [contact.crm_note, cancelNote].filter(Boolean).join('\n')
    const updated = {
      ...contact,
      next_follow_up_at: '',
      crm_status: hasFollowUp
        ? (currentStatus === 'Follow-up' ? 'Conversa iniciada' : currentStatus)
        : 'Pausado',
      crm_note: crmNote,
    }
    setContacts((current) => current.map((item) => (item.id === contact.id ? updated : item)))
    try {
      await saveEditedContact(updated, { silent: true })
      showToast(hasFollowUp ? 'Follow-up cancelado. Use Alterar para remarcar.' : 'Conversa cancelada.')
    } catch {
      showToast('Não foi possível cancelar esta ação.')
    }
  }

  async function loginUser(credentials) {
    const response = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    const loggedUser = apiUserToLocal(response)
    if (!loggedUser) throw new Error('Usuário não encontrado.')
    setBackendOnline(true)
    setUser(loggedUser)
    setNetworkUsers((current) => {
      const others = current.filter((item) => normalize(item.email) !== normalize(loggedUser.email))
      return [loggedUser, ...others]
    })
    storeSessionUser(loggedUser)
    showToast('Login realizado.')
    navigate(ROUTES.DASHBOARD)
  }

  async function loginWithGoogle() {
    const { profile } = await getGoogleProfileWithToken()
    const response = await apiRequest('/api/google-login', {
      method: 'POST',
      body: JSON.stringify({
        sub: profile.sub,
        email: profile.email,
        name: profile.name || profile.email,
        picture: profile.picture || '',
      }),
    })
    const loggedUser = apiUserToLocal(response)
    if (!loggedUser) throw new Error('Usuário Google não encontrado.')
    setBackendOnline(true)
    setUser(loggedUser)
    setNetworkUsers((current) => {
      const others = current.filter((item) => normalize(item.email) !== normalize(loggedUser.email))
      return [loggedUser, ...others]
    })
    storeSessionUser(loggedUser)
    if (isCadastroIncomplete(loggedUser)) {
      showToast('Login Google realizado. Complete seu cadastro.')
      navigate(ROUTES.REGISTER)
      return
    }
    showToast('Login Google realizado.')
    navigate(ROUTES.DASHBOARD)
  }

  async function saveUser(nextUser, pendingContacts = [], options = {}) {
    let savedUser = normalizeUserDraft(nextUser)
    try {
      const response = await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(userToApiPayload(savedUser)),
      })
      savedUser = apiUserToLocal(response) ?? savedUser
      setBackendOnline(true)
    } catch (error) {
      setBackendOnline(false)
      showToast(error.message || 'Não foi possível salvar o perfil no backend.')
      throw error
    }
    setUser(savedUser)
    setNetworkUsers((current) => {
      const others = current.filter((item) => normalize(item.email) !== normalize(savedUser.email))
      return [savedUser, ...others]
    })
    storeSessionUser(savedUser)
    if (pendingContacts.length) {
      await importContactsForOwner(pendingContacts, savedUser)
    }
    try {
      const [remoteProfiles, remoteUsers] = await Promise.all([
        apiRequest('/api/public-profiles'),
        apiRequest('/api/users'),
      ])
      setPublicProfiles(remoteProfiles)
      setNetworkUsers(remoteUsers.map(apiUserToLocal).filter(Boolean))
    } catch {
      setNetworkUsers((current) => {
        const others = current.filter((item) => normalize(item.email) !== normalize(savedUser.email))
        return [savedUser, ...others]
      })
    }
    showToast(options.successMessage ?? 'Cadastro salvo.')
    navigate(options.redirectTo ?? (savedUser.publicVisible ? ROUTES.PUBLIC : ROUTES.DASHBOARD))
  }

  function logout() {
    setUser(null)
    localStorage.removeItem(AUTH_STORAGE_KEY)
    showToast('Sessão encerrada.')
    navigate(ROUTES.LOGIN)
  }

  const contactsWithCategory = useMemo(
    () =>
      contacts.map((contact) => ({
        ...contact,
        address: contact.address ?? contact.city ?? '',
        category: categoryDetails(contact.category, contact.service),
      })),
    [contacts],
  )

  const publicProfilesWithCategory = useMemo(
    () =>
      publicProfiles.map((profile) => ({
        ...profile,
        category: categoryDetails(profile.category, profile.service),
      })),
    [publicProfiles],
  )

  const inferredCategory = form.service ? classifyService(form.service) : null
  const isAuthRoute = !user && (route.page === 'login' || route.page === 'register')
  const effectiveRoute = !user && !isAuthRoute ? { page: 'login', categoryId: null } : route

  let page
  if (effectiveRoute.page === 'login') {
    page = <LoginPage onLogin={loginUser} onGoogleLogin={loginWithGoogle} onSaveUser={saveUser} onImportContacts={importContactsFromProfile} onImportGoogleContacts={requestGoogleContacts} onImportGoogleProfile={requestGoogleProfileDraft} />
  } else if (effectiveRoute.page === 'register') {
    page = <RegisterPage user={user} onSaveUser={saveUser} onImportContacts={importContactsFromProfile} onImportGoogleContacts={requestGoogleContacts} onImportGoogleProfile={requestGoogleProfileDraft} onNavigate={navigate} />
  } else if (effectiveRoute.page === 'publicProfile') {
    page = <PublicProfileSettingsPage user={user} onSaveUser={saveUser} onNavigate={navigate} />
  } else if (effectiveRoute.page === 'dashboard') {
    page = <DashboardPage contacts={contactsWithCategory} duplicateCount={duplicateSuggestions.length} backendOnline={backendOnline} onNavigate={navigate} onAsk={askCopilot} isThinking={isChatThinking} />
  } else if (effectiveRoute.page === 'agenda') {
    page = (
      <AgendaPage
        contacts={contactsWithCategory}
        activeCategory={effectiveRoute.categoryId ?? 'all'}
        queryDraft={queryDraft}
        setQueryDraft={setQueryDraft}
        onSearch={onSearch}
        recents={recents}
        onDelete={deleteContact}
        onEdit={setEditingContact}
        onOpenContact={(contact) => navigate(`${ROUTES.CONTACT}/${contact.id}`)}
        onToast={showToast}
        onNavigate={navigate}
        onImport={handleImportFile}
        isImporting={isImporting}
      />
    )
  } else if (effectiveRoute.page === 'contact') {
    const selectedContact = contactsWithCategory.find((contact) => String(contact.id) === String(effectiveRoute.contactId))
    page = <ContactDetailPage contact={selectedContact} onEdit={setEditingContact} onNavigate={navigate} />
  } else if (effectiveRoute.page === 'crm') {
    page = <CrmPage contacts={contactsWithCategory} onEdit={setEditingContact} onCompleteFollowUp={completeFollowUp} onCancelFollowUp={cancelFollowUp} onNavigate={navigate} onAsk={askCopilot} messages={chatMessages} isThinking={isChatThinking} />
  } else if (effectiveRoute.page === 'new') {
    page = <NewContactPage form={form} updateForm={updateForm} addContact={addContact} inferredCategory={inferredCategory} onNavigate={navigate} />
  } else if (effectiveRoute.page === 'map') {
    page = <MapPage contacts={contactsWithCategory} users={networkUsers} user={user} onNavigate={navigate} />
  } else if (effectiveRoute.page === 'public') {
    page = <PublicNetworkPage publicProfiles={publicProfilesWithCategory} contacts={contactsWithCategory} user={user} onNavigate={navigate} onOpenGroup={setSelectedGroup} />
  } else if (effectiveRoute.page === 'chat') {
    page = <ChatPage contacts={contactsWithCategory} messages={chatMessages} onAsk={askCopilot} onApplySuggestion={applyCopilotSuggestion} onNavigate={navigate} isThinking={isChatThinking} />
  } else if (effectiveRoute.page === 'settings') {
    page = (
      <SettingsPage
        user={user}
        contacts={contactsWithCategory}
        duplicateCount={duplicateSuggestions.length}
        backendOnline={backendOnline}
        recents={recents}
        onNavigate={navigate}
        onRefreshDuplicates={refreshDuplicates}
        onImportGoogleContacts={importGoogleContactsFromSettings}
        onExportContacts={exportContacts}
        onClearRecents={clearRecentSearches}
        onLogout={logout}
      />
    )
  } else if (effectiveRoute.page === 'duplicates') {
    page = (
      <DuplicatesPage
        suggestions={duplicateSuggestions}
        isLoading={isCheckingDuplicates}
        onRefresh={refreshDuplicates}
        onMerge={mergeDuplicateSuggestion}
        onIgnore={ignoreDuplicateSuggestion}
        onReview={setEditingContact}
        onNavigate={navigate}
      />
    )
  } else if (effectiveRoute.page === 'connections') {
    page = <ConnectionsPage user={user} contacts={contactsWithCategory} publicProfiles={publicProfilesWithCategory} backendOnline={backendOnline} onNavigate={navigate} />
  } else {
    page = <AgendaPage contacts={contactsWithCategory} activeCategory="all" queryDraft={queryDraft} setQueryDraft={setQueryDraft} onSearch={onSearch} recents={recents} onDelete={deleteContact} onEdit={setEditingContact} onOpenContact={(contact) => navigate(`${ROUTES.CONTACT}/${contact.id}`)} onToast={showToast} onNavigate={navigate} onImport={handleImportFile} isImporting={isImporting} />
  }

  return (
    <Shell user={user} route={effectiveRoute} online={backendOnline} unread={newCount} onNavigate={navigate} onLogout={logout}>
      <Toast message={toast} />
      {page}
      {editingContact ? <EditContactModal contact={editingContact} onClose={() => setEditingContact(null)} onSave={saveEditedContact} /> : null}
      {selectedGroup ? <GroupModal profile={selectedGroup} onClose={() => setSelectedGroup(null)} onToast={showToast} /> : null}
    </Shell>
  )
}
