-- Optional seed data for Supabase/Postgres.
-- Password hashes are not included here; create real users through the app or Supabase Auth later.

insert into public.public_profiles (
  name, service, area, people, response, score,
  category_id, category_label, category_group, search_text
) values
  (
    'Grupo de eletricistas verificados',
    'eletricista, manutencao residencial, instalacao',
    'Sao Paulo e ABC',
    42,
    '18 min',
    4.8,
    'home',
    'Casa e manutencao',
    'Servicos domesticos',
    'grupo de eletricistas verificados eletricista manutencao residencial instalacao sao paulo abc casa manutencao servicos domesticos'
  ),
  (
    'Rede juridica para pequenos negocios',
    'juridico, contratos, trabalhista, societario',
    'Online e presencial',
    28,
    '1 h',
    4.7,
    'legal',
    'Juridico',
    'Servicos profissionais',
    'rede juridica pequenos negocios juridico contratos trabalhista societario online presencial servicos profissionais'
  ),
  (
    'Profissionais de casa e reforma',
    'pintura, reforma, encanador, marceneiro',
    'Grande Sao Paulo',
    67,
    '25 min',
    4.6,
    'home',
    'Casa e manutencao',
    'Servicos domesticos',
    'profissionais casa reforma pintura encanador marceneiro grande sao paulo casa manutencao servicos domesticos'
  ),
  (
    'Tecnologia para negocios locais',
    'site, suporte, software, automacao, design',
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
