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
        keywords=("eletricista", "encanador", "pintor", "pintura", "reforma", "pedreiro", "marceneiro", "limpeza", "jardineiro"),
        synonyms=("instalacao", "reparo", "emergencia", "manutencao", "residencial"),
    ),
    Category(
        id="legal",
        label="Jurídico",
        group="Serviços profissionais",
        keywords=("advogado", "advogada", "juridico", "trabalhista", "contrato", "contratos", "civil", "tributario"),
        synonyms=("processo", "empresa", "direito", "documentos"),
    ),
    Category(
        id="health",
        label="Saúde",
        group="Cuidado pessoal",
        keywords=("medico", "medica", "dentista", "psicologo", "psicologa", "fisioterapeuta", "nutricionista"),
        synonyms=("consulta", "tratamento", "clinica"),
    ),
    Category(
        id="business",
        label="Empresas e negócios",
        group="Operação",
        keywords=("contador", "contabilidade", "consultor", "consultoria", "marketing", "vendas", "rh", "financeiro"),
        synonyms=("empresa", "gestao", "estrategia", "operacao"),
    ),
    Category(
        id="tech",
        label="Tecnologia",
        group="Digital",
        keywords=("programador", "desenvolvedor", "designer", "ti", "suporte", "software", "web", "site", "app"),
        synonyms=("sistema", "automacao", "produto digital"),
    ),
    Category(
        id="education",
        label="Educação",
        group="Aulas e mentoria",
        keywords=("professor", "professora", "aula", "ingles", "matematica", "mentor", "mentoria"),
        synonyms=("curso", "reforco", "aprendizado"),
    ),
    Category(
        id="vehicle",
        label="Veículos",
        group="Mobilidade",
        keywords=("mecanico", "auto", "carro", "moto", "funilaria", "guincho", "motorista"),
        synonyms=("oficina", "revisao", "transporte"),
    ),
)

GENERAL_CATEGORY = Category(
    id="general",
    label="Serviços gerais",
    group="Rede útil",
    keywords=(),
    synonyms=("contato util", "indicacao", "network"),
)


def normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.lower())
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn")


def classify_service(service: str) -> Category:
    normalized = normalize(service)

    for category in CATEGORY_CATALOG:
        if any(normalize(keyword) in normalized for keyword in category.keywords):
            return category

    for category in CATEGORY_CATALOG:
        if any(normalize(keyword) in normalized for keyword in category.synonyms):
            return category

    return GENERAL_CATEGORY


def category_to_dict(category: Category, count: int = 0) -> dict:
    return {
        "id": category.id,
        "label": category.label,
        "group": category.group,
        "keywords": list(category.keywords),
        "synonyms": list(category.synonyms),
        "count": count,
    }
