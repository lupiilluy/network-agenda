from __future__ import annotations

from pydantic import BaseModel, Field


class CategoryOut(BaseModel):
    id: str
    label: str
    group: str
    keywords: list[str] = []
    synonyms: list[str] = []
    count: int = 0


class ContactCreate(BaseModel):
    owner_id: str | None = Field(default="demo-user", max_length=80)
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=4, max_length=40)
    service: str = Field(min_length=2, max_length=160)
    note: str | None = Field(default="", max_length=500)
    city: str | None = Field(default=None, max_length=120)
    address: str | None = Field(default=None, max_length=240)
    trust: str | None = Field(default="Novo", max_length=40)
    source: str | None = Field(default="Manual", max_length=80)
    description: str | None = Field(default="", max_length=1200)
    demand: str | None = Field(default="", max_length=800)
    demand_tags: str | None = Field(default="", max_length=500)
    solves: str | None = Field(default="", max_length=800)
    tags: str | None = Field(default="", max_length=500)
    email: str | None = Field(default="", max_length=160)
    whatsapp: str | None = Field(default="", max_length=80)
    instagram: str | None = Field(default="", max_length=160)
    linkedin: str | None = Field(default="", max_length=200)
    organization: str | None = Field(default="", max_length=200)
    custom_url: str | None = Field(default="", max_length=240)
    avatar_url: str | None = Field(default="", max_length=200000)
    custom_fields: str | None = Field(default="[]", max_length=2000)
    phones: list[dict | str] = []
    emails: list[dict | str] = []
    tag_items: list[dict | str] = []
    custom_field_values: list[dict] = []
    crm_status: str | None = Field(default="Novo", max_length=40)
    crm_priority: str | None = Field(default="Média", max_length=20)
    last_contact_at: str | None = Field(default="", max_length=20)
    next_follow_up_at: str | None = Field(default="", max_length=32)
    crm_note: str | None = Field(default="", max_length=500)


class ContactOut(BaseModel):
    id: int
    owner_id: str
    linked_user_id: str = ""
    linked_user_name: str = ""
    linked_user_email: str = ""
    name: str
    phone: str
    service: str
    note: str
    city: str
    address: str
    trust: str
    source: str
    description: str
    demand: str
    demand_tags: str = ""
    solves: str
    tags: str
    email: str
    whatsapp: str
    instagram: str
    linkedin: str
    organization: str = ""
    custom_url: str
    avatar_url: str
    custom_fields: str
    phones: list[dict] = []
    emails: list[dict] = []
    tag_items: list[str] = []
    ddd: str = ""
    custom_field_values: list[dict] = []
    platform_match: dict | None = None
    public_profile_match: dict | None = None
    potential_matches: list[dict] = []
    crm_status: str
    crm_priority: str
    last_contact_at: str
    next_follow_up_at: str
    crm_note: str
    category: CategoryOut
    created_at: str


class PublicProfileOut(BaseModel):
    id: int
    name: str
    service: str
    area: str
    people: int
    response: str
    score: float
    kind: str = "group"
    description: str = ""
    demand: str = ""
    solves: str = ""
    tags: str = ""
    phone: str = ""
    email: str = ""
    whatsapp: str = ""
    instagram: str = ""
    linkedin: str = ""
    custom_url: str = ""
    avatar_url: str = ""
    source_user_id: int | None = None
    category: CategoryOut


class SearchOut(BaseModel):
    query: str
    private_results: list[ContactOut]
    public_results: list[PublicProfileOut]
    has_private_results: bool
    insights: list[str] = []


class AiSuggestionOut(BaseModel):
    contact_id: int
    name: str
    current_service: str
    suggested_service: str
    category_id: str
    category_label: str
    reason: str
    action: str = "categorize"
    label: str | None = ""
    crm_status: str | None = ""
    crm_priority: str | None = ""
    last_contact_at: str | None = ""
    next_follow_up_at: str | None = ""
    crm_note: str | None = ""


