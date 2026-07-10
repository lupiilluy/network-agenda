import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import {
  ChatSuggestionReviewModal,
  PageTitle,
  ROUTES,
  categoryDetails,
  contactCustomFieldSearchValues,
  formatFollowUp,
  isGenericService,
  matchText,
  normalize,
  targetContactOptionValue,
  targetContactServiceLabel,
} from './App.jsx'

export default function ChatPageSection({ contacts, messages, threads, activeThreadId, onSelectThread, onCreateThread, onAsk, onApplySuggestion, onNavigate, isThinking }) {
  const [draft, setDraft] = useState('')
  const [selectedContactId, setSelectedContactId] = useState('')
  const [targetInput, setTargetInput] = useState('')
  const [pendingSuggestion, setPendingSuggestion] = useState(null)
  const [isApplyingSuggestion, setIsApplyingSuggestion] = useState(false)
  const messagesEndRef = useRef(null)
  const reviewCount = contacts.filter((contact) => contact.category?.id === 'general' || isGenericService(contact.service)).length
  const lastSuggestions = [...messages].reverse().find((message) => message.suggestions?.length)?.suggestions ?? []
  const visibleSuggestions = lastSuggestions.slice(0, 4)
  const selectedContact = contacts.find((contact) => String(contact.id) === selectedContactId)
  const pendingSuggestionContact = pendingSuggestion
    ? contacts.find((contact) => String(contact.id) === String(pendingSuggestion.contact_id))
    : null
  const targetContactOptions = useMemo(() => {
    const normalizedSearch = normalize(targetInput)
    const ordered = contacts
      .slice()
      .filter((contact) => {
        if (!normalizedSearch) return true
        const label = targetContactServiceLabel(contact)
        return matchText(normalizedSearch, [contact.name, contact.service, label, contact.phone, contact.city, contact.organization, targetContactOptionValue(contact), ...contactCustomFieldSearchValues(contact)])
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

  async function confirmPendingSuggestion() {
    if (!pendingSuggestion || !pendingSuggestionContact || isApplyingSuggestion) return
    setIsApplyingSuggestion(true)
    try {
      await onApplySuggestion(pendingSuggestion)
      setPendingSuggestion(null)
    } finally {
      setIsApplyingSuggestion(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle
        eyebrow="Copiloto"
        title="Chat de organização"
        description={`${reviewCount} contato${reviewCount === 1 ? '' : 's'} precisam de revisão. Peça ajuda para categorizar, buscar serviços ou organizar importações do Google.`}
        action={
          <button type="button" onClick={() => onCreateThread?.('')} className="secondary-button inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-black">
            <Plus size={16} />
            Nova conversa
          </button>
        }
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
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-slate-100">Conversas</h2>
                <p className="text-xs font-semibold text-slate-500">{threads?.length || 0} thread{threads?.length === 1 ? '' : 's'} salva{threads?.length === 1 ? '' : 's'}</p>
              </div>
              <button type="button" onClick={() => onCreateThread?.('')} className="secondary-button inline-flex h-8 items-center justify-center rounded-lg px-2 text-xs font-black">
                Nova
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {threads?.length ? threads.slice(0, 8).map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => onSelectThread?.(thread.id)}
                  className={['w-full rounded-lg border px-3 py-2 text-left transition', String(thread.id) === String(activeThreadId) ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'].join(' ')}
                >
                  <p className="truncate text-sm font-black text-slate-100">{thread.title || 'Nova conversa'}</p>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{thread.last_message_preview || 'Ainda sem mensagens.'}</p>
                </button>
              )) : <p className="rounded-lg border border-dashed border-slate-800 p-3 text-xs font-semibold text-slate-500">A primeira pergunta já cria uma conversa persistente.</p>}
            </div>
          </div>

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
                    <button
                      type="button"
                      onClick={() => setPendingSuggestion(suggestion)}
                      disabled={suggestion.action === 'conflict'}
                      className="primary-button h-9 shrink-0 rounded-lg px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {suggestion.action === 'conflict' ? 'Bloqueado' : 'Revisar'}
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

      <ChatSuggestionReviewModal
        suggestion={pendingSuggestion}
        contact={pendingSuggestionContact}
        isApplying={isApplyingSuggestion}
        onClose={() => {
          if (!isApplyingSuggestion) setPendingSuggestion(null)
        }}
        onConfirm={confirmPendingSuggestion}
      />
    </div>
  )
}
