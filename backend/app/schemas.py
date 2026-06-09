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
    solves: str | None = Field(default="", max_length=800)
    tags: str | None = Field(default="", max_length=500)
    email: str | None = Field(default="", max_length=160)
    whatsapp: str | None = Field(default="", max_length=80)
    instagram: str | None = Field(default="", max_length=160)
    linkedin: str | None = Field(default="", max_length=200)
    custom_url: str | None = Field(default="", max_length=240)
    custom_fields: str | None = Field(default="[]", max_length=2000)
    crm_status: str | None = Field(default="Novo", max_length=40)
    crm_priority: str | None = Field(default="Média", max_length=20)
    last_contact_at: str | None = Field(default="", max_length=20)
    next_follow_up_at: str | None = Field(default="", max_length=32)
    crm_note: str | None = Field(default="", max_length=500)


class ContactOut(BaseModel):
    id: int
    owner_id: str
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
    solves: str
    tags: str
    email: str
    whatsapp: str
    instagram: str
    linkedin: str
    custom_url: str
    custom_fields: str
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
    source_user_id: int | None = None
    category: CategoryOut


class SearchOut(BaseModel):
    query: str
    private_results: list[ContactOut]
    public_results: list[PublicProfileOut]
    has_private_results: bool


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


class AiChatOut(BaseModel):
    answer: str
    suggestions: list[AiSuggestionOut] = []
    provider: str = "local"


class MergeSuggestionOut(BaseModel):
    id: str
    owner_id: str
    match_type: str
    match_value: str
    primary_contact: ContactOut
    duplicate_contact: ContactOut


class MergeDecisionIn(BaseModel):
    owner_id: str = Field(default="demo-user", max_length=80)
    primary_contact_id: int
    duplicate_contact_id: int


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
    google_connected: bool = False
    google_contacts_imported_at: str | None = Field(default="", max_length=40)
    google_profile_synced_at: str | None = Field(default="", max_length=40)
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
    google_connected: bool = False
    google_contacts_imported_at: str = ""
    google_profile_synced_at: str = ""
    role: str


class LoginIn(BaseModel):
    email: str = Field(min_length=4, max_length=160)
    password: str = Field(min_length=1, max_length=160)


class GoogleLoginIn(BaseModel):
    sub: str = Field(min_length=2, max_length=160)
    email: str = Field(min_length=4, max_length=160)
    name: str = Field(min_length=1, max_length=120)
    picture: str | None = Field(default="", max_length=300)


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
