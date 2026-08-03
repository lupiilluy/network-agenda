import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  Circle,
  Cloud,
  Compass,
  Lock,
  MessageCircle,
  Pencil,
  Route,
  Upload,
  UsersRound,
} from 'lucide-react'
import {
  Avatar,
  CustomFieldDefinitionsManager,
  NOTIFICATION_OPTIONS,
  PageTitle,
  ROUTES,
  SettingsAction,
  SettingsRow,
  formatDateTime,
  normalizeUserDraft,
  offlineMutationRecoveryHint,
  offlineMutationReviewRoute,
  offlineMutationStatus,
  offlineMutationStatusClass,
  offlineMutationStatusLabel,
  offlineMutationTitle,
} from './App.jsx'

function integrationStatusMeta(status) {
  switch (status) {
    case 'implemented':
      return {
        label: 'Disponível',
        tone: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
        icon: CheckCircle,
      }
    case 'blocked_by_credentials':
      return {
        label: 'Bloqueado por credenciais',
        tone: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
        icon: Lock,
      }
    default:
      return {
        label: 'Em preparação',
        tone: 'border-slate-700 bg-slate-950/60 text-slate-300',
        icon: Circle,
      }
  }
}

function formatRequirementLabel(value) {
  return String(value || '')
    .replace(/^VITE_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

function ImportIntegrationCard({ integration, onNavigate, onImportGoogleContacts }) {
  const status = integrationStatusMeta(integration.status)
  const StatusIcon = status.icon
  const isBlocked = integration.status === 'blocked_by_credentials'
  const supportedFormats = Array.isArray(integration.supported_formats) ? integration.supported_formats : []
  const requirements = Array.isArray(integration.credential_requirements) ? integration.credential_requirements : []

  return (
    <article className="action-card rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-100">{integration.label}</h3>
            <span className={['inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-widest', status.tone].join(' ')}>
              <StatusIcon size={12} />
              {status.label}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{integration.description}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {supportedFormats.map((format) => (
          <span key={format} className="rounded-full border border-slate-800 bg-slate-950/50 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-slate-300">
            {format}
          </span>
        ))}
      </div>

      {requirements.length ? (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/35 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Credenciais esperadas</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {requirements.map((requirement) => (
              <span key={requirement} className="rounded-md border border-slate-800 bg-slate-950/80 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                {formatRequirementLabel(requirement)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {integration.blocked_reason ? (
        <div className="mt-3 rounded-lg border border-amber-400/15 bg-amber-500/5 p-3">
          <p className="flex items-start gap-2 text-sm font-semibold leading-6 text-amber-100/90">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{integration.blocked_reason}</span>
          </p>
        </div>
      ) : null}

      {integration.setup_hint ? <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{integration.setup_hint}</p> : null}

      <button
        type="button"
        onClick={async () => {
          if (integration.provider === 'google_contacts' && onImportGoogleContacts) {
            await onImportGoogleContacts()
            return
          }
          onNavigate?.(ROUTES.IMPORT)
        }}
        className={[
          'mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black',
          isBlocked ? 'secondary-button' : 'primary-button',
        ].join(' ')}
      >
        {integration.action_label || (isBlocked ? 'Ver requisitos' : 'Abrir central')}
      </button>
    </article>
  )
}

export default function SettingsPageSection({ user, contacts, duplicateCount, backendOnline, pendingMutations, recents, customFieldDefinitions, importIntegrations, onNavigate, onRefreshDuplicates, onImportGoogleContacts, onSyncPending, onRetryPendingMutation, onDismissPendingMutation, onDiscardGoogleImportPending, onExportContacts, onClearRecents, onSaveCustomField, onDeleteCustomField, onSaveUser, onSendPushTest, onLogout }) {
  const visibleName = user?.name || 'Perfil'
  const googleContactsImported = Boolean(user?.googleContactsImportedAt)
  const [notificationPreference, setNotificationPreference] = useState(user?.notificationPreference || 'relevant')
  const selectedNotification = NOTIFICATION_OPTIONS.find((option) => option.id === notificationPreference) ?? NOTIFICATION_OPTIONS[0]
  const importCatalog = Array.isArray(importIntegrations) ? importIntegrations : []

  useEffect(() => {
    setNotificationPreference(user?.notificationPreference || 'relevant')
  }, [user?.notificationPreference])

  async function saveNotificationPreference() {
    if (!user) return
    await onSaveUser?.(
      normalizeUserDraft({ ...user, notificationPreference }),
      [],
      { redirectTo: ROUTES.SETTINGS, successMessage: 'Preferência de notificações salva.' },
    )
  }

  return (
    <div className="space-y-4">
      <PageTitle eyebrow="Configurações" title="Menu da conta" description="Perfil, organização da agenda, dados locais e estado do app." />

      {pendingMutations.length ? (
        <section className="glass-panel rounded-lg border-amber-400/20 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-200">Sincronização pendente</p>
              <h2 className="mt-1 text-base font-black text-slate-100">
                {pendingMutations.length} alteração{pendingMutations.length === 1 ? '' : 'es'} salva{pendingMutations.length === 1 ? '' : 's'} neste dispositivo
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Elas serão enviadas automaticamente quando a API voltar a responder.</p>
            </div>
            <button type="button" onClick={onSyncPending} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-amber-300 px-3 text-sm font-black text-slate-950">
              <Cloud size={17} />
              Sincronizar agora
            </button>
            {pendingMutations.some((mutation) => mutation.type === 'contact:create' && mutation.payload?.source === 'Google People API') ? (
              <button type="button" onClick={onDiscardGoogleImportPending} className="secondary-button inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black">
                Descartar importações antigas
              </button>
            ) : null}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {pendingMutations.slice(0, 6).map((mutation) => (
              <div key={mutation.id} className="rounded-lg border border-slate-800 bg-slate-950/35 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-200">{offlineMutationTitle(mutation)}</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">{formatDateTime(mutation.createdAt)}</p>
                  </div>
                  <span className={['rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-widest', offlineMutationStatusClass(mutation)].join(' ')}>
                    {offlineMutationStatusLabel(mutation)}
                  </span>
                </div>
                {mutation.attemptCount ? <p className="mt-1 text-[11px] font-semibold text-slate-500">{mutation.attemptCount} tentativa{mutation.attemptCount === 1 ? '' : 's'}</p> : null}
                {mutation.lastError ? <p className="mt-1 text-xs font-semibold text-amber-200">{mutation.lastError}</p> : null}
                {offlineMutationRecoveryHint(mutation) ? <p className="mt-1 text-[11px] font-semibold text-slate-400">{offlineMutationRecoveryHint(mutation)}</p> : null}
                {offlineMutationStatus(mutation) !== 'syncing' ? (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {(offlineMutationStatus(mutation) === 'conflict' || offlineMutationStatus(mutation) === 'failed') ? (
                      <button type="button" onClick={() => onRetryPendingMutation?.(mutation)} className="text-xs font-black text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline">
                        Tentar novamente
                      </button>
                    ) : null}
                    {offlineMutationReviewRoute(mutation) !== ROUTES.SETTINGS ? (
                      <button type="button" onClick={() => onNavigate?.(offlineMutationReviewRoute(mutation))} className="text-xs font-black text-slate-300 underline-offset-4 hover:text-slate-100 hover:underline">
                        Revisar contexto
                      </button>
                    ) : null}
                    <button type="button" onClick={() => onDismissPendingMutation?.(mutation)} className="text-xs font-black text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline">
                      Descartar desta fila
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="glass-panel rounded-lg p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              name={visibleName}
              src={user?.avatarUrl}
              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cyan-500 ring-1 ring-white/10"
              fallbackClassName="flex h-full w-full items-center justify-center rounded-[inherit] bg-cyan-500 text-base font-black text-slate-950"
            />
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

      <section className="glass-panel rounded-lg p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-cyan-400">Notificações</p>
            <h2 className="mt-1 text-base font-black text-slate-100">Relevância dos alertas</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{selectedNotification.description}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={notificationPreference} onChange={(event) => setNotificationPreference(event.target.value)} className="field-input h-10 min-w-[220px]">
              {NOTIFICATION_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <button type="button" onClick={saveNotificationPreference} className="primary-button h-10 rounded-lg px-3 text-sm font-black">Salvar</button>
            <button type="button" onClick={onSendPushTest} className="secondary-button h-10 rounded-lg px-3 text-sm font-black">Enviar push teste</button>
          </div>
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
          icon={Upload}
          title="Central de importação"
          description="Abra a tela dedicada para Google Contacts, CSV/VCF e cadastro manual."
          actionLabel="Abrir"
          onAction={() => onNavigate(ROUTES.IMPORT)}
        />
        <SettingsAction
          icon={Pencil}
          title="Campos personalizados"
          description="Gerencie a estrutura da agenda e acesse os grupos com campos próprios."
          actionLabel="Abrir"
          onAction={() => onNavigate(ROUTES.CUSTOM_FIELDS)}
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
        <SettingsAction
          icon={Route}
          title="API e OpenAPI"
          description="Documentação base para integrações futuras, Swagger e especificação OpenAPI."
          actionLabel="Abrir docs"
          onAction={() => onNavigate(ROUTES.API_DOCS)}
        />
      </section>

      <section className="glass-panel rounded-lg p-4">
        <div className="mb-3">
          <p className="text-xs font-black uppercase tracking-widest text-cyan-400">Imports compatíveis</p>
          <h2 className="mt-1 text-base font-black text-slate-100">Centrais já cobertas pelo parser</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Use a central de importação para subir VCF do Apple Contacts/iCloud e CSVs compatíveis de Outlook ou LinkedIn.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <SettingsAction
            icon={Upload}
            title="Apple Contacts"
            description="VCF exportado do app Contatos ou iCloud já entra pelo importador atual."
            actionLabel="Abrir central"
            onAction={() => onNavigate(ROUTES.IMPORT)}
          />
          <SettingsAction
            icon={Upload}
            title="Outlook"
            description="CSV compatível do Outlook pode ser carregado agora pela central de importação."
            actionLabel="Abrir central"
            onAction={() => onNavigate(ROUTES.IMPORT)}
          />
          <SettingsAction
            icon={Upload}
            title="LinkedIn export"
            description="Exportações CSV compatíveis do LinkedIn são processadas pelo parser local."
            actionLabel="Abrir central"
            onAction={() => onNavigate(ROUTES.IMPORT)}
          />
        </div>
      </section>

      <section className="glass-panel rounded-lg p-4">
        <div className="mb-3">
          <p className="text-xs font-black uppercase tracking-widest text-cyan-400">Conectores nativos</p>
          <h2 className="mt-1 text-base font-black text-slate-100">Prontos no produto, bloqueados por credenciais</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">A interface e os caminhos de importação já estão preparados. O bloqueio aqui é de credenciais e ativação de provedor, não de UX.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {importCatalog.length ? importCatalog.map((integration) => (
            <ImportIntegrationCard key={integration.provider} integration={integration} onNavigate={onNavigate} onImportGoogleContacts={onImportGoogleContacts} />
          )) : (
            <>
              <article className="action-card rounded-lg p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black text-slate-100">Apple Contacts nativo</h3>
                  <span className="rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Bloqueado</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-500">Conector preparado para ativação quando as credenciais Apple estiverem disponíveis.</p>
              </article>
              <article className="action-card rounded-lg p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black text-slate-100">Outlook nativo</h3>
                  <span className="rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Bloqueado</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-500">Conector preparado para ativação quando as credenciais Microsoft estiverem disponíveis.</p>
              </article>
              <article className="action-card rounded-lg p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black text-slate-100">LinkedIn guiado</h3>
                  <span className="rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Bloqueado</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-500">Fluxo guiado preparado para ativação quando houver credenciais e liberação do provedor.</p>
              </article>
            </>
          )}
        </div>
      </section>

      <CustomFieldDefinitionsManager
        managerKey="user-fields"
        title="Campos personalizados da agenda"
        description="Esses campos aparecem no cadastro e edição dos seus contatos privados."
        definitions={customFieldDefinitions}
        onSave={(payload) => onSaveCustomField({ ...payload, scope_type: 'user', scope_id: '' }, payload.id)}
        onDelete={onDeleteCustomField}
      />

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