class AiChatIn(BaseModel):
    user_id: str = Field(default="demo-user", max_length=80)
    message: str = Field(min_length=1, max_length=1200)
    target_contact_id: int | None = None
    group_id: int | None = None
    thread_id: int | None = None


class AiChatOut(BaseModel):
    answer: str
    suggestions: list[AiSuggestionOut] = []
    provider: str = "local"
    thread_id: int | None = None


class ChatThreadCreate(BaseModel):
    user_id: str = Field(default="demo-user", max_length=80)
    title: str | None = Field(default="", max_length=160)


class ChatThreadOut(BaseModel):
    id: int
    owner_id: str
    title: str
    last_message_preview: str = ""
    message_count: int = 0
    created_at: str
    updated_at: str


class ChatMessageCreate(BaseModel):
    user_id: str = Field(default="demo-user", max_length=80)
    role: str = Field(min_length=1, max_length=30)
    text: str = Field(min_length=1, max_length=4000)
    provider: str | None = Field(default="", max_length=40)
    suggestions: list[dict] = []
    cta_label: str | None = Field(default="", max_length=120)
    cta_route: str | None = Field(default="", max_length=240)


class ChatMessageOut(BaseModel):
    id: int
    thread_id: int
    owner_id: str
    role: str
    text: str
    provider: str = ""
    suggestions: list[dict] = []
    cta: dict | None = None
    created_at: str


class ImportJobCreate(BaseModel):
    user_id: str = Field(default="demo-user", max_length=80)
    source: str = Field(min_length=2, max_length=80)
    filename: str | None = Field(default="", max_length=240)
    status: str = Field(default="completed", max_length=40)
    total_count: int = Field(default=0, ge=0, le=100000)
    imported_count: int = Field(default=0, ge=0, le=100000)
    skipped_count: int = Field(default=0, ge=0, le=100000)
    failed_count: int = Field(default=0, ge=0, le=100000)
    details: str | None = Field(default="", max_length=1200)


class ImportJobOut(BaseModel):
    id: int
    owner_id: str
    source: str
    filename: str = ""
    status: str
    total_count: int = 0
    imported_count: int = 0
    skipped_count: int = 0
    failed_count: int = 0
    details: str = ""
    created_at: str


class PushSubscriptionCreate(BaseModel):
    user_id: str = Field(default="demo-user", max_length=80)
    endpoint: str = Field(min_length=12, max_length=2000)
    p256dh_key: str | None = Field(default="", max_length=600)
    auth_key: str | None = Field(default="", max_length=600)
    expiration_time: int | None = Field(default=None, ge=0)
    user_agent: str | None = Field(default="", max_length=600)
    device_label: str | None = Field(default="", max_length=160)


class PushSubscriptionOut(BaseModel):
    id: int
    owner_id: str
    endpoint: str
    p256dh_key: str = ""
    auth_key: str = ""
    expiration_time: int | None = None
    user_agent: str = ""
    device_label: str = ""
    created_at: str
    updated_at: str


class PushTestNotificationIn(BaseModel):
    user_id: str = Field(default="demo-user", max_length=80)
    subscription_id: int | None = None
    title: str | None = Field(default="Network Intelligence CRM", max_length=120)
    body: str | None = Field(default="Seu dispositivo está pronto para receber alertas.", max_length=500)
    route: str | None = Field(default="/configuracoes", max_length=240)


class MergeSuggestionOut(BaseModel):
    id: str
    owner_id: str
    match_type: str
    match_value: str
    primary_contact: ContactOut
    duplicate_contact: ContactOut


class PushDispatchIn(BaseModel):
    user_id: str = Field(default="demo-user", max_length=80)
    kinds: list[str] = []


class PushDispatchOut(BaseModel):
    sent: int = 0
    failed: int = 0
    removed: int = 0
    events: list[str] = []


class MergeDecisionIn(BaseModel):
    owner_id: str = Field(default="demo-user", max_length=80)
    primary_contact_id: int
    duplicate_contact_id: int


