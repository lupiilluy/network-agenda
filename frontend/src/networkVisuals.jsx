import { useEffect, useMemo, useRef, useState } from 'react'
import { Map, Navigation, Route, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'

const GRAPH_PALETTE = {
  contact: '#F20574',
  tag: '#A127F2',
  ddd: '#F29F05',
  structure: '#030140',
  accent: '#F26835',
}

const CATS = [
  { id: 'home', label: 'Casa', col: '#10b981' },
  { id: 'legal', label: 'Juridico', col: '#3b82f6' },
  { id: 'business', label: 'Negocios', col: '#f59e0b' },
  { id: 'tech', label: 'Tech', col: '#06b6d4' },
]

const generalCategory = {
  id: 'general',
  label: 'Serviços gerais',
  color: '#64748b',
}

const GRAPH_FILTER_LABELS = {
  all: 'Tudo',
  home: 'Casa',
  legal: 'Jurídico',
  business: 'Negócios',
  tech: 'Tech',
  groups: 'Grupos',
  interno: 'Interno',
  grupo: 'Grupo',
  publico: 'Público',
  tag: 'Tags',
  source: 'Fontes',
  ddd: 'DDDs',
  demand: 'Demandas',
  solve: 'Soluções',
  match: 'Matches',
  link: 'Vínculos',
  org: 'Empresas',
}

const GRAPH_SEMANTIC_FILTERS = new Set(['interno', 'grupo', 'publico', 'tag', 'source', 'ddd', 'demand', 'solve', 'match', 'link', 'org'])

const fallbackCoordinates = {
  'avenida paulista': { lat: -23.561684, lng: -46.656139 },
  pinheiros: { lat: -23.567011, lng: -46.701989 },
  osasco: { lat: -23.532905, lng: -46.791637 },
  'santo andre': { lat: -23.66389, lng: -46.53833 },
  'rio de janeiro': { lat: -22.906847, lng: -43.172897 },
  centro: { lat: -23.55052, lng: -46.633308 },
  campinas: { lat: -22.90556, lng: -47.06083 },
  curitiba: { lat: -25.4284, lng: -49.2733 },
  salvador: { lat: -12.9714, lng: -38.5014 },
  brasilia: { lat: -15.793889, lng: -47.882778 },
  recife: { lat: -8.0476, lng: -34.877 },
}

const dddCoordinates = {
  '11': { label: 'São Paulo e ABC', query: 'São Paulo, SP', lat: -23.55052, lng: -46.633308 },
  '21': { label: 'Rio de Janeiro', query: 'Rio de Janeiro, RJ', lat: -22.906847, lng: -43.172897 },
  '31': { label: 'Belo Horizonte', query: 'Belo Horizonte, MG', lat: -19.916681, lng: -43.934493 },
  '41': { label: 'Curitiba', query: 'Curitiba, PR', lat: -25.4284, lng: -49.2733 },
  '51': { label: 'Porto Alegre', query: 'Porto Alegre, RS', lat: -30.034647, lng: -51.217658 },
  '61': { label: 'Brasília', query: 'Brasília, DF', lat: -15.793889, lng: -47.882778 },
  '71': { label: 'Salvador', query: 'Salvador, BA', lat: -12.9714, lng: -38.5014 },
  '81': { label: 'Recife', query: 'Recife, PE', lat: -8.0476, lng: -34.877 },
}

let googleMapsPromise

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function matchText(query, values) {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return true
  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean)
  const haystack = values.map((value) => normalize(value)).filter(Boolean).join(' ')
  return queryTerms.every((term) => haystack.includes(term))
}

