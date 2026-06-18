-- Optional seed data for Supabase/Postgres.
-- Password hashes are not included here; create real users through the app or Supabase Auth later.

insert into public.public_profiles (
  name, service, area, people, response, score,
  category_id, category_label, category_group, search_text
) values
  (
    'Grupo de eletricistas verificados',
    'eletricista, manutenção residencial, instalação',
    'São Paulo e ABC',
    42,
    '18 min',
    4.8,
    'home',
    'Casa e manutenção',
    'Serviços domésticos',
    'grupo de eletricistas verificados eletricista manutencao residencial instalacao sao paulo abc casa manutencao servicos domesticos'
  ),
  (
    'Rede jurídica para pequenos negócios',
    'jurídico, contratos, trabalhista, societário',
    'Online e presencial',
    28,
    '1 h',
    4.7,
    'legal',
    'Jurídico',
    'Serviços profissionais',
    'rede juridica pequenos negocios juridico contratos trabalhista societario online presencial servicos profissionais'
  ),
  (
    'Profissionais de casa e reforma',
    'pintura, reforma, encanador, marceneiro',
    'Grande São Paulo',
    67,
    '25 min',
    4.6,
    'home',
    'Casa e manutenção',
    'Serviços domésticos',
    'profissionais casa reforma pintura encanador marceneiro grande sao paulo casa manutencao servicos domesticos'
  ),
  (
    'Tecnologia para negócios locais',
    'site, suporte, software, automação, design',
    'Brasil',
    35,
    '45 min',
    4.9,
    'tech',
    'Tecnologia',
    'Digital',
    'tecnologia negocios locais site suporte software automacao design brasil digital'
  )
on conflict do nothing;
