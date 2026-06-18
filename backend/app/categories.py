from __future__ import annotations

import unicodedata
from dataclasses import dataclass


@dataclass(frozen=True)
class Category:
    id: str
    label: str
    group: str
    keywords: tuple[str, ...]
    synonyms: tuple[str, ...]


CATEGORY_CATALOG: tuple[Category, ...] = (
    Category(
        id="home",
        label="Casa e manutenção",
        group="Serviços domésticos",
        keywords=("eletricista", "encanador", "pintor", "pintura", "reforma", "pedreiro", "marceneiro", "limpeza", "jardineiro", "diarista", "faxina", "montador", "chaveiro", "vidraceiro", "gesseiro"),
        synonyms=("instalacao", "reparo", "emergencia", "manutencao", "residencial", "obra", "condominio"),
    ),
    Category(
        id="legal",
        label="Jurídico",
        group="Serviços profissionais",
        keywords=("advogado", "advogada", "juridico", "juridica", "trabalhista", "contrato", "contratos", "civil", "tributario", "previdenciario", "familia", "cartorio"),
        synonyms=("processo", "direito", "documentos", "defesa", "regularizacao"),
    ),
    Category(
        id="health",
        label="Saúde",
        group="Cuidado pessoal",
        keywords=("medico", "medica", "dentista", "psicologo", "psicologa", "fisioterapeuta", "nutricionista", "enfermeiro", "enfermeira", "fono", "terapeuta", "ortopedista", "pediatra", "dermato", "hospital", "drogaria", "farmacia"),
        synonyms=("consulta", "tratamento", "clinica", "saude", "exame", "terapia", "remedio"),
    ),
    Category(
        id="business",
        label="Empresas e negócios",
        group="Operação",
        keywords=("consultor", "consultoria", "marketing", "vendas", "rh", "recrutamento", "gestor", "gestora", "administracao", "comercial", "coach", "mentoria empresarial"),
        synonyms=("empresa", "gestao", "estrategia", "operacao", "negocio", "b2b"),
    ),
    Category(
        id="tech",
        label="Tecnologia",
        group="Digital",
        keywords=("programador", "programadora", "desenvolvedor", "desenvolvedora", "designer", "ti", "suporte", "software", "web", "site", "app", "dados", "dev", "ux", "ui", "infra"),
        synonyms=("sistema", "automacao", "produto digital", "tecnologia", "informatica"),
    ),
    Category(
        id="education",
        label="Educação",
        group="Aulas e mentoria",
        keywords=("professor", "professora", "aula", "ingles", "matematica", "mentor", "mentoria", "instrutor", "instrutora", "escola", "faculdade", "tradutor", "tradutora", "creche"),
        synonyms=("curso", "reforco", "aprendizado", "ensino", "educacao"),
    ),
    Category(
        id="vehicle",
        label="Veículos",
        group="Mobilidade",
        keywords=("mecanico", "auto", "carro", "moto", "funilaria", "guincho", "motorista", "uber", "taxi", "lavagem", "estetica automotiva"),
        synonyms=("oficina", "revisao", "transporte", "veiculo", "automotivo"),
    ),
    Category(
        id="beauty",
        label="Beleza e estética",
        group="Cuidado pessoal",
        keywords=("cabeleireiro", "cabeleireira", "barbeiro", "barbearia", "manicure", "pedicure", "maquiador", "maquiadora", "esteticista", "massagista", "sobrancelha", "cilios", "depilacao", "salao"),
        synonyms=("beleza", "estetica", "unha", "cabelo", "make", "spa"),
    ),
    Category(
        id="food_events",
        label="Alimentação e eventos",
        group="Experiências",
        keywords=("buffet", "confeiteira", "confeiteiro", "bolo", "doces", "salgados", "chef", "cozinheira", "cozinheiro", "restaurante", "bar", "padaria", "cerimonial", "fotografo", "fotografa", "decorador", "decoradora", "dj", "evento", "eventos"),
        synonyms=("festa", "casamento", "aniversario", "comida", "delivery", "gastronomia"),
    ),
    Category(
        id="real_estate",
        label="Imóveis",
        group="Moradia e patrimônio",
        keywords=("corretor", "corretora", "imobiliaria", "imovel", "imoveis", "aluguel", "locacao", "arquiteto", "arquiteta", "engenheiro civil", "engenheira civil"),
        synonyms=("apartamento", "terreno", "condominio", "obra", "projeto arquitetonico"),
    ),
    Category(
        id="finance",
        label="Finanças e seguros",
        group="Planejamento",
        keywords=("contador", "contadora", "contabilidade", "financeiro", "financas", "seguro", "seguros", "corretor de seguros", "banco", "investimento", "investimentos", "mei", "imposto"),
        synonyms=("irpf", "nota fiscal", "dinheiro", "credito", "planejamento financeiro"),
    ),
    Category(
        id="creative",
        label="Comunicação e conteúdo",
        group="Criativo",
        keywords=("social media", "redator", "redatora", "copywriter", "jornalista", "fotografo", "fotografa", "videomaker", "editor", "editora", "branding", "trafego", "anuncios"),
        synonyms=("conteudo", "instagram", "midia", "comunicacao", "marca", "criativo"),
    ),
    Category(
        id="travel",
        label="Viagens e lazer",
        group="Estilo de vida",
        keywords=("agente de viagens", "turismo", "hotel", "pousada", "guia", "personal trainer", "academia", "pilates", "yoga", "musica", "banda"),
        synonyms=("viagem", "lazer", "treino", "fitness", "passeio", "hospedagem"),
    ),
)

GENERAL_CATEGORY = Category(
    id="general",
    label="Serviços gerais",
    group="Rede útil",
    keywords=(),
    synonyms=("contato util", "indicacao", "network"),
)

GENERIC_SERVICE_MARKERS = (
    "contato importado",
    "google contacts",
    "google people api",
    "sem categoria",
    "servico nao informado",
    "serviço não informado",
    "contato para revisar",
    "contato",
)


def normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFD", str(value or "").lower())
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn")


def text_matches_term(text: str, term: str) -> bool:
    normalized_text = f" {normalize(text)} "
    normalized_term = normalize(term).strip()
    if not normalized_term:
        return False
    if " " in normalized_term:
        return f" {normalized_term} " in normalized_text
    tokens = normalized_text.replace("-", " ").replace("_", " ").replace("/", " ").split()
    return normalized_term in tokens


def classify_service(service: str) -> Category:
    normalized = normalize(service)

    for category in CATEGORY_CATALOG:
        if any(text_matches_term(normalized, keyword) for keyword in category.keywords):
            return category

    for category in CATEGORY_CATALOG:
        if any(text_matches_term(normalized, keyword) for keyword in category.synonyms):
            return category

    return GENERAL_CATEGORY


def is_generic_service(service: str | None) -> bool:
    normalized = normalize(service or "").strip()
    return not normalized or any(marker in normalized for marker in GENERIC_SERVICE_MARKERS)


def infer_service_from_contact(name: str, service: str | None = "", note: str | None = "", source: str | None = "") -> str:
    existing = str(service or "").strip()
    if existing and not is_generic_service(existing):
        return existing

    text = " ".join([name or "", existing, note or "", source or ""])
    category = classify_service(text)
    if category.id != GENERAL_CATEGORY.id:
        return category.label.lower()
    return "contato para revisar"


def category_to_dict(category: Category, count: int = 0) -> dict:
    return {
        "id": category.id,
        "label": category.label,
        "group": category.group,
        "keywords": list(category.keywords),
        "synonyms": list(category.synonyms),
        "count": count,
    }