function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'NA'
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function uniqueTextOptions(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

function graphFilterLabel(value) {
  return GRAPH_FILTER_LABELS[value] ?? value
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

function extractDdd(phone) {
  let digits = onlyDigits(phone)
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2)
  if (digits.length < 10) return ''
  return digits.slice(0, 2)
}

function findFallbackCoordinate(address) {
  const normalized = normalize(address)
  const key = Object.keys(fallbackCoordinates).find((item) => normalized.includes(item))
  return key ? fallbackCoordinates[key] : null
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

function dddLocation(phone, structuredDdd = '') {
  const ddd = structuredDdd || extractDdd(phone)
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
  const byDdd = dddLocation(person?.phone, person?.ddd)
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

async function geocodeAddressQuery(query, apiRequest) {
  const trimmed = String(query ?? '').trim()
  if (trimmed.length < 3) throw new Error('Informe uma rua ou endereço.')
  const response = await apiRequest(`/api/address/lookup?query=${encodeURIComponent(trimmed)}`)
  const results = Array.isArray(response?.results) ? response.results : response ? [response] : []
  const result = results.find((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
  return result ? { ...result, lat: Number(result.lat), lng: Number(result.lng) } : null
}

function hasGraphTag(item) {
  const categoryId = item.category?.id ?? graphCatId(item)
  return categoryId && categoryId !== generalCategory.id
}

function contactCustomFieldSearchValues(contact) {
  return (contact?.custom_field_values ?? []).map((field) => {
    if (Array.isArray(field?.value)) return field.value.join(' ')
    return String(field?.value ?? '')
  }).filter(Boolean)
}

function tagList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean)
  }
  return String(value ?? '')
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function graphPositionFromCoords(coords, originCoords = null, scale = 8) {
  if (!coords) return null
  if (originCoords) {
    return {
      x: (coords.lng - originCoords.lng) * 450,
      y: (originCoords.lat - coords.lat) * 450,
    }
  }
  return {
    x: coords.lng * scale,
    y: coords.lat * -scale,
  }
}

function graphCatId(contact) {
  const raw = contact?.cat ?? contact?.category?.id ?? contact?.category
  const text = normalize([raw, contact?.svc, contact?.service, contact?.category?.label].filter(Boolean).join(' '))
  if (text.includes('legal') || text.includes('jurid') || text.includes('advog')) return 'legal'
  if (text.includes('tech') || text.includes('design') || text.includes('site') || text.includes('software')) return 'tech'
  if (text.includes('business') || text.includes('negocio') || text.includes('financ') || text.includes('contador') || text.includes('mei')) return 'business'
  return 'home'
}

function graphContactSemanticTypes(contact) {
  const types = new Set(Array.isArray(contact?.scopes) ? contact.scopes : [])
  if (contact?.tags?.length) types.add('tag')
  if (contact?.src || contact?.source) types.add('source')
  if (contact?.ddd) types.add('ddd')
  if (contact?.demand?.trim()) types.add('demand')
  if (contact?.solves?.trim()) types.add('solve')
  if (contact?.potentialMatches?.length) types.add('match')
  if (contact?.linkedPlatform) types.add('link')
  if (contact?.organization || contact?.company || contact?.org) types.add('org')
  return [...types]
}

function Field({ label, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-500">{label}</span>
      {children}
    </label>
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

function PublicProfileText({ label, value }) {
  return (
    <div className="glass-panel rounded-lg p-4">
      <h2 className="text-sm font-black text-slate-100">{label}</h2>
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

function GraphWorkspace({ title, description, contextLabel, items, emptyLabel, onOpenItem }) {
  const [query, setQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [dddFilter, setDddFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [onlyDemand, setOnlyDemand] = useState(false)
  const [onlySolves, setOnlySolves] = useState(false)
  const [onlyLinked, setOnlyLinked] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')

  const tagOptions = useMemo(() => uniqueTextOptions(items.flatMap((item) => item.tags ?? [])), [items])
  const sourceOptions = useMemo(() => uniqueTextOptions(items.map((item) => item.source)), [items])
  const dddOptions = useMemo(() => uniqueTextOptions(items.map((item) => item.ddd)), [items])
  const groupOptions = useMemo(() => {
    const all = []
    items.forEach((item) => {
      ;(item.groupNames ?? []).forEach((groupName, index) => {
        all.push({ id: item.groupIds?.[index] ?? groupName, name: groupName })
      })
    })
    const seen = new Set()
    return all.filter((item) => {
      const key = `${item.id}:${item.name}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [items])

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (query.trim() && !matchText(query, [item.name, item.service, item.city, item.source, item.ddd, item.description, item.demand, item.solves, ...(item.demandTags ?? []), ...(item.tags ?? []), ...(item.groupNames ?? [])])) return false
      if (scopeFilter !== 'all' && !(item.scopes ?? []).includes(scopeFilter)) return false
      if (tagFilter !== 'all' && !(item.tags ?? []).some((tag) => normalize(tag) === normalize(tagFilter))) return false
      if (sourceFilter !== 'all' && normalize(item.source) !== normalize(sourceFilter)) return false
      if (dddFilter !== 'all' && String(item.ddd || '') !== String(dddFilter)) return false
      if (groupFilter !== 'all' && !(item.groupIds ?? []).includes(groupFilter)) return false
      if (onlyDemand && !item.demand?.trim()) return false
      if (onlySolves && !item.solves?.trim()) return false
      if (onlyLinked && !item.linkedPlatform) return false
      return true
    })
  }, [items, query, scopeFilter, tagFilter, sourceFilter, dddFilter, groupFilter, onlyDemand, onlySolves, onlyLinked])

  useEffect(() => {
    if (!visibleItems.length) {
      setSelectedId('')
      return
    }
    if (!visibleItems.some((item) => item.id === selectedId)) {
      setSelectedId(visibleItems[0].id)
    }
  }, [visibleItems, selectedId])

  const selectedItem = visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0] ?? null
  const graphItems = useMemo(
    () =>
      visibleItems.map((item) => ({
        id: item.id,
        originalId: item.id,
        name: item.name,
        svc: item.service,
        city: item.city,
        trust: item.linkedPlatform ? 'Conectado' : 'Novo',
        src: item.source,
        note: [item.demand, item.solves, (item.tags ?? []).slice(0, 3).join(', ')].filter(Boolean).join(' · '),
        cat: item.category?.id ?? graphCatId(item),
        tags: item.tags ?? [],
        ddd: item.ddd ?? '',
        demand: item.demand ?? '',
        solves: item.solves ?? '',
        scopes: item.scopes ?? [],
      })),
    [visibleItems],
  )

  const summary = {
    nodes: visibleItems.length,
    tags: new Set(visibleItems.flatMap((item) => item.tags ?? []).filter(Boolean)).size,
    sources: new Set(visibleItems.map((item) => item.source).filter(Boolean)).size,
    ddds: new Set(visibleItems.map((item) => item.ddd).filter(Boolean)).size,
    demand: visibleItems.filter((item) => item.demand?.trim()).length,
    solves: visibleItems.filter((item) => item.solves?.trim()).length,
    linked: visibleItems.filter((item) => item.linkedPlatform).length,
    orgs: visibleItems.filter((item) => [item.organization, item.company, item.org].some(Boolean)).length,
  }
  const activeFilterCount = [
    scopeFilter !== 'all',
    tagFilter !== 'all',
    sourceFilter !== 'all',
    dddFilter !== 'all',
    groupFilter !== 'all',
    onlyDemand,
    onlySolves,
    onlyLinked,
  ].filter(Boolean).length

  function clearGraphFilters() {
    setQuery('')
    setScopeFilter('all')
    setTagFilter('all')
    setSourceFilter('all')
    setDddFilter('all')
    setGroupFilter('all')
    setOnlyDemand(false)
    setOnlySolves(false)
    setOnlyLinked(false)
  }

  return (
    <section className="glass-panel rounded-lg p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-cyan-400">{contextLabel}</p>
          <h2 className="mt-1 text-xl font-black text-slate-100">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-black text-cyan-100">{summary.tags} tags</span>
            <span className="rounded-full border border-blue-400/15 bg-blue-400/10 px-3 py-1 text-[11px] font-black text-blue-100">{summary.sources} fontes</span>
            <span className="rounded-full border border-amber-400/15 bg-amber-400/10 px-3 py-1 text-[11px] font-black text-amber-100">{summary.ddds} DDDs</span>
            <span className="rounded-full border border-rose-400/15 bg-rose-400/10 px-3 py-1 text-[11px] font-black text-rose-100">{summary.demand} demandas</span>
            <span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1 text-[11px] font-black text-emerald-100">{summary.solves} soluções</span>
            <span className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-black text-cyan-100">{summary.linked} vínculos</span>
            <span className="rounded-full border border-slate-400/15 bg-slate-400/10 px-3 py-1 text-[11px] font-black text-slate-100">{summary.orgs} empresas</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric value={summary.nodes} label="nós" />
          <Metric value={summary.tags} label="tags" />
          <Metric value={summary.ddds} label="DDDs" />
          <Metric value={summary.linked} label="vínculos" />
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_320px]">
        <div className="space-y-3">
          <div className="glass-panel-soft rounded-lg p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <Field label="Busca no grafo">
                <div className="glass-panel-soft flex min-w-0 items-center gap-2 rounded-lg px-3">
                  <Search size={17} className="shrink-0 text-slate-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-600"
                    placeholder="nome, demanda, solução, tag, DDD..."
                  />
                </div>
              </Field>
              <div className="flex items-center gap-2 lg:self-end">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((current) => !current)}
                  className={['inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-black', filtersOpen ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100' : 'border-slate-800 text-slate-300'].join(' ')}
                >
                  <SlidersHorizontal size={15} />
                  Filtros
                  {activeFilterCount ? <span className="rounded-full bg-cyan-400 px-2 py-0.5 text-[10px] font-black text-slate-950">{activeFilterCount}</span> : null}
                </button>
                {activeFilterCount ? (
                  <button type="button" onClick={clearGraphFilters} className="inline-flex h-10 items-center rounded-lg border border-slate-800 px-3 text-xs font-black text-slate-400">
                    Limpar
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {scopeFilter !== 'all' ? <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-black text-cyan-100">Tipo: {graphFilterLabel(scopeFilter)}</span> : null}
              {tagFilter !== 'all' ? <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-[11px] font-black text-violet-100">Tag: {tagFilter}</span> : null}
              {sourceFilter !== 'all' ? <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-black text-sky-100">Fonte: {sourceFilter}</span> : null}
              {dddFilter !== 'all' ? <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-black text-amber-100">DDD: {dddFilter}</span> : null}
              {groupFilter !== 'all' ? <span className="rounded-full border border-slate-400/20 bg-slate-400/10 px-3 py-1 text-[11px] font-black text-slate-100">Grupo: {groupOptions.find((group) => group.id === groupFilter)?.name ?? 'selecionado'}</span> : null}
              {onlyDemand ? <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-[11px] font-black text-rose-100">Com demanda</span> : null}
              {onlySolves ? <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-black text-emerald-100">Resolve problema</span> : null}
              {onlyLinked ? <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-black text-cyan-100">Vínculo com plataforma</span> : null}
            </div>

            {filtersOpen ? (
              <div className="mt-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Field label="Tipo">
                    <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)} className="field-input h-10">
                      <option value="all">Todos</option>
                      <option value="interno">Interno</option>
                      <option value="grupo">Grupo</option>
                      <option value="publico">Público</option>
                    </select>
                  </Field>
                  <Field label="Tag">
                    <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} className="field-input h-10">
                      <option value="all">Todas</option>
                      {tagOptions.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                    </select>
                  </Field>
                  <Field label="Fonte">
                    <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="field-input h-10">
                      <option value="all">Todas</option>
                      {sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
                    </select>
                  </Field>
                  <Field label="DDD">
                    <select value={dddFilter} onChange={(event) => setDddFilter(event.target.value)} className="field-input h-10">
                      <option value="all">Todos</option>
                      {dddOptions.map((ddd) => <option key={ddd} value={ddd}>{ddd}</option>)}
                    </select>
                  </Field>
                  {groupOptions.length ? (
                    <Field label="Grupo">
                      <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="field-input h-10">
                        <option value="all">Todos</option>
                        {groupOptions.map((group) => <option key={`${group.id}-${group.name}`} value={group.id}>{group.name}</option>)}
                      </select>
                    </Field>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setScopeFilter('interno')} className={['rounded-lg px-3 py-2 text-xs font-black', scopeFilter === 'interno' ? 'bg-cyan-500 text-slate-950' : 'border border-slate-800 text-slate-300'].join(' ')}>
                    Interno
                  </button>
                  <button type="button" onClick={() => setScopeFilter('grupo')} className={['rounded-lg px-3 py-2 text-xs font-black', scopeFilter === 'grupo' ? 'bg-cyan-500 text-slate-950' : 'border border-slate-800 text-slate-300'].join(' ')}>
                    Grupo
                  </button>
                  <button type="button" onClick={() => setScopeFilter('publico')} className={['rounded-lg px-3 py-2 text-xs font-black', scopeFilter === 'publico' ? 'bg-cyan-500 text-slate-950' : 'border border-slate-800 text-slate-300'].join(' ')}>
                    Público
                  </button>
                  <button type="button" onClick={() => setOnlyDemand((current) => !current)} className={['rounded-lg px-3 py-2 text-xs font-black', onlyDemand ? 'bg-cyan-500 text-slate-950' : 'border border-slate-800 text-slate-300'].join(' ')}>
                    Com demanda
                  </button>
                  <button type="button" onClick={() => setOnlySolves((current) => !current)} className={['rounded-lg px-3 py-2 text-xs font-black', onlySolves ? 'bg-cyan-500 text-slate-950' : 'border border-slate-800 text-slate-300'].join(' ')}>
                    Resolve problema
                  </button>
                  <button type="button" onClick={() => setOnlyLinked((current) => !current)} className={['rounded-lg px-3 py-2 text-xs font-black', onlyLinked ? 'bg-cyan-500 text-slate-950' : 'border border-slate-800 text-slate-300'].join(' ')}>
                    Vínculo com plataforma
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {visibleItems.length ? (
            <NetworkGraph items={graphItems} selectedId={selectedItem?.id} onSelect={setSelectedId} showCategoryFilter={false} label="NETWORK · INTELLIGENCE GRAPH" />
          ) : (
            <div className="rounded-lg border border-dashed border-slate-800 p-6 text-sm font-semibold text-slate-500">{emptyLabel}</div>
          )}
        </div>

        <aside className="space-y-3">
          <div className="glass-panel-soft rounded-lg p-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-cyan-300" />
              <p className="text-sm font-black text-slate-100">Leitura ativa</p>
            </div>
            {selectedItem ? (
              <div className="mt-3">
                <p className="text-base font-black text-slate-100">{selectedItem.name}</p>
                <p className="mt-1 text-sm font-semibold text-slate-400">{selectedItem.service}</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">{selectedItem.city}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(selectedItem.scopes ?? []).map((scope) => <span key={scope} className="rounded-md border border-cyan-400/10 bg-cyan-400/10 px-2 py-1 text-[11px] font-black text-cyan-100">{scope}</span>)}
                </div>
                {selectedItem.tags?.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedItem.tags.slice(0, 8).map((tag) => <span key={tag} className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-[11px] font-black text-slate-300">{tag}</span>)}
                  </div>
                ) : null}
                <div className="mt-3 grid gap-2 text-sm">
                  <DetailRow label="Fonte" value={selectedItem.source || 'Não informada'} />
                  <DetailRow label="DDD" value={selectedItem.ddd || 'Não identificado'} />
                  <DetailRow label="Grupos" value={selectedItem.groupNames?.length ? selectedItem.groupNames.join(', ') : 'Nenhum'} />
                  <DetailRow label="Vínculo com a plataforma" value={selectedItem.linkedPlatform ? selectedItem.linkedLabel || 'Sim' : 'Não'} />
                </div>
                {selectedItem.demand ? <PublicProfileText label="Demanda" value={selectedItem.demand} /> : null}
                {selectedItem.solves ? <div className="mt-2"><PublicProfileText label="Resolve" value={selectedItem.solves} /></div> : null}
                {selectedItem.actionLabel ? (
                  <button type="button" onClick={() => onOpenItem(selectedItem)} className="secondary-button mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg px-3 text-sm font-black">
                    {selectedItem.actionLabel}
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm font-semibold text-slate-500">Selecione um nó do grafo ou da lista para inspecionar a conexão.</p>
            )}
          </div>

          <div className="glass-panel-soft rounded-lg">
            <div className="border-b border-slate-800 px-3 py-3">
              <p className="text-sm font-black text-slate-100">Nós filtrados</p>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {visibleItems.length ? visibleItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={['flex w-full items-start gap-3 border-b border-slate-800 px-3 py-3 text-left last:border-b-0', selectedItem?.id === item.id ? 'bg-cyan-500/10' : 'hover:bg-slate-950/40'].join(' ')}
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white" style={{ backgroundColor: item.category?.color ?? generalCategory.color }}>
                    {initials(item.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-100">{item.name}</span>
                    <span className="block truncate text-xs font-semibold text-slate-500">{item.service}</span>
                    <span className="mt-1 block truncate text-[11px] font-bold text-cyan-300">{item.source} {item.ddd ? `· DDD ${item.ddd}` : ''}</span>
                  </span>
                </button>
              )) : <p className="p-4 text-sm font-semibold text-slate-500">{emptyLabel}</p>}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

function NetworkGraphMap({ user, contacts, apiRequest, googleMapsApiKey }) {
  const [serviceQuery, setServiceQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [graphReady, setGraphReady] = useState(true)
  const [geocodedLocations, setGeocodedLocations] = useState({})
  const centerAddress = user?.address || 'São Paulo, SP'
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
          next[geocodeKey(query)] = await geocodeAddressQuery(query, apiRequest)
        } catch {
          next[geocodeKey(query)] = null
        }
        if (cancelled) return
      }
      setGeocodedLocations((current) => ({ ...current, ...next }))
    }

    void loadGeocodes()
    return () => {
      cancelled = true
    }
  }, [addressQueries, apiRequest, geocodedLocations])

  const enrichedItems = useMemo(
    () =>
      contacts
        .map((contact) => {
          const category = contact.category ?? generalCategory
          const baseContact = { ...contact, category }
          if (!hasGraphTag(baseContact)) return null
          const rawAddress = contact.address || contact.city || ''
          const location = withGeocodedLocation(resolveMapLocation(contact, rawAddress), geocodedLocations)
          const distanceKm = originLocation.coords && location.coords ? distanceBetweenCoordinates(originLocation.coords, location.coords) : null
          const graphPoint = graphPositionFromCoords(location.coords, originLocation.coords)
          const usesDdd = originLocation.source.includes('ddd') || location.source.includes('ddd')
          return {
            ...contact,
            category,
            address: rawAddress || location.query,
            locationLabel: location.label,
            locationQuery: location.query,
            locationSource: location.source,
            locationSourceLabel: location.sourceLabel,
            ddd: contact.ddd || extractDdd(contact.phone),
            distanceKm,
            distanceLabel: formatDistanceKm(distanceKm),
            distanceSourceLabel: distanceKm === null ? 'sem DDD/localização' : usesDdd ? 'por DDD' : location.source.startsWith('address') ? 'por endereço' : 'estimada',
            graphX: graphPoint?.x,
            graphY: graphPoint?.y,
            graphZ: distanceKm === null ? 0 : Math.max(0, 75 - Math.min(75, distanceKm / 2)),
          }
        })
        .filter((contact) => contact?.name && contact.locationQuery),
    [contacts, geocodedLocations, originLocation],
  )

  const serviceOptions = useMemo(() => {
    const options = []
    for (const item of enrichedItems) {
      const label = item.category?.label || generalCategory.label
      if (!options.some((option) => normalize(option) === normalize(label))) options.push(label)
      if (options.length >= 7) break
    }
    return options
  }, [enrichedItems])

  const nearbyItems = useMemo(() => {
    const query = serviceQuery.trim()
    return enrichedItems
      .filter((contact) => !query || matchText(query, [contact.name, contact.service, contact.category?.label, contact.category?.group, contact.city, contact.address, contact.ddd, contact.locationLabel, contact.organization, contact.demand, contact.demand_tags, contact.solves, ...contactCustomFieldSearchValues(contact)]))
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

      <GoogleLocationMap
        user={user}
        centerAddress={originLocation.query}
        contacts={nearbyItems.slice(0, 10)}
        selectedContact={selectedContact}
        onSelect={setSelectedId}
        googleMapsApiKey={googleMapsApiKey}
      />
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

function NetworkGraph({
  contacts,
  items,
  query = '',
  selectedId,
  onSelect,
  showCategoryFilter = true,
  filterOptions = ['all', 'home', 'legal', 'business', 'tech', 'groups', 'interno', 'grupo', 'publico', 'tag', 'source', 'ddd', 'demand', 'solve', 'link', 'org'],
  label = 'NETWORK · GRAFO 3D',
}) {
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
    const source = Array.isArray(contacts) ? contacts : Array.isArray(items) ? items : []
    return source.map((contact, index) => {
      const categoryId = graphCatId(contact)
      const tags = Array.isArray(contact?.tags)
        ? contact.tags
        : Array.isArray(contact?.tag_items)
          ? contact.tag_items.map((item) => String(item?.name ?? item ?? '').trim()).filter(Boolean)
          : []
      return {
        id: String(contact.id ?? `c${index + 1}`),
        originalId: contact.originalId ?? contact.id,
        name: contact.name ?? 'Contato',
        svc: contact.svc ?? contact.service ?? contact.category?.label ?? 'serviço',
        city: contact.city ?? contact.locationLabel ?? contact.area ?? 'Rede',
        trust: contact.trust ?? contact.roleLabel ?? (index % 3 === 0 ? 'Recomendado' : index % 3 === 1 ? 'Favorito' : 'Confiavel'),
        roleLabel: contact.roleLabel ?? '',
        src: contact.src ?? contact.source ?? 'Agenda',
        note: contact.note ?? contact.crm_note ?? contact.distanceLabel ?? '',
        cat: categoryId,
        tags,
        phone: contact.phone ?? contact.whatsapp ?? '',
        email: contact.email ?? '',
        ddd: contact.ddd ?? extractDdd(contact.phone || contact.whatsapp || ''),
        demand: contact.demand ?? contact.publicDemand ?? '',
        demandTags: contact.demandTags ?? [],
        solves: contact.solves ?? contact.publicSolves ?? contact.publicDescription ?? contact.offeredServices ?? '',
        organization: contact.organization ?? contact.company ?? contact.org ?? '',
        scopes: contact.scopes ?? [],
        groupIds: contact.groupIds ?? [],
        groupNames: contact.groupNames ?? [],
        distanceLabel: contact.distanceLabel ?? '',
        distanceSourceLabel: contact.distanceSourceLabel ?? '',
        locationLabel: contact.locationLabel ?? contact.city ?? '',
        locationQuery: contact.locationQuery ?? contact.address ?? contact.city ?? '',
        locationSourceLabel: contact.locationSourceLabel ?? contact.source ?? '',
        potentialMatches: Array.isArray(contact.potentialMatches) ? contact.potentialMatches : [],
        linkedPlatform: Boolean(contact.linkedPlatform),
        linkedLabel: contact.linkedLabel ?? '',
        graphX: contact.graphX,
        graphY: contact.graphY,
        graphZ: contact.graphZ,
        kind: contact.kind || 'contact',
        people: contact.people ?? 0,
        resp: contact.resp ?? '',
        score: contact.score ?? 0,
      }
    })
  }, [contacts, items])

  useEffect(() => {
    const canvas = cvRef.current
    if (!canvas) return undefined

    let { W, H, DPR } = resizeGraphCanvas(canvas)
    let nodes = []
    let edges = []
    const ctx = canvas.getContext('2d')

    function buildNodes(width, height) {
      return buildCanvasGraph(graphContacts, query, width, height)
    }

    function rebuild() {
      ;({ nodes, edges } = buildNodes(W, H))
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
      if (hit && ['contact', 'group', 'member'].includes(hit.kind) && onSelect) onSelect(hit.originalId ?? hit.id)
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
        const cam = camRef.current
        cam.theta += (x - state.lmx) * 0.007
        cam.phi += (y - state.lmy) * 0.007
        state.lmx = x
        state.lmy = y
      } else if (event.touches.length === 2) {
        const next = touchDistance(event.touches)
        camRef.current.dist = clampGraph(state.startDist - (next - state.pinch) * 0.9, 200, 800)
      }
    }

    function onTouchEnd() {
      stateRef.current.dragging = false
    }

    function render() {
      const state = stateRef.current
      state.tick += 1
      if (state.autoRot) camRef.current.theta += 0.0022
      camRef.current.phi = clampGraph(camRef.current.phi, -0.95, 0.95)
      renderCanvasGraph(ctx, W, H, DPR, nodes, edges, camRef.current, state, nodesRef)
      rafRef.current = window.requestAnimationFrame(render)
    }

    function onResize() {
      ;({ W, H, DPR } = resizeGraphCanvas(canvas))
      rebuild()
    }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('mouseleave', onMouseLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)
    window.addEventListener('resize', onResize)
    rafRef.current = window.requestAnimationFrame(render)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('resize', onResize)
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    }
  }, [graphContacts, onSelect, query])

  useEffect(() => {
    stateRef.current.autoRot = autoRot
  }, [autoRot])

  useEffect(() => {
    stateRef.current.filter = filter
  }, [filter])

  return (
    <div className="glass-panel overflow-hidden rounded-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div>
          <p className="text-sm font-black text-slate-100">{label}</p>
          <p className="text-xs font-semibold text-slate-500">canvas 3D leve para mobile e desktop</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showCategoryFilter ? (
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="field-input h-9 min-w-[130px]">
              {filterOptions.map((option) => <option key={option} value={option}>{graphFilterLabel(option)}</option>)}
            </select>
          ) : null}
          <button type="button" onClick={() => setAutoRot((current) => !current)} className="secondary-button inline-flex h-9 items-center rounded-lg px-3 text-xs font-black">
            {autoRot ? 'Pausar rotação' : 'Retomar rotação'}
          </button>
        </div>
      </div>

      <canvas ref={cvRef} className="block w-full touch-none" />

      {hovData ? (
        <div className="border-t border-slate-800 bg-slate-950/60 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-100">{hovData.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{hovData.svc || hovData.semanticKind || hovData.city || 'Nó de contexto'}</p>
            </div>
            {'score' in hovData && hovData.score ? <span className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-black text-cyan-200">{hovData.score}</span> : null}
          </div>
        </div>
      ) : null}

      <div className="border-t border-cyan-900/30 bg-[#040c18] px-4 py-2 font-mono text-[10px] text-slate-600">{infoText}</div>
    </div>
  )
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

function graphNodePalette(node, depthBright, hover) {
  if (node.kind === 'contact') {
    const base = GRAPH_PALETTE.contact
    return { fill: hexA(base, 0.96), stroke: hover ? hexA('#ffffff', 0.95) : hexA(base, 0.82), glow: hexA(base, 0.18), label: hexA('#f8fafc', 0.95), sublabel: hexA('#cbd5e1', 0.75) }
  }
  if (node.kind === 'semantic') {
    if (node.semanticType === 'tag') {
      const base = GRAPH_PALETTE.tag
      return { fill: hexA(base, 0.96), stroke: hover ? hexA('#ffffff', 0.95) : hexA(base, 0.82), glow: hexA(base, 0.18), label: hexA('#f5f3ff', 0.96), sublabel: hexA('#cbd5e1', 0.75) }
    }
    if (node.semanticType === 'ddd') {
      const base = GRAPH_PALETTE.ddd
      return { fill: hexA(base, 0.96), stroke: hover ? hexA('#ffffff', 0.95) : hexA(base, 0.82), glow: hexA(base, 0.18), label: hexA('#fff7ed', 0.96), sublabel: hexA('#cbd5e1', 0.75) }
    }
    return { fill: hexA('#0f172a', 0.86 + 0.02 * depthBright), stroke: hover ? hexA('#ffffff', 0.84) : hexA('#94a3b8', 0.28), glow: hexA('#94a3b8', 0.04 + 0.02 * depthBright), label: hexA('#e2e8f0', 0.95), sublabel: hexA('#94a3b8', 0.7) }
  }
  if (node.kind === 'cat') {
    return { fill: hexA('#0f172a', 0.92), stroke: hover ? hexA('#ffffff', 0.84) : hexA('#64748b', 0.24), glow: hexA('#64748b', 0.03 + 0.02 * depthBright), label: hexA('#ffffff', 0.88), sublabel: hexA('#94a3b8', 0.65) }
  }
  if (node.kind === 'group') {
    return { fill: hexA('#0f172a', 0.9), stroke: hover ? hexA('#ffffff', 0.84) : hexA('#64748b', 0.22), glow: hexA('#64748b', 0.03 + 0.02 * depthBright), label: hexA('#cbd5e1', 0.92), sublabel: hexA('#94a3b8', 0.65) }
  }
  return { fill: hexA('#0f172a', 0.92), stroke: hover ? '#ffffff' : hexA('#94a3b8', 0.22), glow: hexA('#94a3b8', 0.04), label: '#e2e8f0', sublabel: '#94a3b8' }
}

function graphSlug(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'item'
}

function truncateGraphText(value, max = 24) {
  const text = String(value ?? '').trim()
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function buildCanvasGraph(contacts, query, W, H) {
  const q = normalize(query)
  const filteredContacts = (contacts ?? [])
    .filter((contact) => !q || matchText(q, [
      contact.name,
      contact.svc,
      contact.city,
      contact.trust,
      contact.src,
      contact.note,
      contact.cat,
      contact.ddd,
      contact.demand,
      contact.solves,
      contact.roleLabel,
      contact.locationLabel,
      contact.phone,
      contact.email,
      contact.linkedLabel,
      contact.organization,
      contact.company,
      contact.org,
      ...(contact.demandTags ?? []),
      ...(contact.tags ?? []),
      ...(contact.groupNames ?? []),
    ]))
    .slice(0, 72)

  const nodes = [{ id: 'you', name: 'YOU', label: 'YOU', x: 0, y: 0, z: 0, r: 22, col: GRAPH_PALETTE.structure, kind: 'hub', catId: 'hub', alpha: 1 }]
  const edges = []
  const catNodeIds = new globalThis.Map()
  const groupNodeIds = new globalThis.Map()
  const contactNodeMap = new globalThis.Map()
  const semanticBuckets = new globalThis.Map()
  const semanticNodeIds = new globalThis.Map()
  const semanticSpecs = [
    { key: 'tag', label: 'tag', ring: 204, z: -18, color: GRAPH_PALETTE.tag, limit: 12, size: 11, phase: 0.18, extract: (contact) => tagList(contact.tags), keyOf: (value) => normalize(value), fullOf: (value) => String(value ?? '').trim(), displayOf: (value) => String(value ?? '').trim() },
    { key: 'source', label: 'fonte', ring: 286, z: 18, color: GRAPH_PALETTE.structure, limit: 8, size: 10, phase: 0.44, extract: (contact) => [contact.src ?? contact.source].filter(Boolean), keyOf: (value) => normalize(value), fullOf: (value) => String(value ?? '').trim(), displayOf: (value) => String(value ?? '').trim() },
    {
      key: 'ddd',
      label: 'ddd',
      ring: 326,
      z: -10,
      color: GRAPH_PALETTE.ddd,
      limit: 8,
      size: 8,
      phase: 0.73,
      extract: (contact) => (contact.ddd ? [String(contact.ddd).replace(/\D/g, '')] : []),
      keyOf: (value) => normalize(String(value ?? '').replace(/\D/g, '')),
      fullOf: (value) => {
        const digits = String(value ?? '').replace(/\D/g, '')
        return digits ? `DDD ${digits}` : ''
      },
      displayOf: (value) => {
        const digits = String(value ?? '').replace(/\D/g, '')
        return digits ? `DDD ${digits}` : ''
      },
    },
    { key: 'demand', label: 'demanda', ring: 244, z: 24, color: GRAPH_PALETTE.accent, limit: 8, size: 10, phase: -0.24, extract: (contact) => [contact.demand].filter(Boolean), keyOf: (value) => normalize(value), fullOf: (value) => String(value ?? '').trim(), displayOf: (value) => truncateGraphText(value, 26) },
    { key: 'solve', label: 'resolve', ring: 364, z: -22, color: GRAPH_PALETTE.accent, limit: 8, size: 10, phase: -0.5, extract: (contact) => [contact.solves].filter(Boolean), keyOf: (value) => normalize(value), fullOf: (value) => String(value ?? '').trim(), displayOf: (value) => truncateGraphText(value, 26) },
    { key: 'link', label: 'usuário', ring: 266, z: 14, color: GRAPH_PALETTE.structure, limit: 12, size: 11, phase: 0.82, extract: (contact) => (contact.linkedPlatform && contact.linkedLabel ? [contact.linkedLabel] : []), keyOf: (value) => normalize(value), fullOf: (value) => String(value ?? '').trim(), displayOf: (value) => String(value ?? '').trim() },
    { key: 'org', label: 'empresa', ring: 410, z: 30, color: GRAPH_PALETTE.structure, limit: 8, size: 10, phase: 1.1, extract: (contact) => [contact.organization, contact.company, contact.org].filter(Boolean), keyOf: (value) => normalize(value), fullOf: (value) => String(value ?? '').trim(), displayOf: (value) => truncateGraphText(value, 28) },
  ]

  function addSemanticBucket(spec, value, contactId, catId, scopeTypes = []) {
    const fullLabel = spec.fullOf(value)
    const bucketKeyValue = spec.keyOf(value)
    if (!fullLabel || !bucketKeyValue) return
    const key = `${spec.key}:${bucketKeyValue}`
    const current = semanticBuckets.get(key) ?? {
      key,
      specKey: spec.key,
      semanticLabel: spec.label,
      label: fullLabel,
      displayLabel: spec.displayOf(value) || fullLabel,
      count: 0,
      contactIds: new Set(),
      catIds: new Set(),
      scopeTypes: new Set(),
      color: spec.color,
    }
    current.count += 1
    current.contactIds.add(contactId)
    current.catIds.add(catId)
    scopeTypes.forEach((scope) => current.scopeTypes.add(scope))
    if (fullLabel.length > current.label.length) current.label = fullLabel
    const displayLabel = spec.displayOf(value) || fullLabel
    if (displayLabel.length > current.displayLabel.length) current.displayLabel = displayLabel
    semanticBuckets.set(key, current)
  }

  CATS.forEach((cat, index) => {
    const angle = (Math.PI * 2 * index) / CATS.length
    const id = `cat-${cat.id}`
    catNodeIds.set(cat.id, id)
    nodes.push({ id, name: cat.label, label: cat.label, x: Math.cos(angle) * 150, y: Math.sin(angle) * 150, z: 0, r: 14, col: GRAPH_PALETTE.structure, kind: 'cat', catId: cat.id, alpha: 1 })
    edges.push({ a: 'you', b: id, k: 'hub', catId: cat.id, col: GRAPH_PALETTE.accent })
  })

  const contactsByCat = new globalThis.Map()
  const contactNodeIdsByCity = new globalThis.Map()
  filteredContacts.forEach((contact) => {
    const catId = CATS.some((cat) => cat.id === contact.cat) ? contact.cat : 'home'
    if (!contactsByCat.has(catId)) contactsByCat.set(catId, [])
    contactsByCat.get(catId).push(contact)

    semanticSpecs.forEach((spec) => {
      const extracted = spec.extract(contact) ?? []
      const seen = new Set()
      extracted.forEach((value) => {
        const normalizedValue = spec.keyOf(value)
        if (!normalizedValue || seen.has(normalizedValue)) return
        seen.add(normalizedValue)
        addSemanticBucket(spec, value, `contact-${contact.id}`, catId, contact.scopes ?? [])
      })
    })

    const cityKey = normalize(contact.city)
    if (cityKey) {
      if (!contactNodeIdsByCity.has(cityKey)) contactNodeIdsByCity.set(cityKey, [])
      contactNodeIdsByCity.get(cityKey).push(`contact-${contact.id}`)
    }
  })

  contactsByCat.forEach((bucket, catId) => {
    const catIndex = Math.max(0, CATS.findIndex((cat) => cat.id === catId))
    const base = (Math.PI * 2 * catIndex) / CATS.length
    bucket.forEach((contact, index) => {
      const angle = base + 0.35 * (index % 2 === 0 ? 1 : -1)
      const id = `contact-${contact.id}`
      nodes.push({
        ...contact,
        id,
        originalId: contact.originalId ?? contact.id,
        x: Math.cos(angle) * 265,
        y: Math.sin(angle) * 265,
        z: (index % 3 - 1) * 45,
        r: 19,
        col: GRAPH_PALETTE.contact,
        kind: contact.kind || 'contact',
        catId,
        semanticTypes: Array.isArray(contact.semanticTypes) ? contact.semanticTypes : graphContactSemanticTypes(contact),
        alpha: 1,
      })
      contactNodeMap.set(id, contact)
      edges.push({ a: catNodeIds.get(catId), b: id, k: 'contact', catId })
    })
  })

  semanticSpecs.forEach((spec) => {
    const bucketValues = [...semanticBuckets.values()].filter((item) => item.specKey === spec.key).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, spec.limit)
    const total = Math.max(bucketValues.length, 1)
    bucketValues.forEach((bucket, index) => {
      const angle = (Math.PI * 2 * index) / total + spec.phase
      const id = `semantic-${spec.key}-${graphSlug(bucket.label)}`
      semanticNodeIds.set(bucket.key, id)
      nodes.push({
        id,
        name: bucket.label,
        label: bucket.displayLabel,
        svc: spec.label,
        city: `${bucket.count} contato${bucket.count === 1 ? '' : 's'}`,
        x: Math.cos(angle) * spec.ring,
        y: Math.sin(angle) * spec.ring,
        z: spec.z + (index % 2 === 0 ? 14 : -14),
        r: spec.size,
        col: spec.color,
        kind: 'semantic',
        semanticKind: spec.label,
        semanticType: spec.key,
        scopeTypes: [...bucket.scopeTypes],
        catId: spec.key === 'source' || spec.key === 'link' || spec.key === 'org' ? 'business' : spec.key === 'ddd' ? 'home' : 'tech',
        alpha: 1,
        count: bucket.count,
        contactIds: [...bucket.contactIds],
      })
    })
  })

  contactNodeIdsByCity.forEach((ids) => {
    ids.forEach((id, index) => {
      ids.slice(index + 1).forEach((otherId) => {
        edges.push({ a: id, b: otherId, k: 'city' })
      })
    })
  })

  const shouldShowGroups = filteredContacts.some((contact) => contact.kind !== 'member')
  if (shouldShowGroups) {
    const groupsInGraph = new globalThis.Map()
    filteredContacts.forEach((contact) => {
      ;(contact.groupNames ?? []).forEach((groupName, index) => {
        const name = String(groupName ?? '').trim()
        const key = normalize(contact.groupIds?.[index] ?? name)
        if (!name || !key) return
        const catId = CATS.some((cat) => cat.id === contact.cat) ? contact.cat : 'business'
        const current = groupsInGraph.get(key) ?? { key, externalId: String(contact.groupIds?.[index] ?? graphSlug(name)), name, catId, people: 0, sources: new Set() }
        current.people += 1
        current.sources.add(contact.src || contact.source || 'Agenda')
        if (!current.name || name.length > current.name.length) current.name = name
        if (!current.catId || current.catId === 'business') current.catId = catId
        groupsInGraph.set(key, current)
      })
    })

    ;[...groupsInGraph.values()]
      .sort((a, b) => b.people - a.people || a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
      .forEach((group, index) => {
        const catIndex = Math.max(0, CATS.findIndex((cat) => cat.id === group.catId))
        const base = (Math.PI * 2 * catIndex) / CATS.length
        const angle = base + (index % 2 === 0 ? 0.5 : -0.5)
        const id = `group-${group.externalId}`
        nodes.push({
          id,
          name: group.name,
          label: group.name,
          x: Math.cos(angle) * 370,
          y: Math.sin(angle) * 370,
          z: index % 2 === 0 ? 30 : -30,
          r: 11,
          col: GRAPH_PALETTE.structure,
          kind: 'group',
          catId: group.catId,
          dashed: true,
          people: group.people,
          resp: `${group.people} ligação${group.people === 1 ? '' : 'ões'}`,
          score: group.people,
          svc: 'Grupo compartilhado',
          alpha: 1,
        })
        edges.push({ a: catNodeIds.get(group.catId), b: id, k: 'group', catId: group.catId, col: GRAPH_PALETTE.accent })
        groupNodeIds.set(group.key, id)
      })
  }

  filteredContacts.forEach((contact) => {
    const contactId = `contact-${contact.id}`

    semanticSpecs.forEach((spec) => {
      const extracted = spec.extract(contact) ?? []
      const seen = new Set()
      extracted.forEach((value) => {
        const normalizedValue = spec.keyOf(value)
        if (!normalizedValue || seen.has(normalizedValue)) return
        seen.add(normalizedValue)
        const nodeId = semanticNodeIds.get(`${spec.key}:${normalizedValue}`)
        if (nodeId) edges.push({ a: contactId, b: nodeId, k: 'semantic', catId: contact.cat, col: spec.color })
      })
    })

    ;(contact.groupNames ?? []).forEach((groupName, index) => {
      const groupId = groupNodeIds.get(normalize(contact.groupIds?.[index] ?? groupName))
      if (groupId) edges.push({ a: contactId, b: groupId, k: 'group', catId: contact.cat })
    })
  })

  const seenMatches = new Set()
  filteredContacts.forEach((contact) => {
    const fromId = `contact-${contact.id}`
    ;(contact.potentialMatches ?? []).forEach((match) => {
      const toId = String(match.id || '')
      if (!contactNodeMap.has(toId)) return
      const pairKey = [fromId, toId].sort().join('::')
      if (seenMatches.has(pairKey)) return
      seenMatches.add(pairKey)
      edges.push({ a: fromId, b: toId, k: 'match', catId: contact.cat, col: '#f59e0b' })
    })
  })

  applyGraphFilter('all', nodes)
  return { nodes, edges }
}

function applyGraphFilter(filter, nodes) {
  const semanticFilter = GRAPH_SEMANTIC_FILTERS.has(filter)
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
      node.alpha = node.kind === 'group' || node.kind === 'member' ? 1 : node.kind === 'cat' ? 0.4 : 0.1
      return
    }
    if (filter === 'match') {
      const hasMatches = Array.isArray(node.potentialMatches) && node.potentialMatches.length > 0
      node.alpha = hasMatches ? 1 : node.kind === 'cat' ? 0.32 : 0.08
      return
    }
    if (semanticFilter) {
      const nodeScopes = Array.isArray(node.scopeTypes) ? node.scopeTypes : []
      const nodeSemantics = Array.isArray(node.semanticTypes) ? node.semanticTypes : []
      const matchesSemantic = node.kind === 'semantic' ? node.semanticType === filter || nodeScopes.includes(filter) : nodeSemantics.includes(filter) || nodeScopes.includes(filter)
      if (filter === 'interno' || filter === 'grupo' || filter === 'publico') {
        const matchesScope = filter === 'grupo'
          ? node.kind === 'group' || node.kind === 'member' || (Array.isArray(node.scopes) && node.scopes.includes('grupo'))
          : Array.isArray(node.scopes) && node.scopes.includes(filter)
        node.alpha = node.kind === 'semantic'
          ? nodeScopes.includes(filter) ? 1 : 0.14
          : matchesScope
            ? 1
            : node.kind === 'cat'
              ? 0.35
              : 0.08
        return
      }
      node.alpha = matchesSemantic ? 1 : node.kind === 'semantic' ? 0.16 : node.kind === 'cat' ? 0.32 : 0.07
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
  const bg = ctx.createRadialGradient(W * 0.5, H * 0.45, 12, W * 0.5, H * 0.5, Math.max(W, H))
  bg.addColorStop(0, '#0c1327')
  bg.addColorStop(0.46, '#060a14')
  bg.addColorStop(1, '#020308')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const glow = ctx.createRadialGradient(W * 0.38, H * 0.32, 0, W * 0.38, H * 0.32, Math.max(W, H) * 0.7)
  glow.addColorStop(0, 'rgba(242,5,116,0.05)')
  glow.addColorStop(0.45, 'rgba(161,39,242,0.03)')
  glow.addColorStop(1, 'rgba(161,39,242,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  for (let gx = -400; gx <= 400; gx += 45) {
    for (let gy = -400; gy <= 400; gy += 45) {
      const p = projectGraphPoint(gx, gy, -90, cam, W, H)
      ctx.beginPath()
      ctx.fillStyle = 'rgba(148,163,184,0.015)'
      ctx.arc(p.sx, p.sy, 0.9, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.strokeStyle = 'rgba(148,163,184,0.018)'
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
    const color = edge.col ?? (edge.k === 'contact' ? GRAPH_PALETTE.contact : edge.k === 'city' ? GRAPH_PALETTE.accent : edge.k === 'group' ? GRAPH_PALETTE.structure : edge.k === 'semantic' ? GRAPH_PALETTE.tag : edge.k === 'match' ? '#f59e0b' : GRAPH_PALETTE.accent)
    const opacity = edge.k === 'hub' ? 0.34 * al : edge.k === 'contact' ? 0.22 * al : edge.k === 'city' ? 0.2 * al : edge.k === 'semantic' ? 0.18 * al : edge.k === 'match' ? 0.28 * al : 0.12 * al
    ctx.setLineDash(edge.k === 'group' ? [6, 9] : edge.k === 'city' || edge.k === 'semantic' ? [2, 5] : edge.k === 'match' ? [10, 6] : [])
    ctx.strokeStyle = hexA(color, opacity)
    ctx.lineWidth = (edge.k === 'hub' ? 1.2 : edge.k === 'contact' ? 0.9 : edge.k === 'city' ? 0.8 : edge.k === 'match' ? 1.1 : 0.7) * sc
    ctx.beginPath()
    ctx.moveTo(a.sx, a.sy)
    ctx.lineTo(b.sx, b.sy)
    ctx.stroke()
    ctx.setLineDash([])

    if (edge.k === 'hub' || edge.k === 'contact' || edge.k === 'semantic' || edge.k === 'match') {
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
    const palette = graphNodePalette(node, depthBright, hover)

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

    if (node.kind !== 'hub') {
      ctx.beginPath()
      ctx.fillStyle = palette.glow
      ctx.arc(node.sx, node.sy, r * (node.kind === 'contact' ? 1.35 : 1.28), 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.beginPath()
    ctx.fillStyle = node.kind === 'hub' ? `rgba(3,10,22,${al})` : palette.fill
    ctx.strokeStyle = node.kind === 'hub' ? hexA('#67e8f9', al) : palette.stroke
    ctx.lineWidth = node.kind === 'hub' ? 2.5 : hover ? 2.2 : node.kind === 'contact' ? 1.6 : 1.3
    if (node.kind === 'group') ctx.setLineDash([3, 3])
    ctx.arc(node.sx, node.sy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.setLineDash([])

    if (node.kind === 'hub') {
      const fs = Math.max(8, Math.round(11 * node.sc))
      drawGraphLabel(ctx, 'YOU', node.sx, node.sy - r - fs, fs, hexA('#ffffff', al), 0.78 * al)
      drawGraphLabel(ctx, 'hub', node.sx, node.sy + r + fs, Math.max(6, Math.round(7 * node.sc)), hexA('#06b6d4', al * 0.7), 0.62 * al)
    } else if (node.kind === 'cat') {
      drawGraphLabel(ctx, node.label, node.sx, node.sy - r - 9, Math.max(9, Math.round(10 * node.sc)), palette.label, 0.84 * al)
    } else if (node.kind === 'contact') {
      const fs = Math.max(8, Math.round(10 * node.sc))
      drawGraphLabel(ctx, node.name, node.sx, node.sy - r - fs, fs, palette.label, 0.74 * al)
      if (node.sc > 0.45) drawGraphLabel(ctx, node.trust, node.sx, node.sy + r + fs + 2, Math.max(6, Math.round(7.5 * node.sc)), palette.sublabel, 0.72 * al)
    } else if (node.kind === 'group') {
      const fs = Math.max(7, Math.round(8.5 * node.sc))
      drawGraphLabel(ctx, node.name, node.sx, node.sy - r - fs, fs, palette.label, 0.7 * al)
      if (node.sc > 0.42) drawGraphLabel(ctx, `${node.people} nós`, node.sx, node.sy + r + fs + 2, Math.max(6, Math.round(7 * node.sc)), palette.sublabel, 0.65 * al)
    } else if (node.kind === 'semantic') {
      const fs = Math.max(6, Math.round(7.8 * node.sc))
      drawGraphLabel(ctx, node.label, node.sx, node.sy - r - fs, fs, palette.label, 0.7 * al)
      if (node.sc > 0.5) drawGraphLabel(ctx, node.semanticKind, node.sx, node.sy + r + fs + 1, Math.max(5, Math.round(6 * node.sc)), hexA('#94a3b8', al * 0.72), 0.58 * al)
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
  if (ctx.roundRect) ctx.roundRect(10, 10, 168, 146, 6)
  else ctx.rect(10, 10, 168, 146)
  ctx.fill()
  ctx.fillStyle = '#67e8f9'
  ctx.fillText('camadas', x, y)
  const legendItems = [
    { col: GRAPH_PALETTE.contact, label: 'Contato', r: 5.0 },
    { col: GRAPH_PALETTE.tag, label: 'Tag', r: 3.6 },
    { col: GRAPH_PALETTE.ddd, label: 'DDD', r: 3.0 },
  ]
  legendItems.forEach((item) => {
    y += 16
    ctx.beginPath()
    ctx.fillStyle = item.col
    ctx.arc(x + 5, y, item.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#cbd5e1'
    ctx.fillText(item.label, x + 16, y)
  })
  y += 2
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

function GoogleLocationMap({ user, centerAddress, contacts, selectedContact, onSelect, googleMapsApiKey }) {
  const mapRef = useRef(null)
  const [status, setStatus] = useState(googleMapsApiKey ? 'loading' : 'fallback')
  const targetAddress = selectedContact?.locationQuery || selectedContact?.address || centerAddress

  useEffect(() => {
    let cancelled = false
    if (!googleMapsApiKey || !selectedContact) {
      setStatus('fallback')
      return undefined
    }

    async function renderMap() {
      try {
        setStatus('loading')
        const maps = await loadGoogleMaps(googleMapsApiKey)
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

        new maps.Marker({ map, position: origin, title: user?.name ?? 'Você', label: 'EU' })
        new maps.Marker({ map, position: selectedPosition, title: selectedContact.name, label: initials(selectedContact.name).slice(0, 2) })
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

    void renderMap()
    return () => {
      cancelled = true
    }
  }, [centerAddress, contacts, googleMapsApiKey, onSelect, selectedContact, user?.name])

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
      {!googleMapsApiKey ? (
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
      if (status === 'OK' && results[0]) resolve(results[0].geometry.location)
      else reject(new Error(status))
    })
  })
}

function loadGoogleMaps(googleMapsApiKey) {
  if (window.google?.maps) return Promise.resolve(window.google.maps)
  if (!googleMapsApiKey) return Promise.reject(new Error('Google Maps API key missing'))

  if (!googleMapsPromise) {
    googleMapsPromise = new Promise((resolve, reject) => {
      window.__networkAgendaInitMap = () => resolve(window.google.maps)
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}&libraries=geometry&callback=__networkAgendaInitMap`
      script.async = true
      script.defer = true
      script.onerror = () => reject(new Error('Google Maps script failed'))
      document.head.appendChild(script)
    })
  }

  return googleMapsPromise
}

export function GraphWorkspaceSection(props) {
  return <GraphWorkspace {...props} />
}

export function NetworkGraphMapSection(props) {
  return <NetworkGraphMap {...props} />
}

export { GoogleLocationMap, NetworkGraph }
