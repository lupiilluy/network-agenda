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
  MessageCircle,
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
  UsersRound,
  X,
  Zap,
} from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8005'
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const GOOGLE_CONTACTS_SCOPE = 'openid email profile https://www.googleapis.com/auth/contacts.readonly'

const ROUTES = {
  AGENDA: '/agenda',
  MAP: '/mapa',
  GROUPS: '/grupos',
  NEW: '/novo',
  LOGIN: '/login',
  REGISTER: '/cadastro',
  CONNECTIONS: '/admin/conexoes',
}

const categoryCatalog = [
  {
    id: 'home',
    label: 'Casa e manutenção',
    group: 'Serviços domésticos',
    icon: Home,
    color: '#059669',
    keywords: ['eletricista', 'encanador', 'pintor', 'pintura', 'reforma', 'pedreiro', 'marceneiro', 'limpeza', 'jardineiro'],
    synonyms: ['instalacao', 'reparo', 'emergencia', 'manutencao', 'residencial'],
  },
  {
    id: 'legal',
    label: 'Jurídico',
    group: 'Serviços profissionais',
    icon: Scale,
    color: '#2563eb',
    keywords: ['advogado', 'advogada', 'jurídico', 'trabalhista', 'contrato', 'contratos', 'civil', 'tributario'],
    synonyms: ['processo', 'empresa', 'direito', 'documentos'],
  },
  {
    id: 'health',
    label: 'Saúde',
    group: 'Cuidado pessoal',
    icon: HeartPulse,
    color: '#e11d48',
    keywords: ['medico', 'medica', 'dentista', 'psicologo', 'psicologa', 'fisioterapeuta', 'nutricionista'],
    synonyms: ['consulta', 'tratamento', 'clinica'],
  },
  {
    id: 'business',
    label: 'Empresas e negócios',
    group: 'Operação',
    icon: Building2,
    color: '#ca8a04',
    keywords: ['contador', 'contabilidade', 'consultor', 'consultoria', 'marketing', 'vendas', 'rh', 'financeiro'],
    synonyms: ['empresa', 'gestão', 'estrategia', 'operacao'],
  },
  {
    id: 'tech',
    label: 'Tecnologia',
    group: 'Digital',
    icon: Briefcase,
    color: '#0891b2',
    keywords: ['programador', 'desenvolvedor', 'designer', 'ti', 'suporte', 'software', 'web', 'site', 'app'],
    synonyms: ['sistema', 'automacao', 'produto digital'],
  },
  {
    id: 'education',
    label: 'Educação',
    group: 'Aulas e mentoria',
    icon: GraduationCap,
    color: '#7c3aed',
    keywords: ['professor', 'professora', 'aula', 'ingles', 'matematica', 'mentor', 'mentoria'],
    synonyms: ['curso', 'reforco', 'aprendizado'],
  },
  {
    id: 'vehicle',
    label: 'Veículos',
    group: 'Mobilidade',
    icon: Car,
    color: '#475569',
    keywords: ['mecanico', 'auto', 'carro', 'moto', 'funilaria', 'guincho', 'motorista'],
    synonyms: ['oficina', 'revisao', 'transporte'],
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
    categoryCatalog.find((category) => category.keywords.some((keyword) => normalized.includes(normalize(keyword)))) ??
    categoryCatalog.find((category) => category.synonyms.some((keyword) => normalized.includes(normalize(keyword))))

  return match ?? generalCategory
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

function estimateFallbackDistance(origin, destination) {
  const originCoords = findFallbackCoordinate(origin)
  const destinationCoords = findFallbackCoordinate(destination)
  if (!originCoords || !destinationCoords) return null

  const toRad = (value) => (value * Math.PI) / 180
  const earthKm = 6371
  const dLat = toRad(destinationCoords.lat - originCoords.lat)
  const dLng = toRad(destinationCoords.lng - originCoords.lng)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(originCoords.lat)) * Math.cos(toRad(destinationCoords.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const distance = earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return `${distance.toFixed(distance < 10 ? 1 : 0)} km`
}

function findFallbackCoordinate(address) {
  const normalized = normalize(address)
  const key = Object.keys(fallbackCoordinates).find((item) => normalized.includes(item))
  return key ? fallbackCoordinates[key] : null
}

function parsePath() {
  const path = window.location.pathname === '/' ? ROUTES.AGENDA : window.location.pathname
  if (path.startsWith('/categoria/')) {
    return { page: 'agenda', categoryId: decodeURIComponent(path.replace('/categoria/', '')) }
  }

  const pageByPath = {
    '/buscar': 'agenda',
    [ROUTES.AGENDA]: 'agenda',
    [ROUTES.MAP]: 'map',
    [ROUTES.GROUPS]: 'groups',
    [ROUTES.NEW]: 'new',
    [ROUTES.LOGIN]: 'login',
    [ROUTES.REGISTER]: 'register',
    [ROUTES.CONNECTIONS]: 'connections',
  }

  return { page: pageByPath[path] ?? 'agenda', categoryId: null }
}

function loadStoredUser() {
  try {
    const stored = localStorage.getItem('network-agenda-user')
    return stored ? normalizeUserDraft(JSON.parse(stored)) : null
  } catch {
    return null
  }
}

function normalizeUserDraft(user) {
  const personalAddress = composeAddress({
    addressLine: user?.addressLine,
    addressNumber: user?.addressNumber,
    addressComplement: user?.addressComplement,
    neighborhood: user?.neighborhood,
    city: user?.city,
    state: user?.state,
  })
  const serviceAddress = composeAddress({
    addressLine: user?.serviceAddressLine,
    addressNumber: user?.serviceAddressNumber,
    addressComplement: user?.serviceAddressComplement,
    neighborhood: user?.serviceNeighborhood,
    city: user?.serviceCity,
    state: user?.serviceState,
  })

  return {
    ...defaultUser,
    ...(user ?? {}),
    id: user?.id ?? null,
    cep: formatCep(user?.cep ?? defaultUser.cep),
    serviceCep: formatCep(user?.serviceCep ?? ''),
    address: personalAddress || user?.address || (user ? '' : defaultUser.address),
    serviceAddress: serviceAddress || user?.serviceAddress || '',
    interests: Array.isArray(user?.interests) ? user.interests : defaultUser.interests,
    isCollaborator: Boolean(user?.isCollaborator),
    addressVisible: Boolean(user?.addressVisible),
    useDifferentServiceAddress: Boolean(user?.useDifferentServiceAddress),
    serviceAddressVisible: user?.serviceAddressVisible ?? true,
    role: user?.role ?? 'user',
  }
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

  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
  if (!response.ok) {
    throw new Error('Não foi possível consultar o CEP.')
  }

  const data = await response.json()
  if (data.erro) {
    throw new Error('CEP não encontrado.')
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
    city: normalized.city,
    state: normalized.state,
    address_visible: normalized.addressVisible,
    interests: normalized.interests,
    is_collaborator: normalized.isCollaborator,
    offered_services: normalized.offeredServices,
    service_address: normalized.serviceAddress,
    service_address_visible: normalized.serviceAddressVisible,
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
    city: user.city,
    state: user.state,
    addressVisible: user.address_visible,
    interests: user.interests,
    isCollaborator: user.is_collaborator,
    offeredServices: user.offered_services,
    serviceAddress: user.service_address,
    serviceAddressVisible: user.service_address_visible,
    role: user.role,
  })
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
      return {
        name: parts[0] || 'Contato importado',
        phone: parts[1] || '0000',
        service: parts[2] || 'contato importado',
        city: parts[3] || 'Minha região',
        address: parts[4] || '',
      }
    })
    .filter((item) => item.name && item.phone)
    .slice(0, 200)
}