class GroupCreate(BaseModel):
    owner_id: str = Field(default="demo-user", max_length=80)
    name: str = Field(min_length=2, max_length=140)
    area: str = Field(min_length=2, max_length=160)
    people_goal: int = Field(ge=3, le=100000)
    description: str | None = Field(default="", max_length=1000)


class GroupMemberCreate(BaseModel):
    requester_id: str = Field(default="demo-user", max_length=80)
    user_id: str | None = Field(default="", max_length=80)
    email: str = Field(min_length=4, max_length=160)
    role: str | None = Field(default="member", max_length=30)


class GroupContactLinkIn(BaseModel):
    requester_id: str = Field(default="demo-user", max_length=80)
    owner_id: str = Field(default="demo-user", max_length=80)
    contact_id: int


class GroupMessageCreate(BaseModel):
    requester_id: str = Field(default="demo-user", max_length=80)
    message: str = Field(min_length=1, max_length=2000)


class GroupMemberOut(BaseModel):
    id: int
    group_id: int
    user_id: str
    email: str
    role: str
    status: str
    created_at: str


class GroupOut(BaseModel):
    id: int
    owner_id: str
    name: str
    area: str
    people_goal: int
    description: str
    created_by_email: str
    member_count: int
    contact_count: int
    members: list[GroupMemberOut] = []
    created_at: str


class GroupMessageOut(BaseModel):
    id: int
    group_id: int
    sender_id: str
    sender_name: str
    sender_email: str
    message: str
    created_at: str


class CustomFieldDefinitionIn(BaseModel):
    owner_id: str = Field(default="demo-user", max_length=80)
    scope_type: str = Field(default="user", max_length=20)
    scope_id: str | None = Field(default="", max_length=80)
    name: str = Field(min_length=1, max_length=120)
    field_key: str | None = Field(default="", max_length=120)
    field_type: str = Field(default="text_short", max_length=40)
    options: list[str] = []


class CustomFieldDefinitionOut(BaseModel):
    id: int
    owner_id: str
    scope_type: str
    scope_id: str
    name: str
    field_key: str
    field_type: str
    options: list[str] = []
    created_at: str


class GroupContactCustomFieldsIn(BaseModel):
    requester_id: str = Field(default="demo-user", max_length=80)
    owner_id: str = Field(default="demo-user", max_length=80)
    custom_field_values: list[dict] = []


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    birth_date: str | None = Field(default="", max_length=20)
    email: str = Field(min_length=4, max_length=160)
    password: str | None = Field(default="", max_length=160)
    phone: str = Field(min_length=4, max_length=40)
    cep: str | None = Field(default="", max_length=20)
    address: str | None = Field(default="", max_length=240)
    address_line: str | None = Field(default="", max_length=160)
    address_number: str | None = Field(default="", max_length=40)
    address_complement: str | None = Field(default="", max_length=120)
    neighborhood: str | None = Field(default="", max_length=120)
    city: str | None = Field(default="", max_length=120)
    state: str | None = Field(default="", max_length=40)
    address_visible: bool = False
    interests: list[str] = []
    is_collaborator: bool = False
    offered_services: str | None = Field(default="", max_length=300)
    use_different_service_address: bool = False
    service_cep: str | None = Field(default="", max_length=20)
    service_address: str | None = Field(default="", max_length=240)
    service_address_line: str | None = Field(default="", max_length=160)
    service_address_number: str | None = Field(default="", max_length=40)
    service_address_complement: str | None = Field(default="", max_length=120)
    service_neighborhood: str | None = Field(default="", max_length=120)
    service_city: str | None = Field(default="", max_length=120)
    service_state: str | None = Field(default="", max_length=40)
    service_address_visible: bool = True
    public_visible: bool = False
    public_description: str | None = Field(default="", max_length=1200)
    public_demand: str | None = Field(default="", max_length=800)
    public_solves: str | None = Field(default="", max_length=800)
    public_tags: str | None = Field(default="", max_length=500)
    public_whatsapp: str | None = Field(default="", max_length=80)
    public_instagram: str | None = Field(default="", max_length=160)
    public_linkedin: str | None = Field(default="", max_length=200)
    public_url: str | None = Field(default="", max_length=240)
    avatar_url: str | None = Field(default="", max_length=200000)
    google_connected: bool = False
    google_contacts_imported_at: str | None = Field(default="", max_length=40)
    google_profile_synced_at: str | None = Field(default="", max_length=40)
    notification_preference: str | None = Field(default="relevant", max_length=40)
    role: str | None = Field(default="user", max_length=40)


