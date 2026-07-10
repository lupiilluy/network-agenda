import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Compass,
  Map,
  MessageCircle,
  MoreVertical,
  Pencil,
  Plus,
  Route,
  Search,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react'
import { GoogleLocationMap, NetworkGraph } from './networkVisuals.jsx'
import {
  CustomFieldDefinitionsManager,
  DetailRow,
  Field,
  GroupContactCustomFieldsModal,
  PageTitle,
  PublicProfileText,
  ROUTES,
  buildGroupGraphRecords,
  contactMatchesGroupArea,
  contactOwnerId,
  formatDateTime,
  initials,
  matchText,
  normalize,
} from './App.jsx'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''

function Metric({ value, label }) {
  return (
    <div className="glass-panel-soft rounded-lg px-2 py-2">
      <p className="truncate text-base font-black text-slate-100">{value}</p>
      <p className="mt-0.5 truncate text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
    </div>
  )
}

export default function SharedGroupsPageSection({
  user,
  groups,
  contacts,
  publicProfiles,
  users,
  groupContactsById,
  groupMessagesById,
  groupCustomFieldsById,
  onCreateGroup,
  onUpdateGroup,
  onAddMember,
  onRemoveMember,
  onAddContact,
  onRemoveContact,
  onLoadContacts,
  onLoadMessages,
  onSendMessage,
  onLoadCustomFields,
  onSaveCustomField,
  onDeleteCustomField,
  onUpdateContactCustomFields,
  onClearMessages,
  onAskCopilot,
  onNavigate,
}) {
  const [activeTab, setActiveTab] = useState('view')
  const [draft, setDraft] = useState({ name: '', area: '', peopleGoal: '3', description: '' })
  const [createError, setCreateError] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? '')
  const [groupPanelTab, setGroupPanelTab] = useState('chat')
  const [groupMessageDraft, setGroupMessageDraft] = useState('')
  const [groupInviteDraft, setGroupInviteDraft] = useState('')
  const [groupDataOpen, setGroupDataOpen] = useState(false)
  const [editingGroupContact, setEditingGroupContact] = useState(null)
  const chatSectionRef = useRef(null)
  const graphSectionRef = useRef(null)
  const locationSectionRef = useRef(null)
  const currentUserId = contactOwnerId(user)
  const isAdmin = user?.role === 'admin'
  const canCreateGroup = Boolean(user && isAdmin)

  const findGroupMembership = (group) => group?.members?.find((member) => String(member.user_id) === currentUserId || normalize(member.email) === normalize(user?.email))
  const groupRole = (group) => {
    if (!group) return ''
    if (String(group.owner_id) === currentUserId) return 'owner'
    const membership = findGroupMembership(group)
    if (membership?.role) return membership.role
    return isAdmin ? 'admin_global' : ''
  }
  const roleMeta = (role) => ({
    owner: { label: 'Owner', tone: 'text-emerald-200 border-emerald-400/20 bg-emerald-400/10' },
    admin: { label: 'Admin', tone: 'text-cyan-200 border-cyan-400/20 bg-cyan-400/10' },
    admin_global: { label: 'Admin global', tone: 'text-cyan-200 border-cyan-400/20 bg-cyan-400/10' },
    member: { label: 'Member', tone: 'text-amber-200 border-amber-400/20 bg-amber-400/10' },
  }[role] || { label: 'Leitura', tone: 'text-slate-300 border-slate-700 bg-slate-900/60' })

  const selectedGroup = groups.find((group) => String(group.id) === String(selectedGroupId)) || groups[0] || null
  const selectedMembers = selectedGroup ? (selectedGroup.members ?? []) : []
  const selectedContacts = selectedGroup ? (groupContactsById[selectedGroup.id] ?? []) : []
  const selectedMessages = selectedGroup ? (groupMessagesById[selectedGroup.id] ?? []) : []
  const selectedGroupFields = selectedGroup ? (groupCustomFieldsById[selectedGroup.id] ?? []) : []
  const selectedGroupRole = groupRole(selectedGroup)
  const canManageSelectedGroup = Boolean(selectedGroup && ['owner', 'admin', 'admin_global'].includes(selectedGroupRole))
  const ownedGroups = groups.filter((group) => String(group.owner_id) === currentUserId)
  const participatingGroups = groups.filter((group) => String(group.owner_id) !== currentUserId && ['owner', 'admin', 'member'].includes(groupRole(group)))
  const visibleAdminGroups = isAdmin ? groups.filter((group) => String(group.owner_id) !== currentUserId && !findGroupMembership(group)) : []
  const privateAvailable = selectedGroup
    ? contacts.filter((contact) => !selectedContacts.some((item) => String(item.id) === String(contact.id)) && contactMatchesGroupArea(contact, selectedGroup))
    : contacts

  const sectionRefs = {
    chat: chatSectionRef,
    graph: graphSectionRef,
    location: locationSectionRef,
  }

  const selectedGraphItems = useMemo(
    () => (selectedGroup ? buildGroupGraphRecords({ group: selectedGroup, members: selectedMembers, contacts: selectedContacts, publicProfiles, users, currentUser: user }) : []),
    [selectedGroup, selectedMembers, selectedContacts, publicProfiles, users, user],
  )

  useEffect(() => {
    if (!selectedGroup?.id) return
    setSelectedGroupId(selectedGroup.id)
    onLoadContacts(selectedGroup.id)
    onLoadMessages(selectedGroup.id)
    onLoadCustomFields(selectedGroup.id)
  }, [selectedGroup?.id])

  useEffect(() => {
    setGroupInviteDraft('')
  }, [selectedGroup?.id])

  function jumpToGroupSection(sectionId) {
    setGroupPanelTab(sectionId)
    sectionRefs[sectionId]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function submitGroup(event) {
    event.preventDefault()
    if (!canCreateGroup) return
    const peopleGoal = Number(draft.peopleGoal)
    const nextError = !draft.name.trim()
      ? 'Informe o nome do grupo.'
      : !draft.area.trim()
        ? 'Informe qual área o grupo atende.'
        : !Number.isFinite(peopleGoal) || peopleGoal < 3
          ? 'O grupo precisa ter 3 ou mais pessoas.'
          : ''
    setCreateError(nextError)
    if (nextError) return
    const created = await onCreateGroup({
      name: draft.name.trim(),
      area: draft.area.trim(),
      people_goal: peopleGoal,
      description: draft.description.trim(),
    })
    if (created?.id) {
      setSelectedGroupId(created.id)
      setGroupPanelTab('chat')
    }
    setDraft({ name: '', area: '', peopleGoal: '3', description: '' })
  }

  async function submitGroupMessage(event) {
    event.preventDefault()
    if (!selectedGroup || !groupMessageDraft.trim()) return
    const created = await onSendMessage(selectedGroup.id, groupMessageDraft)
    if (created) setGroupMessageDraft('')
  }

  async function submitGroupInvite(event) {
    event.preventDefault()
    if (!selectedGroup || !groupInviteDraft.trim()) return
    if (canManageSelectedGroup) {
      await onAddMember(selectedGroup.id, groupInviteDraft.trim())
    } else {
      await onSendMessage(selectedGroup.id, `Pedido de convite para ${groupInviteDraft.trim()} enviado ao grupo.`)
    }
    setGroupInviteDraft('')
  }

  function GroupList({ title, items, emptyText }) {
    return (
      <section className="glass-panel rounded-lg p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-100">{title}</h2>
          <span className="text-xs font-black text-slate-500">{items.length}</span>
        </div>
        <div className="grid gap-2">
          {items.length ? items.map((group) => {
            const meta = roleMeta(groupRole(group))
            const isSelected = String(selectedGroup?.id) === String(group.id)
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedGroupId(group.id)}
                className={['action-card rounded-lg p-3 text-left', isSelected ? 'border-cyan-400/60' : ''].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-black text-slate-100">{group.name}</p>
                  <span className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${meta.tone}`}>{meta.label}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{group.description || 'Sem descrição.'}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">{group.area || 'Área não informada'} · {group.people_goal || 3}+ pessoas</p>
                <div className="mt-2 flex gap-2 text-[11px] font-black text-cyan-200">
                  <span>{group.member_count} membros</span>
                  <span>{group.people_goal || 3} meta</span>
                </div>
              </button>
            )
          }) : <p className="rounded-lg border border-dashed border-slate-800 p-4 text-sm font-semibold text-slate-500">{emptyText}</p>}
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <PageTitle
        eyebrow="Grupos compartilhados"
        title="Chat primeiro, dados separados"
        description="A conversa é a vista principal do grupo. Grafo, localização e ficha aparecem em blocos separados para a mesma experiência em mobile e desktop."
        action={<button type="button" onClick={() => onNavigate(ROUTES.PUBLIC)} className="secondary-button inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black"><Compass size={17} />Rede pública</button>}
      />

      <div className="glass-panel-soft flex flex-wrap rounded-lg p-1.5">
        {[
          { id: 'view', label: 'Visualizar grupo' },
          { id: 'create', label: 'Criar grupo' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={['h-10 flex-1 rounded-md text-sm font-black transition', activeTab === tab.id ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:bg-slate-900/70 hover:text-cyan-100'].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'create' ? (
        <section className="glass-panel rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-200"><ShieldCheck size={20} /></span>
            <div>
              <h2 className="text-base font-black text-slate-100">Criar grupo</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Disponível para contas admin. Todo grupo precisa declarar área atendida e ter previsão mínima de 3 pessoas.</p>
            </div>
          </div>
          {!canCreateGroup ? (
            <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm font-bold text-amber-100">
              Seu plano atual permite participar de grupos compartilhados, mas a criação é reservada para administradores.
            </div>
          ) : null}
          <form onSubmit={submitGroup} className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nome" required>
                <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="field-input" disabled={!canCreateGroup} placeholder="Ex: Hub de fundadores" />
              </Field>
              <Field label="Área atendida" required>
                <input value={draft.area} onChange={(event) => setDraft((current) => ({ ...current, area: event.target.value }))} className="field-input" disabled={!canCreateGroup} placeholder="Ex: Empresários, tecnologia, eventos" />
              </Field>
              <Field label="Número de pessoas" required>
                <input value={draft.peopleGoal} onChange={(event) => setDraft((current) => ({ ...current, peopleGoal: event.target.value }))} className="field-input" type="number" min="3" disabled={!canCreateGroup} placeholder="Mínimo 3" />
              </Field>
            </div>
            <Field label="Descrição">
              <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="field-input min-h-20 resize-y" disabled={!canCreateGroup} placeholder="Contexto, objetivo e tipo de rede." />
            </Field>
            {createError ? <p className="rounded-lg border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-100">{createError}</p> : null}
            <button type="submit" disabled={!canCreateGroup} className="primary-button inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">
              <Plus size={17} />
              Criar grupo
            </button>
          </form>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="space-y-4">
            <GroupList title="Meus grupos" items={ownedGroups} emptyText="Você ainda não criou grupos." />
            <GroupList title="Participando" items={participatingGroups} emptyText="Você ainda não participa de grupos criados por outras pessoas." />
            {visibleAdminGroups.length ? <GroupList title="Outros grupos visíveis" items={visibleAdminGroups} emptyText="" /> : null}
          </div>

          <section className="glass-panel rounded-lg p-4">
            {selectedGroup ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-cyan-400/10 bg-gradient-to-br from-cyan-500/12 via-slate-950/60 to-emerald-500/8 p-4 shadow-[0_24px_80px_rgba(2,132,199,0.12)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Sala ativa</p>
                      <h2 className="mt-1 text-2xl font-black text-slate-100">{selectedGroup.name}</h2>
                      <p className="mt-1 text-sm font-black text-cyan-100">{selectedGroup.area || 'Área não informada'} · {selectedGroup.people_goal || 3}+ pessoas</p>
                      <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-500">{selectedGroup.description || 'Sem descrição.'}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${roleMeta(selectedGroupRole).tone}`}>{roleMeta(selectedGroupRole).label}</span>
                        <span className="rounded-md border border-slate-800 bg-slate-950/55 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">{selectedMembers.length} membros</span>
                        <span className="rounded-md border border-slate-800 bg-slate-950/55 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">{selectedMessages.length} mensagens</span>
                        <span className="text-xs font-semibold text-slate-400">{canManageSelectedGroup ? 'Você pode gerenciar este grupo.' : 'Você participa deste grupo com acesso de leitura.'}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => onNavigate(`${ROUTES.GROUP_ADMIN}/${selectedGroup.id}`)} className="secondary-button inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black">
                        <Pencil size={16} />
                        Administração
                      </button>
                      <button type="button" onClick={() => setGroupDataOpen(true)} className="secondary-button inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black">
                        <UsersRound size={16} />
                        Acessar dados do grupo
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedMembers.slice(0, 5).map((member) => {
                      const memberUser = users.find((profile) => String(profile.id) === String(member.user_id) || normalize(profile.email) === normalize(member.email))
                      const label = memberUser?.name || member.email
                      return (
                        <span key={member.id} className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/55 px-2.5 py-1 text-[11px] font-black text-slate-200">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/15 text-[10px] text-cyan-100">{initials(label)}</span>
                          <span className="max-w-[140px] truncate">{label}</span>
                        </span>
                      )
                    })}
                  </div>
                </div>

                <div className="glass-panel-soft flex flex-wrap gap-2 rounded-lg p-1.5">
                  {[
                    { id: 'chat', label: 'Chat', icon: MessageCircle },
                    { id: 'graph', label: 'Grafo', icon: Route },
                    { id: 'location', label: 'Localização', icon: Map },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => jumpToGroupSection(tab.id)}
                      className={['inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md text-sm font-black transition', groupPanelTab === tab.id ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:bg-slate-900/70 hover:text-cyan-100'].join(' ')}
                    >
                      <tab.icon size={16} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <section ref={chatSectionRef} className="scroll-mt-24">
                    <GroupChatPanel
                      group={selectedGroup}
                      messages={selectedMessages}
                      currentUserId={currentUserId}
                      members={selectedMembers}
                      sharedContacts={selectedContacts}
                      users={users}
                      currentUser={user}
                      canManage={canManageSelectedGroup}
                      draft={groupMessageDraft}
                      onDraftChange={setGroupMessageDraft}
                      onSubmit={submitGroupMessage}
                      onAskCopilot={(message) => onAskCopilot?.(selectedGroup.id, message)}
                      memberCount={selectedMembers.length}
                      onOpenData={() => setGroupDataOpen(true)}
                      onClearConversation={() => onClearMessages?.(selectedGroup.id)}
                      inviteDraft={groupInviteDraft}
                      onInviteDraftChange={setGroupInviteDraft}
                      onInviteSubmit={submitGroupInvite}
                    />
                  </section>

                  <section ref={graphSectionRef} className="scroll-mt-24">
                    <GroupGraphPanel
                      group={selectedGroup}
                      members={selectedMembers}
                      users={users}
                      currentUser={user}
                      graphItems={selectedGraphItems}
                    />
                  </section>

                  <section ref={locationSectionRef} className="scroll-mt-24">
                    <GroupLocationPanel
                      group={selectedGroup}
                      members={selectedMembers}
                      users={users}
                      currentUser={user}
                      graphItems={selectedGraphItems}
                    />
                  </section>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center">
                <UsersRound className="mx-auto text-cyan-300" size={36} />
                <h2 className="mt-3 text-lg font-black text-slate-100">Selecione ou crie um grupo</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">A conversa, o grafo e a localização aparecem aqui quando houver um grupo ativo.</p>
              </div>
            )}
          </section>
        </section>
      )}

      {selectedGroup && groupDataOpen ? (
        <GroupDetailsModal
          group={selectedGroup}
          currentUser={user}
          roleLabel={roleMeta(selectedGroupRole).label}
          canManage={canManageSelectedGroup}
          members={selectedMembers}
          contacts={selectedContacts}
          availableContacts={privateAvailable}
          selectedGroupFields={selectedGroupFields}
          users={users}
          onClose={() => setGroupDataOpen(false)}
          onUpdateGroup={onUpdateGroup}
          onAddMember={onAddMember}
          onRemoveMember={onRemoveMember}
          onAddContact={onAddContact}
          onRemoveContact={onRemoveContact}
          onSendMessage={onSendMessage}
          onSaveCustomField={onSaveCustomField}
          onDeleteCustomField={onDeleteCustomField}
          onUpdateContactCustomFields={onUpdateContactCustomFields}
          onEditContact={setEditingGroupContact}
          onNavigate={onNavigate}
        />
      ) : null}

      {selectedGroup && editingGroupContact ? (
        <GroupContactCustomFieldsModal
          group={selectedGroup}
          contact={editingGroupContact}
          definitions={selectedGroupFields}
          canManage={canManageSelectedGroup}
          onClose={() => setEditingGroupContact(null)}
          onSave={async (nextValues) => {
            const updated = await onUpdateContactCustomFields(selectedGroup.id, editingGroupContact, nextValues)
            if (updated) setEditingGroupContact(updated)
          }}
        />
      ) : null}
    </div>
  )
}