function googlePersonToContact(person, index) {
  const phone = person.phoneNumbers?.[0]?.canonicalForm || person.phoneNumbers?.[0]?.value || ''
  const name = person.names?.[0]?.displayName || person.emailAddresses?.[0]?.value || `Contato Google ${index + 1}`
  const occupation = person.occupations?.[0]?.value
  const organization = person.organizations?.[0]?.title || person.organizations?.[0]?.name
  const address = person.addresses?.[0]?.formattedValue || ''

  return {
    name,
    phone: phone || `google-${index + 1}`,
    service: occupation || organization || 'contato importado',
    city: '',
    address,
    source: 'Google People API',
  }
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

async function requestGoogleToken() {
  const google = await loadGoogleIdentity()
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_CONTACTS_SCOPE,
      prompt: 'consent',
      callback: (response) => {
        if (response?.access_token) {
          resolve(response.access_token)
        } else {
          reject(new Error(response?.error_description || 'Permissão do Google não concluída.'))
        }
      },
      error_callback: () => reject(new Error('Permissão do Google cancelada.')),
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

async function getGoogleProfileAndContacts() {
  const accessToken = await requestGoogleToken()
  const [profile, contacts] = await Promise.all([fetchGoogleProfile(accessToken), fetchGoogleContacts(accessToken)])
  return { profile, contacts }
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
  const isAdmin = user?.role === 'admin'
  const isAuthPage = route.page === 'login' || route.page === 'register'
  const tabs = [
    { label: 'Agenda', path: ROUTES.AGENDA, icon: ContactRound, page: 'agenda' },
    { label: 'Mapa', path: ROUTES.MAP, icon: Map, page: 'map' },
    { label: 'Grupos', path: ROUTES.GROUPS, icon: UsersRound, page: 'groups' },
  ]

  if (isAdmin) {
    tabs.push({ label: 'Conexões', path: ROUTES.CONNECTIONS, icon: ShieldCheck, page: 'connections' })
  }

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-[#060d1a] text-slate-100">
        <main className="mx-auto min-w-0 max-w-6xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060d1a] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-[#1e293b] bg-[#060d1a]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <button type="button" onClick={() => onNavigate(ROUTES.AGENDA)} className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
              <Zap size={19} />
            </span>
            <span className="truncate text-sm font-black tracking-normal">
              NETWORK<span className="text-cyan-400">.AGENDA</span>
            </span>
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            {tabs.map((tab) => (
              <button
                key={tab.path}
                type="button"
                onClick={() => onNavigate(tab.path)}
                className={[
                  'inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold transition',
                  route.page === tab.page ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:bg-slate-900 hover:text-cyan-300',
                ].join(' ')}
              >
                <tab.icon size={17} />
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-[#0d1a2e] px-2.5 py-1.5 text-xs font-bold text-slate-400 sm:inline-flex">
              <Circle size={9} className={online ? 'fill-emerald-500 text-emerald-500' : 'fill-slate-300 text-slate-300'} />
              {online ? 'online' : 'offline'}
            </span>
            <button type="button" className="relative rounded-lg border border-slate-800 bg-[#0d1a2e] p-2 text-slate-400" aria-label="Atividade">
              <Bell size={18} />
              {unread > 0 ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-black text-white">{unread}</span> : null}
            </button>
            <button
              type="button"
              onClick={() => onNavigate(user ? ROUTES.REGISTER : ROUTES.LOGIN)}
              className="hidden h-10 items-center gap-2 rounded-lg border border-slate-800 bg-[#0d1a2e] px-2.5 text-sm font-bold text-slate-300 sm:inline-flex"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-xs font-black">{initials(user?.name ?? 'EU')}</span>
              {user?.name ?? 'Entrar'}
            </button>
            {user ? (
              <button type="button" onClick={onLogout} className="hidden rounded-lg border border-slate-800 bg-[#0d1a2e] p-2 text-slate-400 sm:inline-flex" aria-label="Sair">
                <LogOut size={18} />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto min-w-0 max-w-6xl px-4 pb-24 pt-4 sm:px-6 sm:pb-10 sm:pt-6">{children}</main>

      {!isAuthPage ? (
        <nav className="fixed inset-x-3 bottom-3 z-40 grid rounded-lg border border-[#1e293b] bg-[#0d1a2e]/95 p-1.5 shadow-lg shadow-black/30 backdrop-blur md:hidden" style={{ gridTemplateColumns: `repeat(${Math.min(tabs.length, 4)}, minmax(0, 1fr))` }}>
          {tabs.slice(0, 4).map((tab) => (
            <button
              key={tab.path}
              type="button"
              onClick={() => onNavigate(tab.path)}
              className={[
                'flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-bold transition',
                route.page === tab.page ? 'bg-cyan-500 text-slate-950' : 'text-slate-400',
              ].join(' ')}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </nav>
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
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-800 bg-[#0d1a2e] px-3 shadow-sm focus-within:border-cyan-500">
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
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-lg border border-slate-800 bg-[#0d1a2e] shadow-xl shadow-black/30">
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
    <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-black uppercase tracking-widest text-cyan-400">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-black tracking-normal text-slate-100 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl break-words text-sm font-medium text-slate-500">{description}</p> : null}
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
    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-4 lg:grid-cols-8">
      <button
        type="button"
        onClick={() => (onSelect ? onSelect('all') : onNavigate('/categoria/all'))}
        className={[
          'flex min-h-20 min-w-0 flex-col justify-between rounded-lg border p-3 text-left transition',
          activeCategory === 'all' ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200' : 'border-[#1e293b] bg-[#0d1a2e] text-slate-300 hover:border-cyan-500/50',
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
        'flex min-h-20 min-w-0 flex-col justify-between rounded-lg border p-3 text-left transition',
        active ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200' : 'border-[#1e293b] bg-[#0d1a2e] text-slate-300 hover:border-cyan-500/50',
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
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black text-white sm:h-11 sm:w-11" style={{ backgroundColor: category.color }}>
      {initials(contact.name)}
    </span>
  )
}

function ContactRow({ contact, onDelete, onToast, onEdit }) {
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
    <article className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-b border-slate-800 bg-[#0d1a2e] px-3 py-3 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-3 sm:px-4">
      <ContactAvatar contact={contact} />
      <button type="button" onClick={() => onEdit(contact)} className="min-w-0 flex-1 text-left" aria-label={`Editar ${contact.name}`}>
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[15px] font-black text-slate-100">{contact.name}</h3>
          {contact.trust === 'Favorito' ? <Sparkles size={15} className="shrink-0 text-amber-500" /> : null}
        </div>
        <p className="truncate text-sm font-semibold text-slate-400">{contact.service}</p>
        <p className="truncate text-xs font-medium text-slate-500">{contact.phone} - {contact.city}</p>
      </button>
      <div className="hidden shrink-0 items-center gap-1 sm:flex">
        <button type="button" onClick={() => onEdit(contact)} className="rounded-lg bg-slate-900 p-2 text-slate-300" aria-label={`Editar ${contact.name}`}>
          <Pencil size={16} />
        </button>
        <button type="button" onClick={callContact} className="rounded-lg bg-slate-900 p-2 text-slate-300" aria-label={`Ligar para ${contact.name}`}>
          <Phone size={17} />
        </button>
        <button type="button" onClick={openWhatsApp} className="rounded-lg bg-emerald-50 p-2 text-emerald-700" aria-label={`WhatsApp de ${contact.name}`}>
          <MessageCircle size={17} />
        </button>
        <button type="button" onClick={() => onDelete(contact.id)} className="hidden rounded-lg bg-rose-50 p-2 text-rose-700 sm:inline-flex" aria-label={`Remover ${contact.name}`}>
          <X size={17} />
        </button>
      </div>
    </article>
  )
}

function ContactList({ contacts, onDelete, onToast, onEdit = () => {}, emptyLabel = 'Nenhum contato encontrado.' }) {
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
      <div className="rounded-lg border border-dashed border-slate-800 bg-[#0d1a2e] p-8 text-center">
        <ContactRound className="mx-auto text-slate-700" size={34} />
        <p className="mt-3 text-sm font-black text-slate-200">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#1e293b] bg-[#0d1a2e]">
      {letters.map((letter) => (
        <section key={letter}>
          <div className="border-b border-slate-800 bg-[#08111f] px-4 py-1.5 text-xs font-black text-slate-500">{letter}</div>
          {grouped[letter].map((contact) => (
            <ContactRow key={contact.id} contact={contact} onDelete={onDelete} onToast={onToast} onEdit={onEdit} />
          ))}
        </section>
      ))}
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

function AgendaPage({ contacts, activeCategory, queryDraft, setQueryDraft, onSearch, recents, onDelete, onToast, onEdit, onNavigate, onImport, isImporting }) {
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
            <input ref={fileInputRef} type="file" accept=".csv,.txt,.vcf" onChange={onImport} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-800 bg-[#0d1a2e] px-3 text-sm font-black text-slate-300">
              <Upload size={17} />
              {isImporting ? 'Importando' : 'Importar'}
            </button>
            <button type="button" onClick={() => onNavigate(ROUTES.NEW)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-black text-white">
              <Plus size={17} />
              Novo
            </button>
          </div>
        }
      />
      <CategoryButtons contacts={contacts} activeCategory={activeCategory} onNavigate={onNavigate} onSelect={(id) => onNavigate(`/categoria/${id}`)} />
      <SearchBox value={queryDraft} onChange={setQueryDraft} onSearch={onSearch} recents={recents} contacts={contacts} />
      <ContactList contacts={filtered} onDelete={onDelete} onToast={onToast} onEdit={onEdit} emptyLabel={selectedCategory ? `Nenhum contato em ${selectedCategory.label}.` : 'Nenhum contato encontrado.'} />
    </div>
  )
}

function CategoryPage({ categoryId, contacts, publicProfiles, user, onNavigate, onDelete, onToast, onEdit, onOpenGroup }) {
  const category = getCategory(categoryId)
  const title = category ? category.label : 'Tudo'
  const filteredContacts =
    categoryId === 'all'
      ? contacts
      : contacts.filter((contact) => (contact.category?.id ?? classifyService(contact.service).id) === categoryId)
  const groups = categoryId === 'all' ? getRecommendedGroups(publicProfiles, user, '') : publicProfiles.filter((profile) => (profile.category?.id ?? classifyService(profile.service).id) === categoryId)

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => onNavigate(ROUTES.AGENDA)} className="inline-flex items-center gap-2 text-sm font-black text-slate-500">
        <ArrowLeft size={16} />
        Voltar
      </button>
      <PageTitle eyebrow="Categoria" title={title} description={`${filteredContacts.length} contatos privados e ${groups.length} sugestões de grupos.`} />
      <CategoryButtons contacts={contacts} activeCategory={categoryId} onNavigate={onNavigate} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ContactList contacts={filteredContacts} onDelete={onDelete} onToast={onToast} onEdit={onEdit} emptyLabel="Nenhum contato nessa categoria." />
        <section>
          <h2 className="mb-2 text-base font-black text-slate-100">Grupos sugeridos</h2>
          <div className="grid gap-3">
            {groups.map((profile) => (
              <PublicGroupCard key={profile.id} profile={profile} onOpen={onOpenGroup} />
            ))}
          </div>
        </section>
      </div>
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
          className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-left text-sm font-semibold text-slate-200 hover:border-cyan-500/60"
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
      <form onSubmit={submit} noValidate className="rounded-lg border border-[#1e293b] bg-[#0d1a2e] p-4 shadow-sm sm:p-5">
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

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
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

        <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-cyan-300">
            <Sparkles size={20} />
          </span>
          <span>
            <span className="block text-sm font-black text-slate-100">{inferredCategory?.label ?? 'Categoria automática'}</span>
            <span className="text-sm font-medium text-slate-500">{inferredCategory?.group ?? 'Criada a partir do serviço informado'}</span>
          </span>
        </div>
        <button type="submit" className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white">
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
    note: '',
    city: contact.city ?? '',
    address: contact.address ?? '',
    trust: contact.trust ?? 'Novo',
    source: contact.source ?? 'Manual',
  }
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
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-lg border border-[#1e293b] bg-[#0d1a2e] p-4 shadow-2xl sm:p-5">
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

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
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

function GroupsPage({ publicProfiles, user, queryDraft, setQueryDraft, onSearch, recents, contacts, onOpenGroup }) {
  const groups = getRecommendedGroups(publicProfiles, user, queryDraft)

  return (
    <div className="space-y-4">
      <PageTitle eyebrow="Grupos" title="Sugestões por interesse" description="Os grupos são priorizados pelos interesses salvos no cadastro e pela busca atual." />
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

  return (
    <article className="rounded-lg border border-[#1e293b] bg-[#0d1a2e] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: category.color }}>
          <UsersRound size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-black leading-5 text-slate-100">{profile.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-500">{profile.service}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Metric value={profile.people} label="membros" />
        <Metric value={profile.response} label="resposta" />
        <Metric value={profile.score} label="score" />
      </div>
      <button type="button" onClick={() => onOpen(profile)} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 text-sm font-black text-slate-200">
        Abrir grupo
        <ArrowRight size={16} />
      </button>
    </article>
  )
}

function Metric({ value, label }) {
  return (
    <div className="rounded-lg bg-slate-950/40 px-2 py-2">
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

  return (
    <div className="space-y-4">
      <PageTitle
        eyebrow="Network.map"
        title="Mapa da rede"
        description="Mapa do Google com distâncias a partir do endereço do usuário. Defina VITE_GOOGLE_MAPS_API_KEY para carregar a API completa."
        action={
          <button type="button" onClick={() => onNavigate(ROUTES.REGISTER)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-800 bg-[#0d1a2e] px-3 text-sm font-black text-slate-300">
            <MapPin size={17} />
            Endereço
          </button>
        }
      />
      <GoogleNetworkMap user={user} contacts={mapItems} />
    </div>
  )
}

function GoogleNetworkMap({ user, contacts }) {
  const mapRef = useRef(null)
  const [status, setStatus] = useState(GOOGLE_MAPS_API_KEY ? 'loading' : 'fallback')
  const [distances, setDistances] = useState([])
  const visibleContacts = useMemo(() => contacts.slice(0, 8), [contacts])
  const centerAddress = user?.address || defaultUser.address

  useEffect(() => {
    let cancelled = false
    if (!GOOGLE_MAPS_API_KEY) {
      setDistances(
        visibleContacts.map((contact) => ({
          id: contact.id,
          name: contact.name,
          service: contact.service,
          address: contactAddress(contact),
          distance: estimateFallbackDistance(centerAddress, contactAddress(contact)) ?? 'calcular no Google Maps',
          duration: '',
        })),
      )
      return undefined
    }

    async function renderMap() {
      try {
        const maps = await loadGoogleMaps()
        if (cancelled || !mapRef.current) return

        const geocoder = new maps.Geocoder()
        const origin = await geocodeAddress(geocoder, centerAddress)
        const map = new maps.Map(mapRef.current, {
          center: origin,
          zoom: 11,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
        })

        new maps.Marker({
          map,
          position: origin,
          title: user?.name ?? 'Você',
          label: 'EU',
        })

        const bounds = new maps.LatLngBounds(origin)
        const locatedContacts = []

        for (const contact of visibleContacts) {
          const destinationAddress = contactAddress(contact)
          try {
            const position = await geocodeAddress(geocoder, destinationAddress)
            locatedContacts.push({ contact, position, address: destinationAddress })
            bounds.extend(position)
            new maps.Marker({
              map,
              position,
              title: contact.name,
              label: initials(contact.name).slice(0, 2),
            })
            new maps.Polyline({
              map,
              path: [origin, position],
              strokeColor: (contact.category ?? classifyService(contact.service)).color,
              strokeOpacity: 0.45,
              strokeWeight: 2,
            })
          } catch {
            locatedContacts.push({ contact, position: null, address: destinationAddress })
          }
        }

        if (locatedContacts.some((item) => item.position)) {
          map.fitBounds(bounds)
        }

        const service = new maps.DistanceMatrixService()
        service.getDistanceMatrix(
          {
            origins: [centerAddress],
            destinations: locatedContacts.map((item) => item.address),
            travelMode: maps.TravelMode.DRIVING,
            unitSystem: maps.UnitSystem.METRIC,
          },
          (response, serviceStatus) => {
            if (cancelled) return
            if (serviceStatus !== 'OK') {
              setDistances(
                locatedContacts.map(({ contact, address }) => ({
                  id: contact.id,
                  name: contact.name,
                  service: contact.service,
                  address,
                  distance: estimateFallbackDistance(centerAddress, address) ?? 'indisponível',
                  duration: '',
                })),
              )
              setStatus('ready')
              return
            }

            const elements = response.rows[0]?.elements ?? []
            setDistances(
              locatedContacts.map(({ contact, address }, index) => ({
                id: contact.id,
                name: contact.name,
                service: contact.service,
                address,
                distance: elements[index]?.distance?.text ?? 'indisponível',
                duration: elements[index]?.duration?.text ?? '',
              })),
            )
            setStatus('ready')
          },
        )
      } catch {
        if (!cancelled) setStatus('fallback')
      }
    }

    renderMap()
    return () => {
      cancelled = true
    }
  }, [centerAddress, user?.name, visibleContacts])

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="overflow-hidden rounded-lg border border-[#1e293b] bg-[#0d1a2e] shadow-sm">
        {status === 'fallback' ? (
          <iframe
            title="Google Maps"
            src={`https://www.google.com/maps?q=${encodeURIComponent(centerAddress)}&output=embed`}
            className="h-[420px] w-full border-0 sm:h-[560px]"
            loading="lazy"
          />
        ) : (
          <div ref={mapRef} className="h-[420px] w-full sm:h-[560px]" />
        )}
      </div>
      <aside className="space-y-3">
        <div className="rounded-lg border border-[#1e293b] bg-[#0d1a2e] p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Origem</p>
          <p className="mt-1 text-sm font-black text-slate-100">{user?.name ?? 'Você'}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">{centerAddress}</p>
          {status === 'fallback' ? (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-bold text-amber-800">
              Configure VITE_GOOGLE_MAPS_API_KEY para geocodificar contatos e calcular rotas pela API do Google Maps.
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border border-[#1e293b] bg-[#0d1a2e] shadow-sm">
          <div className="border-b border-slate-800 px-4 py-3">
            <p className="text-sm font-black text-slate-100">Distâncias</p>
          </div>
          {distances.map((item) => (
            <div key={item.id} className="flex items-start gap-3 border-b border-slate-800 px-4 py-3 last:border-b-0">
              <Route size={18} className="mt-0.5 shrink-0 text-cyan-700" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-100">{item.name}</p>
                <p className="truncate text-xs font-semibold text-slate-500">{item.service}</p>
                <p className="mt-1 text-sm font-black text-slate-700">{item.distance} {item.duration ? `- ${item.duration}` : ''}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
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

function LoginPage({ onLogin, onGoogleLogin, onSaveUser, onImportContacts, onImportGoogleContacts }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('ana@network.local')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('')

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
    <AuthLayout title="Acesso" description="Entre na sua rede ou crie seu cadastro com endereço, telefone e perfil de colaborador.">
      <div className="mb-4 grid grid-cols-2 rounded-lg border border-slate-800 bg-slate-950/40 p-1">
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
              mode === id ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-cyan-300',
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
          {status ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-bold text-rose-200">{status}</p> : null}
          <button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 text-sm font-black text-slate-950">
            <LogIn size={18} />
            Entrar
          </button>
          <button
            type="button"
            onClick={async () => {
              setStatus('')
              try {
                await onGoogleLogin()
              } catch (error) {
                setStatus(error.message || 'Não foi possível entrar com Google.')
              }
            }}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 text-sm font-black text-slate-200"
          >
            <Cloud size={18} />
            Entrar com Google
          </button>
        </form>
      ) : (
        <UserProfileForm
          initialUser={defaultUser}
          submitLabel="Criar cadastro"
          onSubmit={(nextUser, pendingContacts) => onSaveUser({ ...nextUser, role: 'user' }, pendingContacts)}
          onImportContacts={onImportContacts}
          onImportGoogleContacts={onImportGoogleContacts}
        />
      )}
    </AuthLayout>
  )
}

function RegisterPage({ user, onSaveUser, onImportContacts, onImportGoogleContacts, onNavigate }) {
  return (
    <AuthLayout title="Perfil" description="Atualize seus dados, endereço, interesses e se você também oferece serviços na rede.">
      <UserProfileForm initialUser={user ?? defaultUser} submitLabel={user ? 'Salvar perfil' : 'Criar cadastro'} onSubmit={onSaveUser} onImportContacts={onImportContacts} onImportGoogleContacts={onImportGoogleContacts} />
      <button type="button" onClick={() => onNavigate(ROUTES.LOGIN)} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-800 text-sm font-black text-slate-300">
        <LogIn size={17} />
        Trocar usuário
      </button>
    </AuthLayout>
  )
}

function UserProfileForm({ initialUser, submitLabel, onSubmit, onImportContacts, onImportGoogleContacts }) {
  const [draft, setDraft] = useState(normalizeUserDraft(initialUser))
  const [cepStatus, setCepStatus] = useState({ personal: '', service: '' })
  const [importStatus, setImportStatus] = useState('')
  const [pendingImportedContacts, setPendingImportedContacts] = useState([])
  const [errors, setErrors] = useState({})
  const isCreating = submitLabel.toLowerCase().includes('criar')

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
      if (!contacts?.length) {
        setImportStatus('Nenhum contato do Google disponível para importar.')
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

  function toggleInterest(id) {
    setDraft((current) => {
      const hasInterest = current.interests.includes(id)
      return {
        ...current,
        interests: hasInterest ? current.interests.filter((item) => item !== id) : [...current.interests, id],
      }
    })
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = {
      name: draft.name.trim() ? '' : 'Obrigatório.',
      email: draft.email.trim() ? '' : 'Obrigatório.',
      birthDate: draft.birthDate ? '' : 'Obrigatória.',
      phone: draft.phone.trim() ? '' : 'Obrigatório.',
      password: !isCreating || draft.password.trim() ? '' : 'Obrigatória.',
      cep: isValidCep(draft.cep) ? '' : 'CEP obrigatório e válido.',
      offeredServices: draft.isCollaborator && !draft.offeredServices.trim() ? 'Obrigatório para colaboradores.' : '',
      serviceCep: draft.isCollaborator && draft.useDifferentServiceAddress && !isValidCep(draft.serviceCep) ? 'CEP obrigatório e válido.' : '',
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
      await lookupCep(draft.cep)
      if (draft.isCollaborator && draft.useDifferentServiceAddress) {
        await lookupCep(draft.serviceCep)
      }
    } catch (error) {
      setCepStatus((current) => ({ ...current, personal: error.message }))
      return
    }

    onSubmit(normalizeUserDraft(draft), pendingImportedContacts)
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <section className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
        <p className="text-xs font-black uppercase tracking-widest text-cyan-400">Comece pela agenda</p>
        <p className="mt-1 text-sm font-semibold text-slate-400">Importe contatos no início do cadastro para separar tudo por tags e categorias automaticamente.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={importGoogleContacts} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-800 bg-[#0d1a2e] px-3 text-sm font-black text-slate-200">
            <Cloud size={17} />
            Google
          </button>
          <button type="button" onClick={importPhoneContacts} className="h-10 rounded-lg border border-slate-800 bg-[#0d1a2e] px-3 text-sm font-black text-slate-200">
            Contatos do telefone
          </button>
        </div>
        {importStatus ? <p className="mt-2 text-xs font-bold text-slate-500">{importStatus}</p> : null}
      </section>

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
        <Field label="Número do endereço">
          <input value={draft.addressNumber} onChange={(event) => updateDraft('addressNumber', event.target.value)} className="field-input" placeholder="Número" />
        </Field>
        <Field label="Complemento">
          <input value={draft.addressComplement} onChange={(event) => updateDraft('addressComplement', event.target.value)} className="field-input" placeholder="Apto, bloco, sala" />
        </Field>
        <Field label="Bairro">
          <input value={draft.neighborhood} onChange={(event) => updateDraft('neighborhood', event.target.value)} className="field-input" placeholder="Bairro" />
        </Field>
        <Field label="Cidade/UF">
          <input value={[draft.city, draft.state].filter(Boolean).join(' - ')} readOnly className="field-input" placeholder="Localizado pelo CEP" />
        </Field>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm font-bold text-slate-300">
        <input
          type="checkbox"
          checked={draft.addressVisible}
          onChange={(event) => updateDraft('addressVisible', event.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block text-slate-100">Mostrar meu endereço para outras pessoas</span>
          <span className="block text-xs font-semibold text-slate-500">Se desativado, o app usa o endereço para mapa e sugestões, mas não exibe públicamente.</span>
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm font-bold text-slate-300">
        <input
          type="checkbox"
          checked={draft.isCollaborator}
          onChange={(event) => updateDraft('isCollaborator', event.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block text-slate-100">Sou colaborador</span>
          <span className="block text-xs font-semibold text-slate-500">Ative se você também oferece serviços para outras pessoas da rede.</span>
        </span>
      </label>

      {draft.isCollaborator ? (
        <Field label="Serviços oferecidos" required error={errors.offeredServices}>
          <input
            value={draft.offeredServices}
            onChange={(event) => updateDraft('offeredServices', event.target.value)}
            className={inputClass(errors.offeredServices)}
            placeholder="Ex: eletricista, designer, contabilidade"
          />
        </Field>
      ) : null}

      {draft.isCollaborator ? (
        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
          <label className="flex items-start gap-3 text-sm font-bold text-slate-300">
            <input
              type="checkbox"
              checked={draft.useDifferentServiceAddress}
              onChange={(event) => updateDraft('useDifferentServiceAddress', event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block text-slate-100">Usar outro endereço válido para meus serviços</span>
              <span className="block text-xs font-semibold text-slate-500">Esse endereço também precisa de CEP validado.</span>
            </span>
          </label>

          {draft.useDifferentServiceAddress ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="CEP de atendimento" required error={errors.serviceCep}>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input value={draft.serviceCep} onChange={(event) => updateDraft('serviceCep', formatCep(event.target.value))} className={inputClass(errors.serviceCep)} inputMode="numeric" placeholder="00000-000" />
                    <button type="button" onClick={() => findCep('service')} className="h-11 shrink-0 rounded-lg bg-cyan-500 px-3 text-sm font-black text-slate-950">
                      Localizar
                    </button>
                  </div>
                  {cepStatus.service ? <span className="mt-1 block text-xs font-bold text-slate-500">{cepStatus.service}</span> : null}
                </Field>
                <Field label="Rua de atendimento">
                  <input value={draft.serviceAddressLine} onChange={(event) => updateDraft('serviceAddressLine', event.target.value)} className="field-input" placeholder="Rua" />
                </Field>
                <Field label="Número">
                  <input value={draft.serviceAddressNumber} onChange={(event) => updateDraft('serviceAddressNumber', event.target.value)} className="field-input" placeholder="Número" />
                </Field>
                <Field label="Complemento">
                  <input value={draft.serviceAddressComplement} onChange={(event) => updateDraft('serviceAddressComplement', event.target.value)} className="field-input" placeholder="Sala, loja, referencia" />
                </Field>
                <Field label="Bairro">
                  <input value={draft.serviceNeighborhood} onChange={(event) => updateDraft('serviceNeighborhood', event.target.value)} className="field-input" placeholder="Bairro" />
                </Field>
                <Field label="Cidade/UF">
                  <input value={[draft.serviceCity, draft.serviceState].filter(Boolean).join(' - ')} readOnly className="field-input" placeholder="Localizado pelo CEP" />
                </Field>
              </div>
              <label className="flex items-start gap-3 text-sm font-bold text-slate-300">
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
            </>
          ) : null}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Interesses</p>
        <div className="grid grid-cols-2 gap-2">
          {categoryCatalog.map((category) => {
            const selected = draft.interests.includes(category.id)
            const Icon = category.icon
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => toggleInterest(category.id)}
                className={[
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-black',
                  selected ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200' : 'border-slate-800 bg-[#0d1a2e] text-slate-300',
                ].join(' ')}
              >
                <Icon size={16} />
                <span className="truncate">{category.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 text-sm font-black text-slate-950">
        <Check size={18} />
        {submitLabel}
      </button>
    </form>
  )
}

function AuthLayout({ title, description, children }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-lg bg-slate-950 p-6 text-white sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500 text-slate-950">
          <Zap size={24} />
        </div>
        <h1 className="mt-6 text-3xl font-black tracking-normal">{title}</h1>
        <p className="mt-2 max-w-md text-sm font-medium text-slate-300">{description}</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <AuthFeature icon={MapPin} label="Endereço" />
          <AuthFeature icon={SlidersHorizontal} label="Interesses" />
          <AuthFeature icon={ShieldCheck} label="Perfil" />
        </div>
      </section>
      <section className="rounded-lg border border-[#1e293b] bg-[#0d1a2e] p-4 shadow-sm sm:p-5">{children}</section>
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
      <div className="mx-auto max-w-md rounded-lg border border-[#1e293b] bg-[#0d1a2e] p-6 text-center shadow-sm">
        <Lock className="mx-auto text-slate-300" size={36} />
        <h1 className="mt-3 text-xl font-black text-slate-100">Área administrativa</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">Conexões ficam visíveis somente para administradores.</p>
        <button type="button" onClick={() => onNavigate(ROUTES.LOGIN)} className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white">
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
        <AdminMetric icon={UsersRound} label="Grupos" value={publicProfiles.length} />
      </section>
      <section className="rounded-lg border border-[#1e293b] bg-[#0d1a2e] shadow-sm">
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
    <div className="rounded-lg border border-[#1e293b] bg-[#0d1a2e] p-4 shadow-sm">
      <Icon size={20} className="text-cyan-700" />
      <p className="mt-3 text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-100">{value}</p>
    </div>
  )
}

function GroupModal({ profile, onClose, onToast }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center">
      <div className="w-full max-w-lg rounded-lg border border-[#1e293b] bg-[#0d1a2e] p-4 shadow-2xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-cyan-700">Grupo</p>
            <h2 className="mt-1 text-xl font-black text-slate-100">{profile.name}</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">{profile.service}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-900 p-2 text-slate-400" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric value={profile.people} label="membros" />
          <Metric value={profile.response} label="resposta" />
          <Metric value={profile.score} label="score" />
        </div>
        <button
          type="button"
          onClick={() => onToast('Grupo verificado e recomendado pela rede.')}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-black text-white"
        >
          <MessageCircle size={18} />
          Abrir grupo verificado
        </button>
      </div>
    </div>
  )
}

function Toast({ message }) {
  if (!message) return null

  return (
    <div className="fixed right-4 top-20 z-50 flex max-w-sm items-center gap-2 rounded-lg border border-[#1e293b] bg-[#0d1a2e] px-4 py-3 text-sm font-black text-slate-100 shadow-xl">
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
    cep: '',
    addressLine: '',
    addressNumber: '',
    addressComplement: '',
    neighborhood: '',
    state: '',
  }
  const [form, setForm] = useState(emptyContactForm)
  const [toast, setToast] = useState('')
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [editingContact, setEditingContact] = useState(null)
  const [newCount, setNewCount] = useState(0)
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    const handlePopState = () => setRoute(parsePath())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const contactsPath = user ? `/api/contacts?user_id=${encodeURIComponent(contactOwnerId(user))}` : null
        const [remoteContacts, remoteProfiles, remoteUsers] = await Promise.all([
          contactsPath ? apiRequest(contactsPath) : Promise.resolve([]),
          apiRequest('/api/public-profiles'),
          apiRequest('/api/users'),
        ])
        if (cancelled) return
        setContacts(remoteContacts)
        setPublicProfiles(remoteProfiles)
        setNetworkUsers(remoteUsers.map(apiUserToLocal).filter(Boolean))
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

  function updateForm(field, value) {
    if (typeof field === 'object') {
      setForm(field)
      return
    }
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function saveImportedContact(payload, owner = user) {
    let newContact = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      owner_id: contactOwnerId(owner),
      city: payload.city || 'Minha região',
      address: payload.address || payload.city || '',
      trust: 'Novo',
      source: 'Importado',
      note: '',
      ...payload,
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
    return saved
  }

  async function requestGoogleContacts() {
    const { contacts: googleContacts } = await getGoogleProfileAndContacts()
    return googleContacts
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
      trust: 'Novo',
      source: 'Manual',
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
    showToast('Contato removido.')
  }

  async function saveEditedContact(nextContact) {
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
    }

    let saved = { ...nextContact, ...payload, category: classifyService(payload.service) }
    try {
      saved = await apiRequest(`/api/contacts/${nextContact.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      setBackendOnline(true)
    } catch {
      setBackendOnline(false)
    }

    setContacts((current) => current.map((contact) => (contact.id === nextContact.id ? saved : contact)))
    setEditingContact(null)
    showToast('Contato atualizado.')
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
    localStorage.setItem('network-agenda-user', JSON.stringify(loggedUser))
    showToast('Login realizado.')
    navigate(ROUTES.AGENDA)
  }

  async function loginWithGoogle() {
    const { profile, contacts: googleContacts } = await getGoogleProfileAndContacts()
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
    localStorage.setItem('network-agenda-user', JSON.stringify(loggedUser))
    const imported = await importContactsForOwner(googleContacts, loggedUser)
    showToast(imported.length ? `Login Google realizado e ${imported.length} contatos importados.` : 'Login Google realizado.')
    navigate(ROUTES.AGENDA)
  }

  async function saveUser(nextUser, pendingContacts = []) {
    let savedUser = normalizeUserDraft(nextUser)
    try {
      const response = await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(userToApiPayload(savedUser)),
      })
      savedUser = apiUserToLocal(response) ?? savedUser
      setBackendOnline(true)
    } catch {
      setBackendOnline(false)
    }
    setUser(savedUser)
    setNetworkUsers((current) => {
      const others = current.filter((item) => normalize(item.email) !== normalize(savedUser.email))
      return [savedUser, ...others]
    })
    localStorage.setItem('network-agenda-user', JSON.stringify(savedUser))
    if (pendingContacts.length) {
      await importContactsForOwner(pendingContacts, savedUser)
    }
    showToast('Cadastro salvo.')
    navigate(ROUTES.AGENDA)
  }

  function logout() {
    setUser(null)
    localStorage.removeItem('network-agenda-user')
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
  const isAuthRoute = route.page === 'login' || route.page === 'register'
  const effectiveRoute = !user && !isAuthRoute ? { page: 'login', categoryId: null } : route

  let page
  if (effectiveRoute.page === 'login') {
    page = <LoginPage onLogin={loginUser} onGoogleLogin={loginWithGoogle} onSaveUser={saveUser} onImportContacts={importContactsFromProfile} onImportGoogleContacts={requestGoogleContacts} />
  } else if (effectiveRoute.page === 'register') {
    page = <RegisterPage user={user} onSaveUser={saveUser} onImportContacts={importContactsFromProfile} onImportGoogleContacts={requestGoogleContacts} onNavigate={navigate} />
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
        onToast={showToast}
        onNavigate={navigate}
        onImport={handleImportFile}
        isImporting={isImporting}
      />
    )
  } else if (effectiveRoute.page === 'new') {
    page = <NewContactPage form={form} updateForm={updateForm} addContact={addContact} inferredCategory={inferredCategory} onNavigate={navigate} />
  } else if (effectiveRoute.page === 'map') {
    page = <MapPage contacts={contactsWithCategory} users={networkUsers} user={user} onNavigate={navigate} />
  } else if (effectiveRoute.page === 'groups') {
    page = (
      <GroupsPage
        publicProfiles={publicProfilesWithCategory}
        user={user}
        queryDraft={queryDraft}
        setQueryDraft={setQueryDraft}
        onSearch={onSearch}
        recents={recents}
        contacts={contactsWithCategory}
        onOpenGroup={setSelectedGroup}
      />
    )
  } else if (effectiveRoute.page === 'connections') {
    page = <ConnectionsPage user={user} contacts={contactsWithCategory} publicProfiles={publicProfilesWithCategory} backendOnline={backendOnline} onNavigate={navigate} />
  } else {
    page = <AgendaPage contacts={contactsWithCategory} activeCategory="all" queryDraft={queryDraft} setQueryDraft={setQueryDraft} onSearch={onSearch} recents={recents} onDelete={deleteContact} onEdit={setEditingContact} onToast={showToast} onNavigate={navigate} onImport={handleImportFile} isImporting={isImporting} />
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
