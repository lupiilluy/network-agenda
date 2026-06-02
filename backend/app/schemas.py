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
    category: CategoryOut


class SearchOut(BaseModel):
    query: str
    private_results: list[ContactOut]
    public_results: list[PublicProfileOut]
    has_private_results: bool


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    birth_date: str | None = Field(default="", max_length=20)
    email: str = Field(min_length=4, max_length=160)
    password: str | None = Field(default="", max_length=160)
    phone: str = Field(min_length=4, max_length=40)
    cep: str | None = Field(default="", max_length=20)
    address: str | None = Field(default="", max_length=240)
    city: str | None = Field(default="", max_length=120)
    state: str | None = Field(default="", max_length=40)
    address_visible: bool = False
    interests: list[str] = []
    is_collaborator: bool = False
    offered_services: str | None = Field(default="", max_length=300)
    service_address: str | None = Field(default="", max_length=240)
    service_address_visible: bool = True
    role: str | None = Field(default="user", max_length=40)


class UserOut(BaseModel):
    id: int
    name: str
    birth_date: str
    email: str
    phone: str
    cep: str
    address: str
    city: str
    state: str
    address_visible: bool = False
    interests: list[str] = []
    is_collaborator: bool = False
    offered_services: str
    service_address: str
    service_address_visible: bool = True
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


class AddressLookupOut(BaseModel):
    query: str
    results: list[AddressOptionOut]