class UserOut(BaseModel):
    id: int
    name: str
    birth_date: str
    email: str
    phone: str
    cep: str
    address: str
    address_line: str = ""
    address_number: str = ""
    address_complement: str = ""
    neighborhood: str = ""
    city: str
    state: str
    address_visible: bool = False
    interests: list[str] = []
    is_collaborator: bool = False
    offered_services: str
    use_different_service_address: bool = False
    service_cep: str = ""
    service_address: str
    service_address_line: str = ""
    service_address_number: str = ""
    service_address_complement: str = ""
    service_neighborhood: str = ""
    service_city: str = ""
    service_state: str = ""
    service_address_visible: bool = True
    public_visible: bool = False
    public_description: str = ""
    public_demand: str = ""
    public_solves: str = ""
    public_tags: str = ""
    public_whatsapp: str = ""
    public_instagram: str = ""
    public_linkedin: str = ""
    public_url: str = ""
    avatar_url: str = ""
    google_connected: bool = False
    google_contacts_imported_at: str = ""
    google_profile_synced_at: str = ""
    notification_preference: str = "relevant"
    role: str


class LoginIn(BaseModel):
    email: str = Field(min_length=4, max_length=160)
    password: str = Field(min_length=1, max_length=160)


class GoogleLoginIn(BaseModel):
    sub: str = Field(min_length=2, max_length=160)
    email: str = Field(min_length=4, max_length=160)
    name: str = Field(min_length=1, max_length=120)
    picture: str | None = Field(default="", max_length=300)


class AuthSessionIn(BaseModel):
    sub: str | None = Field(default="", max_length=160)
    email: str = Field(min_length=4, max_length=160)
    name: str | None = Field(default="", max_length=120)
    picture: str | None = Field(default="", max_length=300)
    auth_provider: str | None = Field(default="", max_length=40)


class AuthStatusOut(BaseModel):
    supabase_auth_required: bool
    production_auth_enforced: bool = False
    demo_fallback_enabled: bool = True
    configured_supabase_url: bool
    configured_supabase_jwt_secret: bool
    configured_web_push_vapid: bool
    jwt_library_available: bool
    legacy_password_login_enabled: bool
    jwt_validation_mode: str
    database_dialect: str = ""
    rls_supported: bool = False
    rls_ready: bool = False
    rls_enabled_tables: int = 0
    rls_total_tables: int = 0
    production_auth_ready: bool = False
    warnings: list[str] = []
    authenticated: bool
    current_user_email: str = ""
    current_owner_id: str = ""
    current_provider: str = ""


class ImportIntegrationOut(BaseModel):
    provider: str
    label: str
    status: str
    mode: str
    description: str
    supported_formats: list[str] = []
    credential_requirements: list[str] = []
    blocked_reason: str = ""
    setup_hint: str = ""
    available: bool = False
    action_label: str = ""


class AddressOptionOut(BaseModel):
    address: str
    city: str
    state: str
    cep: str
    lat: float | None = None
    lng: float | None = None


class AddressLookupOut(BaseModel):
    query: str
    results: list[AddressOptionOut]


class GraphNodeOut(BaseModel):
    id: str
    label: str
    type: str
    scope: str = "private"
    weight: float = 1
    meta: dict = {}


class GraphEdgeOut(BaseModel):
    id: str
    source: str
    target: str
    type: str
    weight: float = 1
    meta: dict = {}


class GraphOut(BaseModel):
    scope: str
    nodes: list[GraphNodeOut]
    edges: list[GraphEdgeOut]
    filters: dict = {}