function GroupChatPanel({
  group,
  messages,
  currentUserId,
  members,
  sharedContacts,
  users,
  currentUser,
  canManage,
  draft,
  onDraftChange,
  onSubmit,
  onAskCopilot,
  memberCount,
  onOpenData,
  onClearConversation,
  inviteDraft,
  onInviteDraftChange,
  onInviteSubmit,
}) {
  const [toolsOpen, setToolsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionStatus, setActionStatus] = useState('')
  const [copilotDraft, setCopilotDraft] = useState('')
  const [copilotMessages, setCopilotMessages] = useState([])
  const [isCopilotThinking, setIsCopilotThinking] = useState(false)

  useEffect(() => {
    setToolsOpen(false)
    setSearchQuery('')
    setActionStatus('')
    setCopilotDraft('')
    setCopilotMessages([])
    setIsCopilotThinking(false)
  }, [group?.id])

  useEffect(() => {
    if (!toolsOpen) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') setToolsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toolsOpen])

  const memberItems = useMemo(() => {
    const q = normalize(searchQuery)
    return (members ?? [])
      .map((member) => {
        const memberUser = users.find((profile) => String(profile.id) === String(member.user_id) || normalize(profile.email) === normalize(member.email))
        const label = memberUser?.name || member.email || 'Membro'
        return {
          id: member.id,
          name: label,
          email: member.email || memberUser?.email || '',
          role: member.role || 'member',
          user: memberUser,
          mine: String(member.user_id) === String(currentUserId) || normalize(member.email) === normalize(currentUser?.email),
        }
      })
      .filter((member) => !q || matchText(q, [member.name, member.email, member.role, member.user?.city, member.user?.service, member.user?.note]))
  }, [members, users, searchQuery, currentUserId, currentUser?.email])

  const messageItems = useMemo(() => {
    const q = normalize(searchQuery)
    return (messages ?? []).filter((message) => !q || matchText(q, [message.message, message.sender_name, message.sender_email, formatDateTime(message.created_at)]))
  }, [messages, searchQuery])

  async function runCopilot(message) {
    if (!message || isCopilotThinking || !onAskCopilot) return
    const userMessage = {
      id: `group-copilot-user-${Date.now()}`,
      role: 'user',
      text: message,
    }
    setCopilotMessages((current) => [...current, userMessage])
    setCopilotDraft('')
    setIsCopilotThinking(true)
    try {
      const response = await onAskCopilot(message)
      setCopilotMessages((current) => [
        ...current,
        {
          id: `group-copilot-assistant-${Date.now()}`,
          role: 'assistant',
          text: response?.answer || 'Não consegui montar uma leitura útil para esse pedido.',
          provider: response?.provider || 'local',
        },
      ])
    } catch {
      setCopilotMessages((current) => [
        ...current,
        {
          id: `group-copilot-assistant-${Date.now()}`,
          role: 'assistant',
          text: 'Não consegui consultar o copiloto do grupo agora.',
          provider: 'local',
        },
      ])
    } finally {
      setIsCopilotThinking(false)
    }
  }

  async function submitCopilot(event) {
    event.preventDefault()
    const message = copilotDraft.trim()
    await runCopilot(message)
  }

  function quickCopilot(message) {
    if (!message || isCopilotThinking || !onAskCopilot) return
    setCopilotDraft('')
    void runCopilot(message)
  }

  async function handleClearConversation() {
    if (!canManage) {
      setActionStatus('Somente admin ou owner pode limpar a conversa.')
      return
    }
    if (!messages.length) {
      setActionStatus('Não há conversa para limpar.')
      return
    }
    const confirmed = window.confirm(`Limpar toda a conversa de ${group.name}?`)
    if (!confirmed) return
    setActionStatus('Limpando conversa...')
    try {
      const result = await onClearConversation?.()
      if (result === false) {
        setActionStatus('Não foi possível limpar a conversa.')
        return
      }
      setSearchQuery('')
      setActionStatus('Conversa limpa.')
      setToolsOpen(true)
    } catch {
      setActionStatus('Não foi possível limpar a conversa.')
    }
  }

  return (
    <section className="glass-panel relative overflow-hidden rounded-xl">
      <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-cyan-400">Sala do grupo</p>
          <h3 className="mt-1 truncate text-sm font-black text-slate-100">{group.name}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">{memberCount} membros e {(sharedContacts ?? []).length} contatos compartilhados neste contexto.</p>
        </div>
        <button
          type="button"
          onClick={() => setToolsOpen((current) => !current)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/55 text-slate-200 transition hover:border-cyan-400/30 hover:text-cyan-100"
          aria-expanded={toolsOpen}
          aria-label="Abrir painel do grupo"
        >
          <MoreVertical size={15} />
        </button>
      </div>

      <div className="max-h-[58vh] space-y-2 overflow-y-auto p-3 sm:p-4">
        {messages.length ? messages.map((message) => {
          const mine = String(message.sender_id) === currentUserId
          return (
            <div key={message.id} className={['flex', mine ? 'justify-end' : 'justify-start'].join(' ')}>
              <div className={['max-w-[86%] rounded-2xl px-3 py-2.5 text-sm leading-6 shadow-lg', mine ? 'bg-cyan-500 text-slate-950' : 'border border-slate-800 bg-slate-950/60 text-slate-200'].join(' ')}>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[11px] font-black uppercase tracking-widest opacity-80">{message.sender_name || message.sender_email || 'Membro'}</p>
                  <span className="shrink-0 text-[10px] font-bold opacity-60">{formatDateTime(message.created_at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{message.message}</p>
              </div>
            </div>
          )
        }) : (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/35 p-5 text-sm font-semibold text-slate-500">
            Nenhuma mensagem ainda. O chat funciona como a sala principal do grupo.
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-slate-800 bg-slate-950/35 p-3 backdrop-blur">
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            rows={1}
            className="field-input min-h-11 flex-1 resize-none py-3"
            placeholder={`Escreva para ${group.name}...`}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
          />
          <button type="submit" className="primary-button h-11 rounded-lg px-4 text-sm font-black">
            Enviar
          </button>
        </div>
      </form>

      <div className={['absolute inset-0 z-20 transition-opacity duration-300', toolsOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'].join(' ')}>
        <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" aria-hidden="true" />
        <aside className={['absolute right-0 top-0 flex h-full w-[min(92vw,420px)] flex-col border-l border-slate-800 bg-[#07111d]/96 shadow-[0_28px_120px_rgba(2,8,23,0.6)] transition-transform duration-300 ease-out', toolsOpen ? 'translate-x-0' : 'translate-x-full'].join(' ')}>
          <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-widest text-cyan-400">Painel do grupo</p>
              <h4 className="mt-1 truncate text-base font-black text-slate-100">{group.name}</h4>
              <p className="mt-1 text-xs font-semibold text-slate-500">Pesquise membros e mensagens, limpe a conversa ou abra os dados completos.</p>
            </div>
            <button
              type="button"
              onClick={() => setToolsOpen(false)}
              className="rounded-lg border border-slate-800 bg-slate-950/55 p-2 text-slate-400 transition hover:border-cyan-400/30 hover:text-cyan-100"
              aria-label="Fechar painel"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <section className="rounded-2xl border border-cyan-400/10 bg-cyan-500/5 p-3">
              <div className="grid grid-cols-2 gap-2">
                <Metric value={memberCount} label="membros" />
                <Metric value={messages.length} label="mensagens" />
                <Metric value={(sharedContacts ?? []).length} label="contatos" />
                <Metric value={group.area || 'sem área'} label="área" />
                <Metric value={canManage ? 'admin' : 'membro'} label="acesso" />
              </div>
              <div className="mt-3 grid gap-2 text-sm">
                <DetailRow label="Área atendida" value={group.area || 'Não informada'} />
                <DetailRow label="Meta mínima" value={`${group.people_goal || 3}+ pessoas`} />
                <DetailRow label="Seu perfil" value={currentUser?.name || 'Você'} />
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-cyan-400/15 bg-cyan-500/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-widest text-cyan-300">Copiloto do grupo</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">Consulta a base compartilhada deste grupo sem misturar com a agenda privada.</p>
                </div>
                <span className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-100">{(sharedContacts ?? []).length} base</span>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[
                  `quem resolve ${group.area || 'esse tema'}?`,
                  'quem esta buscando algo agora?',
                  'quais contatos tem DDD 11?',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => quickCopilot(prompt)}
                    className="action-card shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-black text-slate-300"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                {copilotMessages.length ? copilotMessages.map((message) => (
                  <div
                    key={message.id}
                    className={[
                      'rounded-2xl border px-3 py-2.5 text-sm leading-6',
                      message.role === 'user' ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-50' : 'border-slate-800 bg-slate-950/45 text-slate-200',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{message.role === 'user' ? 'Você' : 'Copiloto'}</p>
                      {message.provider ? <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{message.provider === 'openai' ? 'IA conectada' : 'motor local'}</span> : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{message.text}</p>
                  </div>
                )) : (
                  <p className="rounded-2xl border border-dashed border-slate-800 p-4 text-sm font-semibold text-slate-500">Peça algo como "quem resolve limpeza?" ou "quem esta buscando parceria?" para analisar a base compartilhada.</p>
                )}
                {isCopilotThinking ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-3 py-2.5 text-sm font-semibold text-slate-400">Lendo os contatos compartilhados...</div>
                ) : null}
              </div>

              <form onSubmit={submitCopilot} className="grid gap-2">
                <textarea
                  value={copilotDraft}
                  onChange={(event) => setCopilotDraft(event.target.value)}
                  rows={2}
                  className="field-input min-h-20 resize-none py-3"
                  placeholder="Ex.: quem do grupo presta servico de limpeza comercial?"
                />
                <button type="submit" disabled={isCopilotThinking} className="primary-button inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">
                  Consultar copiloto
                </button>
              </form>
            </section>

            <div className="glass-panel-soft flex items-center gap-2 rounded-lg px-3">
              <Search size={16} className="text-slate-500" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-11 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-600"
                placeholder="Pesquisar membros e mensagens"
              />
            </div>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Membros encontrados</p>
                <span className="text-[11px] font-black text-slate-500">{memberItems.length}</span>
              </div>
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {memberItems.length ? memberItems.map((member) => (
                  <div key={member.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 px-3 py-2.5 transition hover:border-cyan-400/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-100">{member.name}</p>
                        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{member.email || 'Sem email'}</p>
                      </div>
                      <span className={['rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-widest', member.mine ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100' : 'border-slate-700 bg-slate-900/60 text-slate-300'].join(' ')}>
                        {member.mine ? 'você' : member.role}
                      </span>
                    </div>
                  </div>
                )) : (
                  <p className="rounded-2xl border border-dashed border-slate-800 p-4 text-sm font-semibold text-slate-500">Nenhum membro corresponde à busca.</p>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Mensagens encontradas</p>
                <span className="text-[11px] font-black text-slate-500">{messageItems.length}</span>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {messageItems.length ? messageItems.map((message) => {
                  const mine = String(message.sender_id) === currentUserId
                  return (
                    <div key={message.id} className={['rounded-2xl border px-3 py-2.5', mine ? 'border-cyan-400/20 bg-cyan-400/10' : 'border-slate-800 bg-slate-950/40'].join(' ')}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-[11px] font-black uppercase tracking-widest text-slate-300">{message.sender_name || message.sender_email || 'Membro'}</p>
                        <span className="shrink-0 text-[10px] font-bold text-slate-600">{formatDateTime(message.created_at)}</span>
                      </div>
                      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm font-medium leading-5 text-slate-300">{message.message}</p>
                    </div>
                  )
                }) : (
                  <p className="rounded-2xl border border-dashed border-slate-800 p-4 text-sm font-semibold text-slate-500">Nenhuma mensagem corresponde à busca.</p>
                )}
              </div>
            </section>

            <section className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/35 p-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Convite rápido</p>
              <form onSubmit={onInviteSubmit} className="mt-2 grid gap-2">
                <input
                  type="email"
                  value={inviteDraft}
                  onChange={(event) => onInviteDraftChange(event.target.value)}
                  className="field-input h-10"
                  placeholder="email@exemplo.com"
                />
                <button type="submit" className="primary-button inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-black">
                  {canManage ? 'Convidar' : 'Solicitar'}
                </button>
              </form>
              <p className="text-xs font-semibold leading-5 text-slate-500">
                Se você não for admin, a ação vira uma solicitação no chat do grupo.
              </p>
            </section>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleClearConversation}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-rose-400/20 bg-rose-400/10 text-sm font-black text-rose-100 transition hover:border-rose-300/40 hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canManage || !messages.length}
              >
                Limpar conversa
              </button>
              <button
                type="button"
                onClick={() => {
                  setToolsOpen(false)
                  onOpenData()
                }}
                className="secondary-button inline-flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black"
              >
                Dados do grupo
              </button>
            </div>

            {actionStatus ? (
              <p className="rounded-lg border border-slate-800 bg-slate-950/55 px-3 py-2 text-xs font-semibold text-slate-400" aria-live="polite">
                {actionStatus}
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  )
}

function GroupGraphPanel({ group, members, users, currentUser, graphItems }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const visibleItems = useMemo(() => {
    return (graphItems ?? []).filter((item) => matchText(query, [item.name, item.service, item.city, item.locationLabel, item.roleLabel, item.ddd, item.demand, item.solves, ...(item.demandTags ?? []), ...(item.tags ?? [])]))
  }, [graphItems, query])

  useEffect(() => {
    if (!visibleItems.length) {
      setSelectedId('')
      return
    }
    if (!visibleItems.some((item) => item.id === selectedId)) setSelectedId(visibleItems[0].id)
  }, [visibleItems, selectedId])

  const selectedItem = visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0] ?? null
  const summary = {
    nodes: visibleItems.length,
    located: visibleItems.filter((item) => item.distanceKm !== null).length,
    ddds: new Set(visibleItems.map((item) => item.ddd).filter(Boolean)).size,
    cities: new Set(visibleItems.map((item) => item.locationLabel).filter(Boolean)).size,
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.82fr)]">
      <section className="glass-panel rounded-xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-cyan-400">Grafo do grupo</p>
            <h3 className="mt-1 text-xl font-black text-slate-100">{group.name}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Membros e contatos compartilhados com posição aproximada por localidade e DDD quando houver.</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Metric value={summary.nodes} label="nós" />
            <Metric value={summary.located} label="localizados" />
            <Metric value={summary.ddds} label="DDDs" />
            <Metric value={summary.cities} label="cidades" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {members.slice(0, 5).map((member) => {
            const memberUser = users.find((profile) => String(profile.id) === String(member.user_id) || normalize(profile.email) === normalize(member.email))
            const label = memberUser?.name || member.email
            return (
              <span key={member.id} className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/55 px-2.5 py-1 text-[11px] font-black text-slate-200">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/15 text-[10px] text-cyan-100">{initials(label)}</span>
                <span className="max-w-[140px] truncate">{label}</span>
              </span>
            )
          })}
        </div>

        <div className="mt-4 glass-panel-soft flex items-center gap-2 rounded-lg px-3">
          <Search size={16} className="text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-600"
            placeholder="Buscar pessoa, cidade, DDD, área ou tag"
          />
        </div>

        {visibleItems.length ? (
          <div className="mt-4">
            <NetworkGraph
              items={visibleItems}
              selectedId={selectedItem?.id}
              onSelect={setSelectedId}
              showCategoryFilter={true}
              filterOptions={['all', 'grupo', 'publico', 'interno', 'tag', 'source', 'ddd', 'demand', 'solve', 'link', 'org']}
              label="NETWORK · GRUPO · MEMBROS"
            />
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-slate-800 p-6 text-sm font-semibold text-slate-500">
            Nenhum nó encontrado para os filtros atuais.
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <div className="glass-panel rounded-xl p-4">
          {selectedItem ? (
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-cyan-400">Leitura ativa</p>
              <h4 className="mt-1 text-lg font-black text-slate-100">{selectedItem.name}</h4>
              <p className="mt-1 text-sm font-semibold text-slate-400">{selectedItem.service}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[11px] font-black text-cyan-100">{selectedItem.roleLabel}</span>
                <span className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1 text-[11px] font-black text-slate-300">{selectedItem.distanceLabel || 'sem distância'}</span>
                <span className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1 text-[11px] font-black text-slate-300">{selectedItem.locationSourceLabel || 'localização'}</span>
              </div>
              <div className="mt-3 grid gap-2 text-sm">
                <DetailRow label="Cidade" value={selectedItem.city || 'Não informada'} />
                <DetailRow label="DDD" value={selectedItem.ddd || 'Não identificado'} />
                <DetailRow label="Grupo" value={selectedItem.groupNames?.join(', ') || group.name} />
                <DetailRow label="Vínculo" value={selectedItem.linkedPlatform ? selectedItem.linkedLabel || 'Usuário da plataforma' : 'Sem vínculo'} />
              </div>
              {selectedItem.tags?.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedItem.tags.slice(0, 8).map((tag) => <span key={tag} className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-[11px] font-black text-slate-300">{tag}</span>)}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm font-semibold text-slate-500">Selecione um nó no grafo para ver a leitura de proximidade.</p>
          )}
        </div>

        <div className="glass-panel rounded-xl p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-black text-slate-100">Rede do grupo por proximidade</p>
            <span className="text-xs font-black text-slate-500">{visibleItems.length}</span>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {visibleItems.slice().sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999)).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={['flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition', selectedId === item.id ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/35 hover:border-cyan-400/20'].join(' ')}
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white" style={{ backgroundColor: item.category?.color ?? '#0f172a' }}>
                  {initials(item.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-slate-100">{item.name}</span>
                  <span className="block truncate text-xs font-semibold text-slate-500">{item.roleLabel} · {item.locationLabel || item.city}</span>
                  <span className="mt-1 block text-xs font-black text-cyan-300">{item.distanceLabel || 'sem distância'}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}

function GroupLocationPanel({ group, members, users, currentUser, graphItems }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const currentLocation = useMemo(
    () => ({
      query: currentUser?.serviceAddress || currentUser?.address || currentUser?.city || group.area || '',
    }),
    [currentUser, group.area],
  )

  const visibleItems = useMemo(() => {
    return (graphItems ?? []).filter((item) => matchText(query, [item.name, item.service, item.city, item.locationLabel, item.ddd, item.roleLabel, item.demand, item.solves, ...(item.demandTags ?? []), ...(item.tags ?? [])]))
  }, [graphItems, query])

  useEffect(() => {
    if (!visibleItems.length) {
      setSelectedId('')
      return
    }
    if (!visibleItems.some((item) => item.id === selectedId)) setSelectedId(visibleItems[0].id)
  }, [visibleItems, selectedId])

  const selectedItem = visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0] ?? null
  const summary = {
    nodes: visibleItems.length,
    located: visibleItems.filter((item) => item.distanceKm !== null).length,
    ddds: new Set(visibleItems.map((item) => item.ddd).filter(Boolean)).size,
    cities: new Set(visibleItems.map((item) => item.locationLabel).filter(Boolean)).size,
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
      <section className="space-y-4">
        <div className="glass-panel rounded-xl p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-cyan-400">Mapa e proximidade</p>
              <h3 className="mt-1 text-xl font-black text-slate-100">{group.name}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">Veja a proximidade de membros e contatos compartilhados em relação a você e ao grupo.</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Metric value={summary.nodes} label="nós" />
              <Metric value={summary.located} label="localizados" />
              <Metric value={summary.ddds} label="DDDs" />
              <Metric value={summary.cities} label="cidades" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {members.slice(0, 5).map((member) => {
              const memberUser = users.find((profile) => String(profile.id) === String(member.user_id) || normalize(profile.email) === normalize(member.email))
              const label = memberUser?.name || member.email
              return (
                <span key={member.id} className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/55 px-2.5 py-1 text-[11px] font-black text-slate-200">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/15 text-[10px] text-cyan-100">{initials(label)}</span>
                  <span className="max-w-[140px] truncate">{label}</span>
                </span>
              )
            })}
          </div>
          <div className="mt-4 glass-panel-soft flex items-center gap-2 rounded-lg px-3">
            <Search size={16} className="text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-600"
              placeholder="Buscar por cidade, DDD, nome, área ou tag"
            />
          </div>
        </div>

        <GoogleLocationMap
          user={currentUser}
          centerAddress={currentLocation.query}
          contacts={visibleItems}
          selectedContact={selectedItem}
          onSelect={setSelectedId}
          googleMapsApiKey={GOOGLE_MAPS_API_KEY}
        />
      </section>

      <aside className="space-y-4">
        <div className="glass-panel rounded-xl p-4">
          {selectedItem ? (
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-cyan-400">Mais próximo selecionado</p>
              <h4 className="mt-1 text-lg font-black text-slate-100">{selectedItem.name}</h4>
              <p className="mt-1 text-sm font-semibold text-slate-400">{selectedItem.service}</p>
              <div className="mt-3 grid gap-2 text-sm">
                <DetailRow label="Distância" value={selectedItem.distanceLabel || 'sem distância'} />
                <DetailRow label="Localidade" value={selectedItem.locationLabel || 'Não informada'} />
                <DetailRow label="Origem" value={selectedItem.locationSourceLabel || 'Sem origem'} />
                <DetailRow label="Vínculo" value={selectedItem.linkedPlatform ? selectedItem.linkedLabel || 'Usuário da plataforma' : 'Sem vínculo'} />
              </div>
            </div>
          ) : (
            <p className="text-sm font-semibold text-slate-500">Selecione um membro ou contato para ver a proximidade.</p>
          )}
        </div>

        <div className="glass-panel rounded-xl p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-black text-slate-100">Ranking de proximidade</p>
            <span className="text-xs font-black text-slate-500">{visibleItems.length}</span>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {visibleItems.slice().sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999)).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={['flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition', selectedId === item.id ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/35 hover:border-cyan-400/20'].join(' ')}
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white" style={{ backgroundColor: item.category?.color ?? '#0f172a' }}>
                  {initials(item.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-slate-100">{item.name}</span>
                  <span className="block truncate text-xs font-semibold text-slate-500">{item.locationLabel || item.city}</span>
                  <span className="mt-1 block text-xs font-black text-cyan-300">{item.distanceLabel || 'sem distância'}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}

function GroupDetailsModal({
  group,
  currentUser,
  roleLabel,
  canManage,
  members,
  contacts,
  availableContacts,
  selectedGroupFields,
  users,
  onClose,
  onUpdateGroup,
  onAddMember,
  onRemoveMember,
  onAddContact,
  onRemoveContact,
  onSendMessage,
  onSaveCustomField,
  onDeleteCustomField,
  onEditContact,
  onNavigate,
  embedded = false,
}) {
  const [editDraft, setEditDraft] = useState({
    name: group.name || '',
    area: group.area || '',
    peopleGoal: String(group.people_goal || 3),
    description: group.description || '',
  })
  const [inviteEmail, setInviteEmail] = useState('')
  const [selectedContactId, setSelectedContactId] = useState('')

  useEffect(() => {
    setEditDraft({
      name: group.name || '',
      area: group.area || '',
      peopleGoal: String(group.people_goal || 3),
      description: group.description || '',
    })
    setInviteEmail('')
    setSelectedContactId('')
  }, [group.id, group.name, group.area, group.people_goal, group.description])

  async function submitUpdate(event) {
    event.preventDefault()
    if (!canManage) return
    const peopleGoal = Number(editDraft.peopleGoal)
    if (!editDraft.name.trim() || !editDraft.area.trim() || !Number.isFinite(peopleGoal) || peopleGoal < 3) return
    await onUpdateGroup(group.id, {
      name: editDraft.name.trim(),
      area: editDraft.area.trim(),
      people_goal: peopleGoal,
      description: editDraft.description.trim(),
    })
  }

  async function submitInvite(event) {
    event.preventDefault()
    if (!inviteEmail.trim()) return
    if (canManage) {
      await onAddMember(group.id, inviteEmail.trim())
    } else {
      await onSendMessage(group.id, `Pedido de convite para ${inviteEmail.trim()} enviado ao grupo.`)
    }
    setInviteEmail('')
  }

  async function submitContact(event) {
    event.preventDefault()
    if (!canManage || !selectedContactId) return
    await onAddContact(group.id, selectedContactId)
    setSelectedContactId('')
  }

  const groupRoleTone = canManage ? 'text-cyan-200 border-cyan-400/20 bg-cyan-400/10' : 'text-slate-300 border-slate-700 bg-slate-900/60'

  const panel = (
    <div className={[embedded ? 'glass-panel w-full rounded-2xl p-4 shadow-2xl sm:p-5' : 'glass-panel max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl p-4 shadow-2xl sm:p-5'].join(' ')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-cyan-400">Acessar dados do grupo</p>
          <h2 className="mt-1 text-2xl font-black text-slate-100">{group.name}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">{group.area || 'Área não informada'} · {group.people_goal || 3}+ pessoas</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${groupRoleTone}`}>{roleLabel}</span>
            <span className="text-xs font-semibold text-slate-400">{currentUser?.name || 'Você'}</span>
          </div>
        </div>
        {!embedded ? (
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-900 p-2 text-slate-400" aria-label="Fechar">
            <X size={18} />
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="space-y-4">
          <section className="glass-panel-soft rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-200">
                <UsersRound size={18} />
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-100">Ficha do grupo</h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Essa área concentra a gestão do grupo. O chat principal fica fora daqui para não misturar conversa com ficha.</p>
              </div>
            </div>
            <form onSubmit={submitUpdate} className="mt-4 grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Nome" required>
                  <input value={editDraft.name} onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))} className="field-input" disabled={!canManage} />
                </Field>
                <Field label="Área atendida" required>
                  <input value={editDraft.area} onChange={(event) => setEditDraft((current) => ({ ...current, area: event.target.value }))} className="field-input" disabled={!canManage} />
                </Field>
                <Field label="Número de pessoas" required>
                  <input value={editDraft.peopleGoal} onChange={(event) => setEditDraft((current) => ({ ...current, peopleGoal: event.target.value }))} className="field-input" type="number" min="3" disabled={!canManage} />
                </Field>
              </div>
              <Field label="Descrição">
                <textarea value={editDraft.description} onChange={(event) => setEditDraft((current) => ({ ...current, description: event.target.value }))} className="field-input min-h-20 resize-y" disabled={!canManage} />
              </Field>
              <div className="flex justify-end">
                <button type="submit" disabled={!canManage} className="secondary-button inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">
                  <Pencil size={16} />
                  Salvar dados
                </button>
              </div>
            </form>
          </section>

          <section className="glass-panel-soft rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-200">
                <UsersRound size={18} />
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-100">Membros</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">O convite é direto para gestores e vira pedido no chat quando o usuário não é admin.</p>
              </div>
            </div>
            <form onSubmit={submitInvite} className="mt-4 flex gap-2">
              <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className="field-input h-10 flex-1" type="email" placeholder="email@exemplo.com" />
              <button type="submit" className="primary-button h-10 rounded-lg px-3 text-sm font-black">
                {canManage ? 'Convidar' : 'Solicitar'}
              </button>
            </form>
            <div className="mt-3 grid gap-2">
              {members.length ? members.map((member) => {
                const removable = canManage && member.role !== 'owner'
                const memberUser = users.find((profile) => String(profile.id) === String(member.user_id) || normalize(profile.email) === normalize(member.email))
                return (
                  <div key={member.id} className="rounded-lg border border-slate-800 bg-slate-950/35 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-100">{memberUser?.name || member.email}</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-widest text-slate-500">{member.role}</p>
                        {memberUser?.publicVisible ? <span className="mt-2 inline-flex rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-200">Perfil visível</span> : null}
                      </div>
                      {removable ? (
                        <button type="button" onClick={() => onRemoveMember(group.id, member)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-400/20 bg-rose-400/10 text-rose-200">
                          <X size={16} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              }) : <p className="rounded-lg border border-dashed border-slate-800 p-4 text-sm font-semibold text-slate-500">Nenhum membro além do owner por enquanto.</p>}
            </div>
          </section>

          <details className="glass-panel-soft rounded-xl p-4">
            <summary className="flex cursor-pointer list-none items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-200">
                <UsersRound size={18} />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-100">Contatos vinculados, avançado</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">O grafo do grupo continua restrito aos membros. Esta área fica recolhida para gestão administrativa.</p>
              </div>
            </summary>
            <div className="mt-4">
              <form onSubmit={submitContact} className="flex gap-2">
                <select value={selectedContactId} onChange={(event) => setSelectedContactId(event.target.value)} className="field-input h-10 flex-1" disabled={!canManage}>
                  <option value="">Escolha um contato</option>
                  {availableContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} · {contact.service}</option>)}
                </select>
                <button type="submit" disabled={!canManage} className="secondary-button h-10 rounded-lg px-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">
                  Adicionar
                </button>
              </form>
              <div className="mt-3 grid gap-2">
                {contacts.length ? contacts.map((contact) => (
                  <div key={contact.id} className="action-card rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => onNavigate(`${ROUTES.CONTACT}/${contact.id}`)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-black text-slate-100">{contact.name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{contact.service} · {contact.city || 'Sem cidade'}</p>
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        {selectedGroupFields.length ? (
                          <button type="button" onClick={() => onEditContact(contact)} className="secondary-button inline-flex h-9 items-center rounded-lg px-3 text-xs font-black">
                            Campos
                          </button>
                        ) : null}
                        {canManage ? (
                          <button type="button" onClick={() => onRemoveContact(group.id, contact)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-400/20 bg-rose-400/10 text-rose-200">
                            <X size={16} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )) : <p className="rounded-lg border border-dashed border-slate-800 p-4 text-sm font-semibold text-slate-500">Nenhum contato compartilhado neste grupo.</p>}
              </div>
            </div>
          </details>
        </div>

        <div className="space-y-4">
          <section className="glass-panel-soft rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-200">
                <MessageCircle size={18} />
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-100">Campos personalizados</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">Defina campos específicos do contexto do grupo.</p>
              </div>
            </div>
            <div className="mt-4">
              <CustomFieldDefinitionsManager
                managerKey={`group-fields-${group.id}`}
                title="Campos do grupo"
                description={canManage ? 'Crie campos específicos para contatos compartilhados neste contexto.' : 'Campos disponíveis para este grupo.'}
                definitions={selectedGroupFields}
                onSave={(payload) => onSaveCustomField({ ...payload, scope_type: 'group', scope_id: String(group.id) }, payload.id)}
                onDelete={onDeleteCustomField}
                canManage={canManage}
              />
            </div>
          </section>

          <section className="glass-panel-soft rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-200">
                <Route size={18} />
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-100">Resumo do grupo</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">Leitura rápida da rede compartilhada.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <PublicProfileText label="Área" value={group.area || 'Não informada'} />
              <PublicProfileText label="Meta" value={`${group.people_goal || 3}+ pessoas`} />
              <PublicProfileText label="Membros" value={members.length || group.member_count || 0} />
              <PublicProfileText label="Contatos" value={contacts.length || group.contact_count || 0} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )

  if (embedded) return panel

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-3 sm:items-center">
      {panel}
    </div>
  )
}
